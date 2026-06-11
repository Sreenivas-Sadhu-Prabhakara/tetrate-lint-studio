#!/usr/bin/env node
/*
 * tetrate-lint — a thin wrapper over the Spectral CLI that auto-applies the
 * ruleset bundled with this package (compiled from rules/custom/*.json). Authored
 * rules therefore ship inside the CLI: a download just *has* them, no flags.
 *
 *   tetrate-lint <documents...> [--format json|stylish|...] [--ruleset <file>]
 *                [--no-bundled-rules] [--list]
 *
 * Unknown flags pass straight through to `spectral lint`.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { buildRuleset, writeCompiled } = require("./lib/compile");

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
  printHelp();
  process.exit(0);
}
if (argv.includes("--version") || argv.includes("-v")) {
  console.log(require("./package.json").version);
  process.exit(0);
}
if (argv.includes("--list")) {
  printList();
  process.exit(0);
}

let useBundled = true;
const pass = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--no-bundled-rules") {
    useBundled = false;
    continue;
  }
  if (a === "--ruleset" || a === "-r") {
    // user supplied their own ruleset; honor it instead of the bundled one
    useBundled = false;
    pass.push("--ruleset", argv[++i]);
    continue;
  }
  pass.push(a);
}

let spectral;
try {
  spectral = require.resolve("@stoplight/spectral-cli/dist/index.js");
} catch {
  console.error("Could not locate the Spectral CLI. Reinstall tetrate-lint.");
  process.exit(2);
}

const args = ["lint", ...pass];
if (useBundled) args.push("--ruleset", writeCompiled());

const res = spawnSync(process.execPath, [spectral, ...args], { stdio: "inherit" });
process.exit(res.status == null ? 1 : res.status);

function printList() {
  const rs = buildRuleset();
  const names = Object.keys(rs.rules || {});
  console.log(`tetrate-lint — ${names.length} bundled rule(s):\n`);
  for (const n of names) {
    const r = rs.rules[n];
    console.log(`  ${n}  [${r.severity || "warn"}]  ${r.description || ""}`);
  }
  if (rs.extends) console.log(`\nextends: ${JSON.stringify(rs.extends)}`);
}

function printHelp() {
  console.log(`tetrate-lint — Spectral-based linter with bundled Tetrate/Istio + OpenAPI rules.

Usage:
  tetrate-lint <documents...> [options]

Options:
  --format <fmt>          json | stylish | pretty | junit | html | sarix | ... (Spectral formats)
  --ruleset <file>        use your own ruleset instead of the bundled one
  --no-bundled-rules      do not apply the rules bundled with this CLI
  --list                  list the bundled rules and exit
  --version, -v           print version
  --help, -h              this help

Any other flags are passed through to 'spectral lint'.
Bundled rules apply automatically — a downloaded CLI already has your org's rules.`);
}
