#!/usr/bin/env node
// Validates every skills/<name>/SKILL.md against the Agent Skills spec
// (https://agentskills.io/specification) plus ClawShelf house rules.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'skills';
const MAX_FILE_BYTES = 1_000_000;
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const errors = [];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return fields;
}

for (const name of readdirSync(ROOT)) {
  const dir = join(ROOT, name);
  if (!statSync(dir).isDirectory()) continue;
  const where = `${dir}/SKILL.md`;
  let text;
  try {
    text = readFileSync(where, 'utf8');
  } catch {
    errors.push(`${dir}: missing SKILL.md`);
    continue;
  }
  const fm = frontmatter(text);
  if (!fm) {
    errors.push(`${where}: missing YAML frontmatter`);
    continue;
  }
  if (!NAME.test(name)) errors.push(`${dir}: folder must be kebab-case`);
  if (fm.name !== name) errors.push(`${where}: name "${fm.name}" must equal folder "${name}"`);
  if (!fm.description || fm.description.length < 20)
    errors.push(`${where}: description is required (20+ chars)`);
  if (fm.description && fm.description.length > 1024)
    errors.push(`${where}: description must be <= 1024 chars`);
  for (const file of walk(dir)) {
    if (statSync(file).size > MAX_FILE_BYTES) errors.push(`${file}: larger than 1 MB`);
  }
}

if (errors.length > 0) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log('✓ all skills valid');
