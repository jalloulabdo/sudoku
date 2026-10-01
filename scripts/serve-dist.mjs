// Minimal static server for dist/, behaving like a typical static host: brotli/gzip
// compression, clean URLs (/fr/daily → fr/daily/index.html), long-lived caching for hashed
// assets and an SPA fallback to index.html. Used for Lighthouse audits.
// Run: node scripts/serve-dist.mjs [port]
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const ROOT = 'dist';
const PORT = Number(process.argv[2] ?? 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.xml', '.txt']);

function resolveFile(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  for (const candidate of [safe, join(safe, 'index.html')]) {
    const file = join(ROOT, candidate);
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const file = resolveFile(pathname) ?? join(ROOT, 'index.html');
  const ext = extname(file);
  let body = readFileSync(file);
  const headers = { 'Content-Type': TYPES[ext] ?? 'application/octet-stream', Vary: 'Accept-Encoding' };
  headers['Cache-Control'] = file.includes(`${ROOT}/assets/`) ? 'public, max-age=31536000, immutable' : 'no-cache';

  const accept = String(req.headers['accept-encoding'] ?? '');
  if (COMPRESSIBLE.has(ext)) {
    if (accept.includes('br')) {
      body = brotliCompressSync(body);
      headers['Content-Encoding'] = 'br';
    } else if (accept.includes('gzip')) {
      body = gzipSync(body);
      headers['Content-Encoding'] = 'gzip';
    }
  }
  res.writeHead(200, headers);
  res.end(body);
}).listen(PORT, () => console.log(`serving ${ROOT}/ on http://localhost:${PORT}`));
