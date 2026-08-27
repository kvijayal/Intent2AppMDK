// Small dependency-free filesystem helpers used by the Intent2App MCP tools.
import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_SKIP = ["node_modules", ".git", "gen", "dist", ".DS_Store"];

export async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

export async function readText(p) {
  return fs.readFile(p, "utf8");
}

export async function writeText(p, s) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, s, "utf8");
}

export async function appendText(p, s) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.appendFile(p, s, "utf8");
}

export async function readJSON(p) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}

export async function writeJSON(p, obj) {
  await writeText(p, JSON.stringify(obj, null, 2) + "\n");
}

/** Recursively copy a directory, skipping node_modules/.git/gen/dist. Returns copied file paths. */
export async function copyDir(src, dest, { skip = DEFAULT_SKIP } = {}) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await fs.mkdir(dest, { recursive: true });
  const copied = [];
  for (const e of entries) {
    if (skip.includes(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      copied.push(...(await copyDir(s, d, { skip })));
    } else {
      await fs.copyFile(s, d);
      copied.push(d);
    }
  }
  return copied;
}

/** Recursively list files under dir (skips node_modules/.git/gen/dist). */
export async function walk(dir, { skip = DEFAULT_SKIP } = {}) {
  const out = [];
  async function rec(d) {
    let entries;
    try { entries = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (skip.includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) await rec(p);
      else out.push(p);
    }
  }
  await rec(dir);
  return out;
}

/** Replace [from, to] string pairs in a file in place. */
export async function replaceInFile(p, replacements) {
  let s = await fs.readFile(p, "utf8");
  for (const [from, to] of replacements) s = s.split(from).join(to);
  await fs.writeFile(p, s, "utf8");
}
