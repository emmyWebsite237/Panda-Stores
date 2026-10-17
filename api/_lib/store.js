/**
 * Persistence adapter.
 *
 * Order of preference:
 *   1. Supabase  (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *   2. Upstash   (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 *   3. In-memory (demo mode — resets on redeploy / cold start)
 *
 * The whole store lives in ONE document so reads are a single round trip
 * and writes can never half-apply across collections.
 */

import { seedDoc, DEFAULT_SETTINGS } from './seed.js';

const DOC_KEY = 'panda-store-doc-v1';
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'panda_store';

/* ---------------------------------------------------------------- *
 * demo-mode cache (also used to de-duplicate reads in one invocation)
 * ---------------------------------------------------------------- */
const g = globalThis;
if (!g.__pandaStoreCache) g.__pandaStoreCache = { doc: null, dirty: false };

export function storageMode() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return 'supabase';
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return 'upstash';
  return 'memory';
}

/* ---------------------------------------------------------------- *
 * Supabase REST helpers
 * ---------------------------------------------------------------- */
function sbHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

function sbUrl(path = '') {
  return `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${SUPABASE_TABLE}${path}`;
}

async function sbRead() {
  const res = await fetch(sbUrl(`?key=eq.${encodeURIComponent(DOC_KEY)}&select=value`), {
    headers: sbHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase read failed (${res.status}): ${await res.text()}`);
  const rows = await res.json();
  return rows?.[0]?.value || null;
}

async function sbWrite(doc) {
  const res = await fetch(sbUrl('?on_conflict=key'), {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key: DOC_KEY, value: doc, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) throw new Error(`Supabase write failed (${res.status}): ${await res.text()}`);
}

/* ---------------------------------------------------------------- *
 * Upstash helpers
 * ---------------------------------------------------------------- */
function upstashCmd(args) {
  return fetch(process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, ''), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
}

async function upRead() {
  const res = await upstashCmd(['GET', DOC_KEY]);
  if (!res.ok) throw new Error(`Upstash read failed (${res.status})`);
  const { result } = await res.json();
  return result ? JSON.parse(result) : null;
}

async function upWrite(doc) {
  const res = await upstashCmd(['SET', DOC_KEY, JSON.stringify(doc)]);
  if (!res.ok) throw new Error(`Upstash write failed (${res.status})`);
}

/* ---------------------------------------------------------------- *
 * Document shape normalisation
 * ---------------------------------------------------------------- */
function normalise(raw) {
  const base = seedDoc();
  if (!raw || typeof raw !== 'object') return base;
  return {
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings || {}) },
    products: Array.isArray(raw.products) ? raw.products : base.products,
    updatedAt: raw.updatedAt || base.updatedAt,
  };
}

/* ---------------------------------------------------------------- *
 * Public API
 * ---------------------------------------------------------------- */
export async function readStore({ fresh = false } = {}) {
  const mode = storageMode();

  // Demo mode has no external store: the in-process cache IS the database.
  if (mode === 'memory') {
    if (!g.__pandaStoreCache.doc) g.__pandaStoreCache.doc = seedDoc();
    return g.__pandaStoreCache.doc;
  }

  if (!fresh && g.__pandaStoreCache.doc) return g.__pandaStoreCache.doc;

  let doc = null;

  try {
    if (mode === 'supabase') doc = await sbRead();
    else if (mode === 'upstash') doc = await upRead();
  } catch (err) {
    // Never take the storefront down because the DB hiccuped.
    console.error('[panda-store] read failed, falling back:', err.message);
  }

  const resolved = normalise(doc);
  g.__pandaStoreCache.doc = resolved;

  // First run against an empty database: persist the seed so IDs are stable.
  if (!doc && mode !== 'memory') {
    try {
      await writeStore(resolved);
    } catch (err) {
      console.error('[panda-store] seeding failed:', err.message);
    }
  }
  return resolved;
}

export async function writeStore(doc) {
  const next = { ...doc, updatedAt: new Date().toISOString() };
  g.__pandaStoreCache.doc = next;
  const mode = storageMode();
  if (mode === 'supabase') await sbWrite(next);
  else if (mode === 'upstash') await upWrite(next);
  return next;
}

/**
 * Read-modify-write helper. Keeps concurrent edits from clobbering each
 * other's unrelated fields as much as a single-document store allows.
 */
export async function updateStore(mutator) {
  const current = await readStore({ fresh: true });
  const draft = {
    settings: { ...current.settings },
    products: current.products.map((p) => ({ ...p })),
    updatedAt: current.updatedAt,
  };
  const result = (await mutator(draft)) || draft;
  return writeStore(result);
}

export function publicSettings(settings) {
  // Nothing secret currently lives in settings, but this keeps the shape
  // explicit so adding a private field later never leaks by accident.
  const {
    googleFormSellUrl,
    googleFormContactUrl,
    ...rest
  } = settings || {};
  return {
    ...rest,
    googleFormSellUrl: googleFormSellUrl || '',
    googleFormContactUrl: googleFormContactUrl || '',
  };
}
