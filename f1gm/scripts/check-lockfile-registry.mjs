import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const lockPath = path.join(root, "package-lock.json");
const pkgPath = path.join(root, "package.json");

const allowedHosts = new Set(["registry.npmjs.org"]);


const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const requiredRuntimeDeps = ["next", "react", "react-dom"];
const requiredDevDeps = [
  "eslint",
  "eslint-config-next",
  "typescript",
  "tailwindcss",
  "@tailwindcss/postcss",
  "@types/node",
  "@types/react",
  "@types/react-dom",
];

const runtimeDeps = pkg.dependencies ?? {};
const devDeps = pkg.devDependencies ?? {};

const violations = [];

for (const dep of requiredRuntimeDeps) {
  if (typeof runtimeDeps[dep] !== "string" || runtimeDeps[dep].length === 0) {
    violations.push({ name: `dependencies.${dep}`, resolved: String(runtimeDeps[dep]), reason: "missing required runtime dependency" });
  }
}

for (const dep of requiredDevDeps) {
  if (typeof devDeps[dep] !== "string" || devDeps[dep].length === 0) {
    violations.push({ name: `devDependencies.${dep}`, resolved: String(devDeps[dep]), reason: "missing required dev dependency" });
  }
}

for (const [name, entry] of Object.entries(lock.packages ?? {})) {
  const resolved = entry?.resolved;
  if (typeof resolved !== "string") continue;

  if (!resolved.startsWith("https://")) {
    violations.push({ name, resolved, reason: "non-https resolved URL" });
    continue;
  }

  let host;
  try {
    host = new URL(resolved).host;
  } catch {
    violations.push({ name, resolved, reason: "invalid resolved URL" });
    continue;
  }

  if (!allowedHosts.has(host)) {
    violations.push({ name, resolved, reason: `unexpected host: ${host}` });
  }
}

const dependencySections = ["dependencies", "devDependencies", "optionalDependencies"];
for (const section of dependencySections) {
  const deps = pkg[section] ?? {};
  for (const [name, spec] of Object.entries(deps)) {
    if (typeof spec !== "string") continue;
    if (spec.startsWith("git+") || spec.includes("github.com") || spec.startsWith("http://") || spec.startsWith("https://")) {
      violations.push({ name: `${section}.${name}`, resolved: spec, reason: "non-registry dependency spec" });
    }
  }
}

if (violations.length > 0) {
  console.error("Dependency source audit failed:");
  for (const violation of violations) {
    console.error(`- ${violation.name}: ${violation.resolved} (${violation.reason})`);
  }
  process.exit(1);
}

console.log("Dependency source audit passed: package.json + package-lock.json use public npm registry sources.");
