#!/usr/bin/env node
/**
 * Publish ClawShelf skills to clawshelf.com.
 *
 * For every changed skills/<name>/ (and every pack in .claude-plugin/marketplace.json
 * that includes it):
 *   1. zip it deterministically and upload it to the private R2 bucket under a
 *      content-hashed key (skills/<32 hex>.zip) — unchanged content keeps its key
 *   2. POST /api/skills/ingest { action: "publish" } — the site updates the
 *      catalog and writes a changelog entry when the version changes
 *   3. delete the R2 objects the site reports as `replaced`
 *
 * Used by this public repo (free skills) and, through the reusable workflow,
 * by the private clawshelf-skills-pro repo (PRICING=premium).
 *
 * Pricing (premium repo only): SKILL.md `metadata.clawshelf-price` / pack
 * `metadata.clawshelf.price` = "pro" (default) → Pro/Lifetime members only, or a
 * number in USD → also sold on its own.
 *
 * Env: PUBLISH_SECRET, STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID,
 *      STORAGE_SECRET_ACCESS_KEY, STORAGE_BUCKET_NAME, STORAGE_REGION,
 *      PRICING=free|premium, SITE_URL, PUBLIC_REPO, CHANGED_FILES (newline list,
 *      empty = publish everything), RELEASE_NOTES (default release notes),
 *      DRY_RUN=1 to print payloads without uploading.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import JSZip from 'jszip';
import { s3mini } from 's3mini';
import { listPacks, listSkills, readMarketplace, readSkill } from './skill-meta.mjs';

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

function titleCase(name) {
  return name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function firstSentence(text, max) {
  const sentence = String(text).split(/(?<=[.!?])\s/)[0];
  return (sentence.length <= max ? sentence : `${String(text).slice(0, max - 1)}…`).trim();
}

/**
 * Deterministic ZIP: sorted entries, fixed timestamps and no implicit folder
 * entries (JSZip would stamp those with the current time) → same bytes for the
 * same content, so an unchanged skill keeps its R2 key.
 */
