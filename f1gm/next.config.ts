import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

try {
  process.chdir(fs.realpathSync.native(process.cwd()));
} catch {
  /* ignore */
}

/**
 * On Windows, the same folder can appear as `...\F1GM\...` vs `...\f1gm\...`, which makes
 * webpack load two copies of `next` / `react` and breaks AsyncLocalStorage singletons
 * (`workUnitAsyncStorage` / `workStore` during prerender). Normalize to the real path.
 */
function canonicalPath(p: string): string {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return p;
  }
}

const configDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = canonicalPath(configDir);

function singletonAliases(nodeModules: string): Record<string, string> {
  return {
    next: path.join(nodeModules, "next"),
    react: path.join(nodeModules, "react"),
    "react-dom": path.join(nodeModules, "react-dom"),
    "react/jsx-runtime": path.join(nodeModules, "react", "jsx-runtime.js"),
    "react/jsx-dev-runtime": path.join(nodeModules, "react", "jsx-dev-runtime.js"),
  };
}

/** Turbopack: relative aliases only (no Windows absolute paths). */
const turbopackSingletonAliases: Record<string, string> = {
  next: "./node_modules/next",
  react: "./node_modules/react",
  "react-dom": "./node_modules/react-dom",
  "react/jsx-runtime": "./node_modules/react/jsx-runtime.js",
  "react/jsx-dev-runtime": "./node_modules/react/jsx-dev-runtime.js",
};

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: turbopackSingletonAliases,
    /** Single filesystem root so Turbopack does not mix casing variants. */
    root: projectRoot.replace(/\\/g, "/"),
  },
  webpack: (config, { dir }) => {
    const root = canonicalPath(dir);
    const nodeModules = path.join(root, "node_modules");
    const prevModules = config.resolve?.modules;
    const modules = Array.isArray(prevModules)
      ? prevModules
      : prevModules
        ? [prevModules]
        : ["node_modules"];

    config.resolve = config.resolve ?? {};
    config.resolve.modules = [nodeModules, ...modules];
    config.resolve.alias = {
      ...config.resolve.alias,
      ...singletonAliases(nodeModules),
    };
    return config;
  },
};

export default nextConfig;
