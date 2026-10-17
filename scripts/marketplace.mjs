#!/usr/bin/env node
/**
 * Keep .claude-plugin/marketplace.json in sync with skills/.
 *
 * - One plugin per skill (metadata.clawshelf.kind = "skill") is generated from
 *   each skills/<name>/SKILL.md.
 * - Packs (kind = "pack") are written by hand and kept as they are; each lists
 *   the skill folders it bundles in `skills`.
 *
 * Claude Code: /plugin marketplace add <owner>/<repo>, then /plugin install <name>@<marketplace>.
 * Any agent:   npx skills add <owner>/<repo> --skill a --skill b
 *
 *   node scripts/marketplace.mjs          # rewrite the file
 *   node scripts/marketplace.mjs --check  # exit 1 if it is out of date (CI)
 */
import { writeFileSync } from 'node:fs';
import { MARKETPLACE_FILE, listPacks, listSkills, readMarketplace, readSkill } from './skill-meta.mjs';

const SITE = 'https://clawshelf.com';
const current = readMarketplace();
if (!current) {
  console.error(`${MARKETPLACE_FILE} is missing — create it with name, owner, description and your pack entries.`);
  process.exit(1);
}

const skillEntries = listSkills().map((name) => {
  const s = readSkill(name);
  return {
    name,
    source: './',
    skills: [`./skills/${name}`],
    ...(s.title ? { displayName: s.title } : {}),
    description: s.summary ?? String(s.data.description ?? '').slice(0, 300),
    version: s.version,
    ...(s.category ? { category: s.category } : {}),
    ...(s.license ? { license: String(s.license) } : {}),
    homepage: `${SITE}/skill/clawshelf-team-${name}`,
    metadata: { clawshelf: { kind: 'skill' } },
  };
});

const next = {
  ...current,
  plugins: [...listPacks(current).map(({ skillNames, ...p }) => p), ...skillEntries],
};
const output = `${JSON.stringify(next, null, 2)}\n`;

if (process.argv.includes('--check')) {
  if (output !== `${JSON.stringify(current, null, 2)}\n`) {
    console.error(`${MARKETPLACE_FILE} is out of date — run: node scripts/marketplace.mjs`);
    process.exit(1);
  }
  console.log(`✓ ${MARKETPLACE_FILE} is in sync`);
} else {
  writeFileSync(MARKETPLACE_FILE, output);
  console.log(`wrote ${MARKETPLACE_FILE} (${next.plugins.length} plugins)`);
}