async function zipFolders(folders) {
  const zip = new JSZip();
  const files = [];
  for (const { dir, prefix } of folders) {
    for (const file of walk(dir)) {
      const path = join(prefix, relative(dir, file));
      zip.file(path, readFileSync(file), { date: FIXED_DATE, createFolders: false });
      files.push(path);
    }
  }
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
    platform: 'UNIX',
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

/** Free repo → free. Premium repo → "pro" (members only) unless a USD price is set. */
function pricing(price) {
  if (PRICING === 'free') return { isFree: true, priceCents: 0 };
  const usd = Number(price);
  return {
    isFree: false,
    priceCents: price !== undefined && price !== 'pro' && Number.isFinite(usd) ? Math.round(usd * 100) : 0,
  };
}

const marketplace = readMarketplace();
const skillNames = listSkills();
const packs = listPacks(marketplace);

const changed = (env.CHANGED_FILES ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
const everything = changed.length === 0;
const touched = (prefix) => everything || changed.some((f) => f.startsWith(prefix));
const marketplaceTouched = touched('.claude-plugin/');

const items = [];
const uploads = [];

for (const name of skillNames) {
  if (!touched(`skills/${name}/`)) continue;
  const s = readSkill(name);
  const dir = join('skills', name);
  const { buffer, files } = await zipFolders([{ dir, prefix: name }]);
  const key = r2Key(name, buffer);
  const price = pricing(s.price);
  const isPublic = PRICING === 'free';
  items.push({
    action: 'publish',
    slug: `${SLUG_PREFIX}${name}`,
    type: 'skill',
    title: s.title ?? titleCase(name),
    summary: s.summary ?? firstSentence(s.data.description ?? '', 300),
    summaryZh: s.summaryZh ?? null,
    description: String(s.data.description ?? '').trim().slice(0, 4000),
    category: s.category ?? 'other',
    outputType: s.outputType ?? null,
    agents: AGENTS,
    ...price,
    version: s.version,
    releaseNotes: s.releaseNotes ?? env.RELEASE_NOTES ?? null,
    commandName: name,
    previewSkillMd: s.text.slice(0, 20_000),
    license: s.license ? String(s.license) : null,
    packageFiles: files,
    downloadUrl: key,
    installCommand: isPublic ? `npx skills add ${PUBLIC_REPO} --skill ${name}` : null,
    githubPath: isPublic ? `skills/${name}` : null,
    sourceUrl: isPublic ? `https://github.com/${PUBLIC_REPO}/tree/master/skills/${name}` : null,
  });
  uploads.push({ key, buffer });
}

for (const pack of packs) {
  const members = pack.skillNames;
  for (const s of members) {
    if (!skillNames.includes(s)) throw new Error(`pack ${pack.name}: unknown skill ${s}`);
  }
  const affected = marketplaceTouched || members.some((s) => touched(`skills/${s}/`));
  if (!affected) continue;
  const meta = pack.metadata?.clawshelf ?? {};
  const isPublic = PRICING === 'free';
  const readme = [
    `# ${pack.displayName ?? titleCase(pack.name)}`,
    '',
    pack.description ?? '',
    '',
    '## Included skills',
    '',
    ...members.map((s) => `- **${readSkill(s).title ?? titleCase(s)}** (\`${s}\`) — ${readSkill(s).summary ?? ''}`),
    '',
    '## Install',
    '',
    isPublic
      ? `\`\`\`bash\nnpx skills add ${PUBLIC_REPO} ${members.map((s) => `--skill ${s}`).join(' ')}\n\`\`\`\n\nClaude Code: \`/plugin marketplace add ${PUBLIC_REPO}\`, then \`/plugin install ${pack.name}@${marketplace.name}\`.`
      : 'Pro members install it from clawshelf.com or from their agent with an API key.',
    '',
  ].join('\n');
  const { buffer, files } = await zipFolders(
    members.map((s) => ({ dir: join('skills', s), prefix: join(pack.name, 'skills', s) }))
  );
  const key = r2Key(pack.name, buffer);
  items.push({
    action: 'publish',
    slug: `${SLUG_PREFIX}${pack.name}`,
    type: 'pack',
    packItems: members.map((s) => `${SLUG_PREFIX}${s}`),
    title: pack.displayName ?? titleCase(pack.name),
    summary: firstSentence(pack.description ?? '', 300),
    summaryZh: meta.summaryZh ?? null,
    description: String(pack.description ?? '').slice(0, 4000),
    category: pack.category ?? 'other',
    outputType: meta.outputType ?? null,
    agents: AGENTS,
    ...pricing(meta.price),
    version: String(pack.version ?? '1.0.0'),
    releaseNotes: meta.releaseNotes ?? env.RELEASE_NOTES ?? null,
    commandName: pack.name,
    previewSkillMd: readme,
    license: pack.license ?? null,
    packageFiles: files,
    downloadUrl: key,
    installCommand: isPublic ? `npx skills add ${PUBLIC_REPO} ${members.map((s) => `--skill ${s}`).join(' ')}` : null,
    githubPath: isPublic ? '.claude-plugin/marketplace.json' : null,
    sourceUrl: isPublic ? `https://github.com/${PUBLIC_REPO}` : null,
  });
  uploads.push({ key, buffer });
}

if (items.length === 0) {
  console.log('Nothing to publish.');
  process.exit(0);
}

if (DRY_RUN) {
  for (const item of items) {
    console.log(`[dry-run] ${item.slug} v${item.version} ${item.isFree ? 'free' : item.priceCents ? `$${item.priceCents / 100}` : 'pro'} → ${item.downloadUrl} (${item.packageFiles.length} files)`);
  }
  process.exit(0);
}

for (const name of ['PUBLISH_SECRET', 'STORAGE_ENDPOINT', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY', 'STORAGE_BUCKET_NAME']) {
  if (!env[name]) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
}

const s3 = new s3mini({
  accessKeyId: env.STORAGE_ACCESS_KEY_ID,
  secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  endpoint: `${env.STORAGE_ENDPOINT.replace(/\/$/, '')}/${env.STORAGE_BUCKET_NAME}`,
  region: env.STORAGE_REGION || 'auto',
});

for (const { key, buffer } of uploads) {
  await s3.putObject(key, buffer, 'application/zip');
  console.log(`uploaded ${key}`);
}

// The ingest API accepts at most 50 items per request
const replaced = [];
const errors = [];
for (let i = 0; i < items.length; i += 50) {
  const response = await fetch(`${SITE_URL}/api/skills/ingest`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.PUBLISH_SECRET}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ items: items.slice(i, i + 50) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`ingest failed: HTTP ${response.status}`, result);
    process.exit(1);
  }
  console.log('published:', result.ok);
  replaced.push(...(result.replaced ?? []));
  errors.push(...(result.errors ?? []));
}

for (const { downloadUrl } of replaced) {
  await s3.deleteObject(downloadUrl);
  console.log(`deleted old ${downloadUrl}`);
}

if (errors.length) {
  console.error('errors:', errors);
  process.exit(1);
}
