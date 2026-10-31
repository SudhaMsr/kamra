// Minimal static server for the built site (used by end-to-end tests). Usage: node scripts/serve.mjs [port]
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../dist");
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".json": "application/json", ".png": "image/png" };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://x");
    const file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    const stat = await fs.stat(file).catch(() => null);
    const target = stat?.isDirectory() ? path.join(file, "index.html") : stat ? file : path.join(root, "404.html");
    const body = await fs.readFile(target);
    res.writeHead(stat ? 200 : 404, { "content-type": TYPES[path.extname(target)] ?? "application/octet-stream", "cache-control": "no-store" }).end(body);
  } catch { res.writeHead(500).end("error"); }
}).listen(port, "127.0.0.1", () => console.log(`serving dist on http://127.0.0.1:${port}`));
