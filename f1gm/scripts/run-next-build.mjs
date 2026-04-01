/**
 * Normalize the project directory to the real filesystem path (canonical casing on Windows)
 * before Next.js starts. Mixed `...\F1GM\...` vs `...\f1gm\...` paths load duplicate copies of
 * `next`/`react` and break AsyncLocalStorage singletons during prerender.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let canonical = root;
try {
  canonical = fs.realpathSync.native(root);
} catch {
  /* keep root */
}

process.chdir(canonical);

const nextCli = path.join(canonical, "node_modules", "next", "dist", "bin", "next");
const result = spawnSync(process.execPath, [nextCli, "build", ...process.argv.slice(2)], {
  cwd: canonical,
  stdio: "inherit",
  env: { ...process.env, INIT_CWD: canonical },
});

process.exit(result.status ?? 1);
