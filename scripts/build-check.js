#!/usr/bin/env node
/**
 * Build verification for a no-bundler Vercel deployment.
 *
 * Checks that every referenced asset exists, every JS file parses, every HTML
 * page is structurally sound, and — critically — that the deployment stays
 * inside the Vercel Hobby plan's serverless-function allowance (12).
 *
 * Exits non-zero on failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** Vercel Hobby plan hard limit. The build fails above this so a deploy can
 *  never be rejected again for exceeding it. */
const MAX_FUNCTIONS = 12;

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

/* ================================================================== *
 * 0. Serverless function count
 *
 * Vercel turns every .js/.ts/.mjs file in the root `api` directory into a
 * deployed function — including nested ones. Anything outside `api/` is a
 * shared module and costs nothing. We count exactly the same way, then fail
 * when the total exceeds the plan allowance.
 * ================================================================== */
const API_DIR = path.join(ROOT, 'api');

function serverlessFunctions() {
  if (!fs.existsSync(API_DIR)) return [];
  return walk(API_DIR)
    .filter((f) => /\.(js|mjs|cjs|ts)$/.test(f))
    .map((f) => path.relative(ROOT, f).split(path.sep).join('/'))
    .sort();
}

const functions = serverlessFunctions();

if (!functions.length) {
  errors.push('No serverless functions found in api/ — every endpoint would 404.');
} else if (functions.length > MAX_FUNCTIONS) {
  errors.push(
    `Too many serverless functions: ${functions.length} found, the Vercel Hobby plan allows ${MAX_FUNCTIONS}. ` +
      `Merge related routes into one router function (see api/admin.js for the pattern), or move shared code out of api/.`
  );
}

// Every function should be importable as a handler, not a helpers dump.
for (const fn of functions) {
  const src = fs.readFileSync(path.join(ROOT, fn), 'utf8');
  if (!/export\s+default/.test(src)) {
    errors.push(`${fn} has no default export, so Vercel cannot use it as a handler`);
  }
}

/* ================================================================== *
 * 1. JS syntax
 * ================================================================== */
for (const file of files.filter((f) => f.endsWith('.js'))) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    const detail = err.stderr ? err.stderr.toString().split('\n').slice(0, 4).join(' ') : '';
    errors.push(`Syntax error in ${path.relative(ROOT, file)}: ${detail}`);
  }
}

/* ================================================================== *
 * 2. Referenced local assets + HTML sanity
 * ================================================================== */
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

const htmlFiles = files.filter((f) => f.endsWith('.html'));

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  // Static refs only: ignore anchors (#…), query strings and template holes.
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"#?{}]+)"/g)].map((m) => m[1]);

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
  if (!/<title>/.test(html)) errors.push(`${path.relative(ROOT, file)} has no <title>`);
  if (!/<meta name="description"/.test(html)) {
    warnings.push(`${path.relative(ROOT, file)} has no meta description`);
  }
}

/* ================================================================== *
 * 2b. No dead in-page anchors between pages
 *
 * Nav/footer links must point at real pages now, not at "#section" on the
 * home page. We only flag anchors that look like cross-page jumps.
 * ================================================================== */
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const anchors = [...html.matchAll(/href="(\/(?:index\.html)?#[\w-]+)"/g)].map((m) => m[1]);
  if (anchors.length) {
    warnings.push(
      `${path.relative(ROOT, file)} still has ${anchors.length} legacy anchor link(s): ${[
        ...new Set(anchors),
      ].join(', ')}`
    );
  }
}

/* ================================================================== *
 * 3. Required files
 *
 * Split into two tiers on purpose:
 *  - HARD requirements break the deploy. Only files that git tracks normally
 *    and that the app genuinely cannot run without belong here.
 *  - SOFT requirements are dotfiles / docs. Git ignores dotfiles by default
 *    and some tools strip them, so a missing one must never fail a
 *    production deploy. We warn instead.
 * ================================================================== */
