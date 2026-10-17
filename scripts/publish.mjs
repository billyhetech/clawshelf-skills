#!/usr/bin/env node
/**
 * Publish ClawShelf skills to clawshelf.com.
 *
 * For every changed skills/<name>/ (and every packs/<name>/ that includes it):
 *   1. zip the folder deterministically and upload it to the private R2 bucket
 *      under a content-hashed key (skills/<32 hex>.zip)
 *   2. POST /api/skills/ingest { action: "publish" } — the site updates the
 *      catalog and writes a changelog entry when the version changes
 *   3. delete the R2 objects the site reports as `replaced`
 *
 * Used by this public repo (free skills) and, through the reusable workflow,
 * by the private clawshelf-skills-pro repo (PRICING=premium).
 *
 * Env: INGEST_SECRET, STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID,
 *      STORAGE_SECRET_ACCESS_KEY, STORAGE_BUCKET_NAME, STORAGE_REGION,
 *      PRICING=free|premium, SITE_URL, PUBLIC_REPO, CHANGED_FILES (newline list,
 *      empty = publish everything), RELEASE_NOTES (default release notes),
 *      DRY_RUN=1 to print payloads without uploading.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import JSZip from 'jszip';
import { s3mini } from 's3mini';
import { parse as parseYaml } from 'yaml';

const env = process.env;
const PRICING = env.PRICING === 'premium' ? 'premium' : 'free';
const SITE_URL = (env.SITE_URL || 'https://clawshelf.vercel.app').replace(/\/$/, '');
const PUBLIC_REPO = env.PUBLIC_REPO || 'billyhetech/clawshelf-skills';
const DRY_RUN = env.DRY_RUN === '1';
const AGENTS = ['claude-code', 'codex', 'cursor', 'openclaw'];
const SLUG_PREFIX = 'clawshelf-team-';
const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

function walk(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

function readFrontmatter(file) {
  const text = readFileSync(file, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  return { data: parseYaml(match[1]) ?? {}, text };
}

function titleCase(name) {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function firstSentence(text, max) {
  const sentence = text.split(/(?<=[.!?])\s/)[0];
  return (sentence.length <= max ? sentence : `${text.slice(0, max - 1)}…`).trim();
}

/** Deterministic ZIP: sorted entries, fixed timestamps → same bytes for same content. */
async function zipFolders(folders) {
  const zip = new JSZip();
  const files = [];
  for (const { dir, prefix } of folders) {
    for (const file of walk(dir)) {
      const path = join(prefix, relative(dir, file));
      zip.file(path, readFileSync(file), { date: FIXED_DATE });
      files.push(path);
    }
  }
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  return { buffer, files };
}

function r2Key(commandName, buffer) {
  const contentHash = createHash('sha256').update(buffer).digest('hex');
  const id = createHash('sha256')
    .update(`clawshelf-team/${commandName}/${contentHash}`)
    .digest('hex')
    .slice(0, 32);
  return `skills/${id}.zip`;
}

function meta(data) {
  return data?.metadata?.clawshelf ?? {};
}

function basePayload({ name, data, text, kind }) {
  const m = meta(data);
  const description = String(data.description ?? '').trim();
  const isFree = PRICING === 'free' && m.price === undefined;
  return {
    action: 'publish',
    slug: m.slug ?? `${SLUG_PREFIX}${name}`,
    type: kind,
    title: m.title ?? titleCase(name),
    summary: m.summary ?? firstSentence(description, 300),
    summaryZh: m.summary_zh ?? null,
    description: description.slice(0, 4000),
    category: m.category ?? 'other',
    outputType: m.output_type ?? null,
    agents: m.agents ?? AGENTS,
    isFree,
    priceCents: isFree ? 0 : Math.round(Number(m.price ?? 0) * 100),
    version: String(m.version ?? '1.0.0'),
    releaseNotes: m.release_notes ?? env.RELEASE_NOTES ?? null,
    commandName: name,
    previewSkillMd: text.slice(0, 20_000),
    license: data.license ?? m.license ?? null,
  };
}

const skillDirs = existsSync('skills')
  ? readdirSync('skills').filter((n) => statSync(join('skills', n)).isDirectory())
  : [];
