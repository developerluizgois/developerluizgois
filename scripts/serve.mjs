import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
const root = new URL('../', import.meta.url);
const port = Number(process.env.PORT || 4173);
const publicFiles = new Set(['index.html', 'styles.css', 'main.js', 'config.js', 'contact.js']);
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.txt': 'text/plain' };
createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
    if (!publicFiles.has(path) && !/^assets\/[a-zA-Z0-9._-]+$/.test(path)) {
      res.writeHead(404).end('Not found'); return;
    }
    const body = await readFile(new URL(path, root));
    res.writeHead(200, { 'Content-Type': `${mime[extname(path)] || 'application/octet-stream'}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}`));
