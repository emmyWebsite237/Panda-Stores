#!/usr/bin/env node
/**
 * Build verification for a no-bundler Vercel deployment.
 * Checks that every referenced asset exists, every JS file parses, and every
 * HTML page is structurally sound. Exits non-zero on failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const errors = [];
const warnings = [];
const SKIP = new Set(['node_modules', '.git', '_original_backup', '.vercel']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT);

/* 1. JS syntax */
for (const file of files.filter((f) => f.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    const detail = err.stderr ? err.stderr.toString().split('\n').slice(0, 4).join(' ') : '';
    errors.push(`Syntax error in ${path.relative(ROOT, file)}: ${detail}`);
  }
}

/* 2. Referenced local assets + HTML sanity */
const vercelConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

/** A URL is served if a vercel rewrite covers it (e.g. /sell-account → /sell.html). */
function rewriteMatches(pathname) {
  const target = pathname.split('/').filter(Boolean);
  return (vercelConfig.rewrites || []).some((rule) => {
    const parts = rule.source.split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (part === '(.*)' || part === ':path*') return true; // catch-all tail
      if (target[i] === undefined) return false;
      if (part.startsWith(':')) continue; // dynamic segment matches anything
      if (part !== target[i]) return false;
    }
    return parts.length === target.length;
  });
}

for (const file of files.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(file, 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)].map((m) => m[1]);

  for (const ref of refs) {
    if (ref.startsWith('/api/')) continue;
    const target = path.join(ROOT, ref.replace(/^\//, ''));
    const hasFile = fs.existsSync(target) || fs.existsSync(`${target}.html`);
    if (!hasFile && !rewriteMatches(ref) && ref !== '/') {
      errors.push(`${path.relative(ROOT, file)} references missing asset: ${ref}`);
    }
  }

  if (!html.includes('<meta name="viewport"')) {
    errors.push(`${path.relative(ROOT, file)} is missing a viewport meta tag`);
  }
  if (!/<title>/.test(html)) warnings.push(`${path.relative(ROOT, file)} has no <title>`);
}

/* 3. Required files
 *
 * Split into two tiers on purpose:
 *  - HARD requirements break the deploy. Only files that git tracks normally
 *    and that the app genuinely cannot run without belong here.
 *  - SOFT requirements are dotfiles / docs. Git ignores dotfiles by default
 *    and some tools strip them, so a missing one must never fail a
 *    production deploy. We warn instead.
 */
const REQUIRED_FILES = ['vercel.json', 'package.json', 'index.html'];
for (const required of REQUIRED_FILES) {
  if (!fs.existsSync(path.join(ROOT, required))) errors.push(`Missing ${required}`);
}

const RECOMMENDED_DOTFILES = ['.env.example', '.nvmrc', '.node-version', '.gitignore'];
for (const file of RECOMMENDED_DOTFILES) {
  if (!fs.existsSync(path.join(ROOT, file))) {
    warnings.push(
      `Missing ${file} (dotfiles are often excluded from git — the build continues). ` +
        `Recommended so local setup, Node version and secret protection stay correct.`
    );
  }
}

/* 3b. Every process.env key the app reads should be documented.
 *
 * Read-only audit: it only WARNS, because env vars are configured in the
 * Vercel dashboard and are not required for the build to succeed.
 */
try {
  const envExample = path.join(ROOT, '.env.example');
  if (fs.existsSync(envExample)) {
    const documented = new Set(
      fs
        .readFileSync(envExample, 'utf8')
        .split('\n')
        .map((line) => line.match(/^\s*#?\s*([A-Z][A-Z0-9_]+)\s*=/))
        .filter(Boolean)
        .map((m) => m[1])
    );

    const used = new Set();
    for (const file of files.filter((f) => f.endsWith('.js') && !f.includes(`${path.sep}scripts${path.sep}`))) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) used.add(m[1]);
      for (const m of src.matchAll(/process\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g)) used.add(m[1]);
    }
    // Runtime-provided by the platform; not ours to document.
    for (const runtime of ['NODE_ENV', 'PORT', 'VERCEL', 'VERCEL_ENV', 'CI']) used.delete(runtime);

    const undocumented = [...used].filter((key) => !documented.has(key)).sort();
    if (undocumented.length) {
      warnings.push(`.env.example does not document: ${undocumented.join(', ')}`);
    }
  }
} catch (err) {
  warnings.push(`Could not audit .env.example: ${err.message}`);
}

/* 4. JSON validity */
for (const file of files.filter((f) => f.endsWith('.json'))) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    errors.push(`Invalid JSON in ${path.relative(ROOT, file)}: ${err.message}`);
  }
}

/* 5. Admin route wired */
try {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const hasAdmin = vercel.rewrites?.some((r) => r.source === '/pandaviki001stores');
  if (!hasAdmin) errors.push('vercel.json is missing the /pandaviki001stores rewrite');
} catch {
  errors.push('Could not parse vercel.json');
}

/* report */
const apiCount = files.filter((f) => f.includes(`${path.sep}api${path.sep}`) && f.endsWith('.js')).length;
console.log(`\nFiles checked: ${files.length}`);
console.log(`API routes:    ${apiCount}`);

if (warnings.length) {
  console.log('\nWarnings:');
  warnings.forEach((w) => console.log(`  !  ${w}`));
}

if (errors.length) {
  console.log('\nErrors:');
  errors.forEach((e) => console.log(`  x  ${e}`));
  console.log(`\nBuild check FAILED (${errors.length} error${errors.length === 1 ? '' : 's'})\n`);
  process.exit(1);
}

console.log('\nBuild check passed - ready to deploy.\n');