const packDirs = existsSync('packs')
  ? readdirSync('packs').filter((n) => statSync(join('packs', n)).isDirectory())
  : [];

const changed = (env.CHANGED_FILES ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
const everything = changed.length === 0;
const touched = (prefix) => everything || changed.some((f) => f.startsWith(prefix));

const items = [];
const uploads = [];

for (const name of skillDirs) {
  if (!touched(`skills/${name}/`)) continue;
  const dir = join('skills', name);
  const { data, text } = readFrontmatter(join(dir, 'SKILL.md'));
  const { buffer, files } = await zipFolders([{ dir, prefix: name }]);
  const key = r2Key(name, buffer);
  const payload = basePayload({ name, data, text, kind: 'skill' });
  const isPublic = PRICING === 'free' && payload.isFree;
  items.push({
    ...payload,
    packageFiles: files,
    downloadUrl: key,
    installCommand: isPublic ? `npx skills add ${PUBLIC_REPO} --skill ${name}` : null,
    githubPath: isPublic ? `skills/${name}` : null,
    sourceUrl: isPublic ? `https://github.com/${PUBLIC_REPO}/tree/main/skills/${name}` : null,
  });
  uploads.push({ key, buffer });
}

for (const name of packDirs) {
  const dir = join('packs', name);
  const { data, text } = readFrontmatter(join(dir, 'PACK.md'));
  const members = Array.isArray(data.skills) ? data.skills.map(String) : [];
  const affected =
    touched(`packs/${name}/`) || members.some((s) => touched(`skills/${s}/`));
  if (!affected) continue;
  for (const s of members) {
    if (!skillDirs.includes(s)) throw new Error(`pack ${name}: unknown skill ${s}`);
  }
  const { buffer, files } = await zipFolders([
    { dir, prefix: name },
    ...members.map((s) => ({ dir: join('skills', s), prefix: join(name, 'skills', s) })),
  ]);
  const key = r2Key(name, buffer);
  const payload = basePayload({ name, data, text, kind: 'pack' });
  const isPublic = PRICING === 'free' && payload.isFree;
  items.push({
    ...payload,
    packItems: members.map((s) => `${SLUG_PREFIX}${s}`),
    packageFiles: files,
    downloadUrl: key,
    installCommand: isPublic
      ? `npx skills add ${PUBLIC_REPO} ${members.map((s) => `--skill ${s}`).join(' ')}`
      : null,
    githubPath: isPublic ? `packs/${name}` : null,
    sourceUrl: isPublic ? `https://github.com/${PUBLIC_REPO}/tree/main/packs/${name}` : null,
  });
  uploads.push({ key, buffer });
}

if (items.length === 0) {
  console.log('Nothing to publish.');
  process.exit(0);
}

if (DRY_RUN) {
  for (const item of items) {
    console.log(`[dry-run] ${item.slug} v${item.version} → ${item.downloadUrl} (${item.packageFiles.length} files)`);
  }
  process.exit(0);
}

for (const name of ['INGEST_SECRET', 'STORAGE_ENDPOINT', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY', 'STORAGE_BUCKET_NAME']) {
  if (!env[name]) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
}

const endpoint = env.STORAGE_ENDPOINT.replace(/\/$/, '');
const s3 = new s3mini({
  accessKeyId: env.STORAGE_ACCESS_KEY_ID,
  secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  endpoint: `${endpoint}/${env.STORAGE_BUCKET_NAME}`,
  region: env.STORAGE_REGION || 'auto',
});

for (const { key, buffer } of uploads) {
  await s3.putObject(key, buffer, 'application/zip');
  console.log(`uploaded ${key}`);
}

const response = await fetch(`${SITE_URL}/api/skills/ingest`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${env.INGEST_SECRET}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ items }),
});
const result = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(`ingest failed: HTTP ${response.status}`, result);
  process.exit(1);
}
console.log('published:', result.ok);

for (const { downloadUrl } of result.replaced ?? []) {
  await s3.deleteObject(downloadUrl);
  console.log(`deleted old ${downloadUrl}`);
}

if (result.errors?.length) {
  console.error('errors:', result.errors);
  process.exit(1);
}
