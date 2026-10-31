// Production build: esbuild for TypeScript/React, Tailwind v4 compiler for CSS, content-hashed assets.
import { build, transform } from "esbuild";
import { compile } from "tailwindcss";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "dist");
const require = createRequire(import.meta.url);
const twDir = path.dirname(require.resolve("tailwindcss/package.json"));
const watch = process.argv.includes("--dev");

async function walk(dir) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(items.map((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])))).flat();
}
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 10);

async function css() {
  const files = (await walk(path.join(root, "src"))).filter((f) => /\.(tsx?|html)$/.test(f));
  files.push(path.join(root, "index.html"));
  const candidates = new Set();
  for (const f of files) for (const t of (await fs.readFile(f, "utf8")).split(/[\s"'`{}<>;=]+/)) if (t && t.length < 120) candidates.add(t);
  const source = await fs.readFile(path.join(root, "src/styles.css"), "utf8");
  const compiler = await compile(source, {
    base: root,
    loadStylesheet: async (id) => {
      const file = id === "tailwindcss" ? path.join(twDir, "index.css") : path.join(twDir, id.replace(/^tailwindcss\//, "") + (id.endsWith(".css") ? "" : ".css"));
      return { path: file, base: twDir, content: await fs.readFile(file, "utf8") };
    },
  });
  const raw = compiler.build([...candidates]);
  const { code } = await transform(raw, { loader: "css", minify: !watch, target: ["chrome100", "safari15", "firefox100"] });
  return code;
}

async function js() {
  const r = await build({
    entryPoints: [path.join(root, "src/main.tsx")], bundle: true, write: false, format: "esm",
    minify: !watch, sourcemap: watch ? "inline" : false, target: ["chrome100", "safari15", "firefox100"],
    jsx: "automatic", define: { "process.env.NODE_ENV": JSON.stringify(watch ? "development" : "production") },
    legalComments: "none", metafile: true, logLevel: "warning",
  });
  return r.outputFiles[0].text;
}

const t0 = Date.now();
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, "assets"), { recursive: true });
let cssCode, jsCode;
try { [cssCode, jsCode] = await Promise.all([css(), js()]); }
catch (e) { console.error("Build failed:", String(e.message ?? e).split("\n").slice(-3).join("\n")); process.exit(1); }
const cssName = `assets/app-${hash(cssCode)}.css`;
const jsName = `assets/app-${hash(jsCode)}.js`;
await fs.writeFile(path.join(out, cssName), cssCode);
await fs.writeFile(path.join(out, jsName), jsCode);

const html = (await fs.readFile(path.join(root, "index.html"), "utf8"))
  .replace("<!--CSS-->", `<link rel="stylesheet" href="./${cssName}">`)
  .replace("<!--JS-->", `<script type="module" src="./${jsName}"></script>`);
await fs.writeFile(path.join(out, "index.html"), html);
await fs.writeFile(path.join(out, "404.html"), html);
await fs.writeFile(path.join(out, ".nojekyll"), "");
for (const f of await fs.readdir(path.join(root, "public"))) await fs.copyFile(path.join(root, "public", f), path.join(out, f));

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + " kB";
console.log(`built in ${Date.now() - t0} ms  js ${kb(jsCode)}  css ${kb(cssCode)}`);
