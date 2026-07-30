#!/usr/bin/env node
/**
 * server.mjs — Production static file server for Defend the North
 *
 * Serves the Vite build output (dist/public/) with a full suite of
 * security response headers. Zero external dependencies — built on
 * Node.js built-in modules only.
 *
 * Usage:
 *   node server.mjs              (defaults to port 5000)
 *   PORT=8080 node server.mjs
 *
 * Build first:
 *   pnpm --filter @workspace/defend-the-north run build
 */

import { createServer }                          from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, sep }          from 'node:path';
import { fileURLToPath }                          from 'node:url';

/* ── Configuration ────────────────────────────────────────────────── */

const __dir = fileURLToPath(new URL('.', import.meta.url));
const DIST  = join(__dir, 'dist', 'public');
const PORT  = parseInt(process.env.PORT ?? '5000', 10);

if (Number.isNaN(PORT) || PORT <= 0 || PORT > 65535) {
  console.error(`Invalid PORT value: "${process.env.PORT}"`);
  process.exit(1);
}

/* ── MIME types ───────────────────────────────────────────────────── */

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.js':    'text/javascript; charset=utf-8',
  '.mjs':   'text/javascript; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.webp':  'image/webp',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.txt':   'text/plain; charset=utf-8',
  '.map':   'application/json; charset=utf-8',
};

/* ── Security headers ─────────────────────────────────────────────── */

const STRICT_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ');

/** Files that must never be served from a cache. */
const NO_STORE = new Set(['index.html', 'robots.txt', 'security.txt']);

/** Build the response header set for a given resolved file path. */
function buildHeaders(resolvedPath, contentType, contentLength) {
  const base    = resolvedPath.split(sep).pop() ?? '';
  const noStore = NO_STORE.has(base);

  return {
    'Content-Type':                  contentType,
    'Content-Length':                String(contentLength),
    // Security headers
    'Content-Security-Policy':       STRICT_CSP,
    'Strict-Transport-Security':     'max-age=63072000; includeSubDomains; preload',
    'X-Frame-Options':               'DENY',
    'X-Content-Type-Options':        'nosniff',
    'Referrer-Policy':               'no-referrer',
    'Permissions-Policy':            'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy':    'same-origin',
    'Cross-Origin-Resource-Policy':  'same-origin',
    'X-XSS-Protection':              '0',
    // Caching
    'Cache-Control': noStore
      ? 'no-store'
      : 'public, max-age=31536000, immutable',
  };
}

/** Minimal security headers for error responses. */
const ERROR_HEADERS = {
  'Content-Type':                 'text/plain; charset=utf-8',
  'X-Content-Type-Options':       'nosniff',
  'X-Frame-Options':              'DENY',
  'Content-Security-Policy':      STRICT_CSP,
  'Cache-Control':                'no-store',
};

/* ── Path resolution with traversal prevention ────────────────────── */

/**
 * Safely resolve a URL path to an absolute filesystem path inside DIST.
 * Returns null for any path that would escape DIST or is malformed.
 * @param {string} urlPath
 * @returns {string|null}
 */
function safeResolve(urlPath) {
  // Strip query string and fragment
  const raw = urlPath.split('?')[0].split('#')[0];

  // Decode percent-encoding; reject malformed URIs
  let decoded;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  // Strip the leading slash so join() treats it as relative to DIST
  const relative = decoded.startsWith('/') ? decoded.slice(1) : decoded;

  // join() resolves '..' components; normalize() collapses redundant separators
  const resolved = join(DIST, normalize(relative));

  // Ensure the result is DIST itself or a descendant
  if (resolved !== DIST && !resolved.startsWith(DIST + sep)) {
    return null; // Path traversal attempt
  }

  return resolved;
}

/* ── File serving ─────────────────────────────────────────────────── */

/** Serve a file that is confirmed to exist. */
function serveFile(res, absPath, method) {
  let stat;
  try {
    stat = statSync(absPath);
  } catch {
    res.writeHead(404, ERROR_HEADERS);
    res.end('Not Found');
    return;
  }

  const ext         = extname(absPath).toLowerCase();
  const contentType = MIME[ext] ?? 'application/octet-stream';
  const headers     = buildHeaders(absPath, contentType, stat.size);

  res.writeHead(200, headers);

  if (method === 'HEAD') {
    res.end();
    return;
  }

  const stream = createReadStream(absPath);
  stream.on('error', () => res.destroy()); // headers already sent; close cleanly
  stream.pipe(res);
}

/* ── Request handler ──────────────────────────────────────────────── */

const server = createServer((req, res) => {
  const method = (req.method ?? 'GET').toUpperCase();

  // Only GET and HEAD are supported
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { ...ERROR_HEADERS, Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  const urlPath  = req.url ?? '/';
  const resolved = safeResolve(urlPath);

  if (!resolved) {
    res.writeHead(400, ERROR_HEADERS);
    res.end('Bad Request');
    return;
  }

  // 1. Exact file match
  if (existsSync(resolved) && statSync(resolved).isFile()) {
    serveFile(res, resolved, method);
    return;
  }

  // 2. Directory → try index.html inside it
  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    const idx = join(resolved, 'index.html');
    if (existsSync(idx)) {
      serveFile(res, idx, method);
      return;
    }
  }

  // 3. Path with no extension → SPA fallback (valid client-side routes)
  const pathExt = extname(urlPath.split('?')[0]);
  if (!pathExt) {
    const rootIndex = join(DIST, 'index.html');
    if (existsSync(rootIndex)) {
      serveFile(res, rootIndex, method);
      return;
    }
  }

  // 4. Static asset not found → strict 404 (no SPA fallback for asset requests)
  res.writeHead(404, ERROR_HEADERS);
  res.end('Not Found');
});

/* ── Start ────────────────────────────────────────────────────────── */

server.on('error', (err) => {
  // Log error details server-side only; never expose to clients
  console.error('[server] Error:', err.message);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Defend the North running on port ${PORT}`);
  console.log(`[server] Serving: ${DIST}`);
});
