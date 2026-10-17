#!/usr/bin/env node
// House rules on top of the official validators (agentskills validate, claude plugin validate):
// - metadata values are strings (Agent Skills spec: string → string map)
// - every pack in .claude-plugin/marketplace.json lists skills that exist here
// - marketplace.json single-skill entries are in sync (scripts/marketplace.mjs)
// - no file over 1 MB
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { listPacks, listSkills, readMarketplace, readSkill } from './skill-meta.mjs';

const MAX_FILE_BYTES = 1_000_000;
const errors = [];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const skills = listSkills();
for (const name of skills) {
  let skill;
  try {
    skill = readSkill(name);
  } catch (error) {
    errors.push(error.message);
    continue;
  }
  const meta = skill.data.metadata ?? {};
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value !== 'string') {
      errors.push(`skills/${name}/SKILL.md: metadata.${key} must be a string (quote it)`);
    }
  }
  for (const file of walk(join('skills', name))) {
    if (statSync(file).size > MAX_FILE_BYTES) errors.push(`${file}: larger than 1 MB`);
  }
}

const marketplace = readMarketplace();
if (!marketplace) {
  errors.push('.claude-plugin/marketplace.json is missing');
} else {
  for (const pack of listPacks(marketplace)) {
    if (pack.skillNames.length === 0) errors.push(`pack ${pack.name}: lists no skills`);
    for (const s of pack.skillNames) {
      if (!skills.includes(s)) errors.push(`pack ${pack.name}: unknown skill "${s}"`);
    }
  }
  try {
    execFileSync('node', [new URL('./marketplace.mjs', import.meta.url).pathname, '--check'], { stdio: 'pipe' });
  } catch {
    errors.push('.claude-plugin/marketplace.json is out of date — run: node scripts/marketplace.mjs');
  }
}

if (errors.length > 0) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✓ ${skills.length} skills and ${listPacks(marketplace).length} packs pass house rules`);
