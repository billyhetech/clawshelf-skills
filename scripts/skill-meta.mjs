// Shared readers for SKILL.md frontmatter and .claude-plugin/marketplace.json.
// SKILL.md follows the Agent Skills spec: `metadata` is a flat string→string map,
// so ClawShelf fields are namespaced keys (clawshelf-title, clawshelf-category…).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export const MARKETPLACE_FILE = '.claude-plugin/marketplace.json';

export function readSkill(name) {
  const file = join('skills', name, 'SKILL.md');
  const text = readFileSync(file, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const data = parseYaml(match[1]) ?? {};
  const meta = data.metadata ?? {};
  return {
    name,
    text,
    data,
    version: String(meta.version ?? '1.0.0'),
    title: meta['clawshelf-title'],
    summary: meta['clawshelf-summary'],
    summaryZh: meta['clawshelf-summary-zh'],
    category: meta['clawshelf-category'],
    outputType: meta['clawshelf-output-type'],
    price: meta['clawshelf-price'],
    releaseNotes: meta['clawshelf-release-notes'],
    license: data.license,
  };
}

export function listSkills() {
  if (!existsSync('skills')) return [];
  return readdirSync('skills')
    .filter((n) => statSync(join('skills', n)).isDirectory())
    .sort();
}

export function readMarketplace() {
  return existsSync(MARKETPLACE_FILE)
    ? JSON.parse(readFileSync(MARKETPLACE_FILE, 'utf8'))
    : null;
}

/** Pack = a marketplace plugin entry marked metadata.clawshelf.kind = "pack". */
export function listPacks(marketplace) {
  return (marketplace?.plugins ?? [])
    .filter((p) => p.metadata?.clawshelf?.kind === 'pack')
    .map((p) => ({
      ...p,
      skillNames: (p.skills ?? []).map((path) => path.replace(/^\.\/skills\//, '').replace(/\/$/, '')),
    }));
}
