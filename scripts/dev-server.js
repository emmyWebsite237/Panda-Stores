#!/usr/bin/env node
/**
 * Local dev server that emulates Vercel's static + serverless behaviour.
 *   node scripts/dev-server.js [port]
 *
 * It reads vercel.json at boot and applies the same rewrites Vercel would, so
 * /api/admin/login, /api/products/:id, /shop and /account/:id all behave
 * exactly as they do in production. Handlers are the real api/*.js files.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 3000);

/* ------------------------------ env ------------------------------ */
function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}
loadEnv();

/* ---------------------------- mime types ---------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

/* ----------------------------- helpers ----------------------------- */

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function enhanceRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (body) => {
    res.end(body);
    return res;
  };
  return res;
}

/* --------------------------- rewrite engine --------------------------- */

const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

/**
 * Compile a Vercel source pattern ("/api/products/:id", "/pandaviki001stores/(.*)")
 * into a matcher. Returns { match(pathname) -> params | null }.
 */
function compileSource(source) {
  const names = [];
  let pattern = source
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // escape regex chars except * : ( )
    .replace(/\\\(\.\*\\\)/g, '__WILD__') // already-escaped (.*) came from the line above
    .replace(/\(\.\*\)/g, '__WILD__')
    .replace(/:([A-Za-z0-9_]+)/g, (_, name) => {
      names.push(name);
      return '([^/]+)';
    })
    .replace(/__WILD__/g, '(.*)');

  const re = new RegExp(`^${pattern}/?$`);
  return (pathname) => {
    const m = pathname.match(re);
    if (!m) return null;
    const params = {};
    names.forEach((name, i) => {
      params[name] = decodeURIComponent(m[i + 1]);
    });
    if (m[m.length - 1] !== undefined && m.length > names.length + 1) {
      params['*'] = m[m.length - 1];
    }
    return params;
  };
}

const REWRITES = (CONFIG.rewrites || []).map((rule) => ({
  rule,
  match: compileSource(rule.source),
}));

/** Apply the first matching rewrite. Returns { pathname, query } or null. */
function applyRewrite(pathname, searchParams) {
  for (const { rule, match } of REWRITES) {
    const params = match(pathname);
    if (!params) continue;

    let destination = rule.destination;
    for (const [key, value] of Object.entries(params)) {
      destination = destination.replace(`:${key}`, value);
    }
    if (params['*'] !== undefined) {
      destination = destination.replace('(.*)', params['*']);
    }

    const [nextPath, nextQuery] = destination.split('?');
    const merged = new URLSearchParams(searchParams);
    if (nextQuery) {
      for (const [k, v] of new URLSearchParams(nextQuery)) merged.set(k, v);
    }
    return { pathname: nextPath, query: merged };
  }
  return null;
}

/* ----------------------------- API ----------------------------- */

const handlerCache = new Map();

async function loadHandler(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  if (handlerCache.has(abs)) return handlerCache.get(abs);
  const mod = await import(pathToFileURL(abs).href);
  const handler = mod.default || mod.handler || null;
  handlerCache.set(abs, handler);
  return handler;
}

async function handleApi(req, res, pathname, query) {
  // /api/foo  → api/foo.js ; /api/foo/bar → api/foo.js (query carries the rest)
  const segments = pathname.replace(/^\/api\//, '').split('/').filter(Boolean);
  const candidates = [`api/${segments[0]}.js`, `api/${segments.join('/')}.js`];

  let handler = null;
  for (const candidate of candidates) {
    handler = await loadHandler(candidate);
    if (handler) break;
  }

  if (!handler) {
    return res.status(404).json({ ok: false, error: `No API route for ${pathname}` });
  }

  req.query = Object.fromEntries(query.entries());

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const raw = await readBody(req);
    try {
      req.body = raw ? JSON.parse(raw) : {};
    } catch {
      req.body = raw;
    }
  }

  await handler(req, enhanceRes(res));
}

/* ---------------------------- static ---------------------------- */

function serveFile(res, abs, cacheSeconds) {
  const ext = path.extname(abs).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : `public, max-age=${cacheSeconds}`);
  // Status is set by the caller (200 normally, 404 for the error page) —
  // never overwrite it here, or the 404 page would answer 200.
  fs.createReadStream(abs).pipe(res);
  return true;
}

function tryStatic(req, res, pathname, statusCode = 200) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  if (rel.endsWith('/')) rel += 'index.html';
  const abs = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));

  if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return false;
  res.statusCode = statusCode;
  if (statusCode === 404) res.statusMessage = 'Not Found';
  return serveFile(res, abs, 60);
}

/* ----------------------------- server ----------------------------- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(url.pathname);
  let query = url.searchParams;

  try {
    const rewritten = applyRewrite(pathname, query);
    if (rewritten) {
      pathname = rewritten.pathname;
      query = rewritten.query;
    }

    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname, query);
      return;
    }

    if (tryStatic(req, res, pathname)) return;

    // Vercel's cleanUrls: /shop serves shop.html
    if (!path.extname(pathname) && tryStatic(req, res, `${pathname}.html`)) return;

    // 404 page, preserving the real status code.
    if (tryStatic(req, res, '/404.html', 404)) return;

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h1>404 — not found</h1>');
  } catch (err) {
    console.error('[dev-server]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n🐼  Panda Gaming Store running at http://localhost:${PORT}`);
  console.log(`    Admin:   http://localhost:${PORT}/pandaviki001stores`);
  console.log(`    Shop:    http://localhost:${PORT}/shop`);
  console.log(`    API:     http://localhost:${PORT}/api/health`);
  console.log(`    Rewrites loaded: ${REWRITES.length}\n`);
});
