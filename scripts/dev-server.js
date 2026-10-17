#!/usr/bin/env node
/**
 * Local dev server that emulates Vercel's static + serverless behaviour.
 *   node scripts/dev-server.js [port]
 *
 * Mirrors the rewrites in vercel.json and exposes each file under /api as a
 * handler receiving (req, res) with res.status()/res.json() helpers.
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
    const text = fs.readFileSync(full, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
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
    const body = JSON.stringify(obj);
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(body);
    return res;
  };
  res.send = (body) => {
    res.end(body);
    return res;
  };
  return res;
}

function parseUrl(req) {
  return new URL(req.url, `http://${req.headers.host || 'localhost'}`);
}

/* --------------------------- api dispatch --------------------------- */

const REWRITES = [
  { pattern: /^\/pandaviki001stores\/?$/, target: () => '/pandaviki001stores.html' },
  { pattern: /^\/pandaviki001stores\/.+$/, target: () => '/pandaviki001stores.html' },
  { pattern: /^\/account\/([^/]+)\/?$/, target: (m) => `/product.html?id=${encodeURIComponent(m[1])}` },
  { pattern: /^\/sell-account\/?$/, target: () => '/sell.html' },
  { pattern: /^\/support\/?$/, target: () => '/contact.html' },
];

async function loadHandler(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return null;
  const mod = await import(`${pathToFileURL(abs).href}?t=${Date.now()}`);
  return mod.default || mod.handler || null;
}

async function handleApi(req, res, pathname, url) {
  const trimmed = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  const segments = trimmed.split('/');

  const candidates = [];
  if (segments.length === 1) {
    candidates.push(`api/${segments[0]}.js`, `api/${segments[0]}/index.js`);
  } else {
    const [dir, ...rest] = segments;
    candidates.push(`api/${dir}/${rest.join('/')}.js`);
    if (rest.length === 1) candidates.push(`api/${dir}/[id].js`);
  }

  let handler = null;
  let usedPath = null;
  for (const candidate of candidates) {
    handler = await loadHandler(candidate);
    if (handler) {
      usedPath = candidate;
      break;
    }
  }

  if (!handler) {
    res.status(404).json({ ok: false, error: `No API route for ${pathname}` });
    return;
  }

  const query = Object.fromEntries(url.searchParams.entries());
  if (usedPath && usedPath.includes('[id]')) {
    query.id = segments[segments.length - 1];
  }
  req.query = query;

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

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  if (rel.endsWith('/')) rel += 'index.html';
  const abs = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));

  if (!abs.startsWith(ROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return false;

  const ext = path.extname(abs).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=60');
  fs.createReadStream(abs).pipe(res);
  return true;
}

/* ----------------------------- server ----------------------------- */

const server = http.createServer(async (req, res) => {
  const url = parseUrl(req);
  let pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname, url);
      return;
    }

    for (const rule of REWRITES) {
      const m = pathname.match(rule.pattern);
      if (m) {
        const rewritten = rule.target(m);
        const [nextPath, nextQuery] = rewritten.split('?');
        pathname = nextPath;
        if (nextQuery) {
          for (const [k, v] of new URLSearchParams(nextQuery)) url.searchParams.set(k, v);
        }
        break;
      }
    }

    if (serveStatic(req, res, pathname)) return;
    if (!path.extname(pathname) && serveStatic(req, res, `${pathname}.html`)) return;

    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      `<h1 style="font-family:sans-serif">404 — not found</h1><p style="font-family:sans-serif">${pathname}</p>`
    );
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
  console.log(`    Admin:  http://localhost:${PORT}/pandaviki001stores`);
  console.log(`    API:    http://localhost:${PORT}/api/health\n`);
});