const REQUIRED_FILES = ['vercel.json', 'package.json', 'index.html', '404.html'];
for (const required of REQUIRED_FILES) {
  if (!fs.existsSync(path.join(ROOT, required))) errors.push(`Missing ${required}`);
}

/** Every public page must exist — these are the URLs the nav links to. */
const REQUIRED_PAGES = [
  'shop.html',
  'product.html',
  'about.html',
  'faq.html',
  'how-it-works.html',
  'terms.html',
  'privacy.html',
  'reviews.html',
  'contact.html',
  'sell.html',
  'pandaviki001stores.html',
];
for (const page of REQUIRED_PAGES) {
  if (!fs.existsSync(path.join(ROOT, page))) errors.push(`Missing page: ${page}`);
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

/* ================================================================== *
 * 3b. Every process.env key the app reads should be documented.
 *
 * Read-only audit: it only WARNS, because env vars are configured in the
 * Vercel dashboard and are not required for the build to succeed.
 * ================================================================== */
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
    for (const file of files.filter(
      (f) => f.endsWith('.js') && !f.includes(`${path.sep}scripts${path.sep}`)
    )) {
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

/* ================================================================== *
 * 4. JSON validity
 * ================================================================== */
for (const file of files.filter((f) => f.endsWith('.json'))) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    errors.push(`Invalid JSON in ${path.relative(ROOT, file)}: ${err.message}`);
  }
}

/* ================================================================== *
 * 5. Routing wired correctly
 * ================================================================== */
try {
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const sources = new Set((vercel.rewrites || []).map((r) => r.source));

  if (!sources.has('/pandaviki001stores')) {
    errors.push('vercel.json is missing the /pandaviki001stores rewrite');
  }

  // Every function must be reachable from at least one rewrite or be a
  // directly-addressable /api/<name> endpoint (products, config, health…).
  const directlyAddressable = new Set(['/api/health', '/api/config', '/api/products', '/api/cloudinary-public']);
  for (const fn of functions) {
    const name = fn.replace(/^api\//, '').replace(/\.js$/, '');
    const direct = `/api/${name}`;
    const covered =
      directlyAddressable.has(direct) ||
      (vercel.rewrites || []).some((r) => (r.destination || '').startsWith(direct));
    if (!covered) warnings.push(`${fn} has no route in vercel.json (unreachable)`);
  }

  // The public API URLs the front-end calls must all resolve — either
  // directly as /api/<name>.js, or through a rewrite in vercel.json.
  const REQUIRED_API_URLS = [
    '/api/config',
    '/api/products/:id',
    '/api/admin/login',
    '/api/admin/products',
    '/api/admin/settings',
    '/api/admin/cloudinary-signature',
    '/api/admin/stats',
    '/api/admin/reviews',
    '/api/admin/orders',
    '/api/admin/bulk-stock',
    '/api/submit/sell',
    '/api/submit/contact',
  ];
  for (const url of REQUIRED_API_URLS) {
    const directName = `/api/${url.replace(/^\/api\//, '').split('/')[0]}`;
    const servedDirectly = fs.existsSync(path.join(ROOT, `${directName}.js`));
    if (!sources.has(url) && !servedDirectly) {
      errors.push(`vercel.json has no rewrite for ${url}`);
    }
  }
} catch {
  errors.push('Could not parse vercel.json');
}

/* ================================================================== *
 * 6. Node engine pin (Vercel rejects discontinued runtimes)
 * ================================================================== */
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const node = pkg.engines?.node || '';
  if (!node.startsWith('24')) {
    warnings.push(`package.json engines.node is "${node || 'unset'}" — Vercel expects 24.x`);
  }
} catch {
  /* already reported by the JSON check */
}

/* ================================================================== *
 * report
 * ================================================================== */
console.log(`\nFiles checked:   ${files.length}`);
console.log(`Serverless fns:  ${functions.length} / ${MAX_FUNCTIONS} (Vercel Hobby limit)`);
functions.forEach((fn) => console.log(`   · ${fn}`));

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

console.log(
  `\nBuild check passed — ${functions.length} serverless function${functions.length === 1 ? '' : 's'}, ready to deploy.\n`
);
