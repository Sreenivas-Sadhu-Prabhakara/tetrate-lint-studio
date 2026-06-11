/*
 * Compile the bundled Spectral ruleset from rules/base.json + rules/custom/*.json.
 *
 * Each file in rules/custom/ is a "studio spec": the Spectral rule fields
 * (given/severity/then/message/description) plus studio metadata (name,
 * templateId, params). This module extracts the Spectral fields and merges them
 * with the base ruleset into a single ruleset object the Spectral CLI can load.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const RULES_DIR = path.join(__dirname, "..", "rules");
const CUSTOM_DIR = path.join(RULES_DIR, "custom");
const BASE_PATH = path.join(RULES_DIR, "base.json");

function loadBase() {
  try {
    return JSON.parse(fs.readFileSync(BASE_PATH, "utf8"));
  } catch {
    return {};
  }
}

// Studio spec -> plain Spectral rule (drop studio-only metadata).
function toSpectralRule(spec) {
  const rule = {
    description: spec.description || spec.name,
    given: spec.given,
    severity: spec.severity || "warn",
    then: spec.then,
  };
  if (spec.message) rule.message = spec.message;
  if (spec.resolved !== undefined) rule.resolved = spec.resolved;
  if (spec.formats) rule.formats = spec.formats;
  return rule;
}

function loadCustomSpecs() {
  if (!fs.existsSync(CUSTOM_DIR)) return [];
  return fs
    .readdirSync(CUSTOM_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(CUSTOM_DIR, f), "utf8")));
}

function buildRuleset() {
  const base = loadBase();
  const rules = { ...(base.rules || {}) };
  for (const spec of loadCustomSpecs()) {
    if (spec && spec.name) rules[spec.name] = toSpectralRule(spec);
  }
  return { ...base, rules };
}

// Write the compiled ruleset to a temp file and return its path.
function writeCompiled() {
  const ruleset = buildRuleset();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tetrate-lint-"));
  const p = path.join(dir, "ruleset.json");
  fs.writeFileSync(p, JSON.stringify(ruleset, null, 2), "utf8");
  return p;
}

module.exports = { buildRuleset, writeCompiled, loadCustomSpecs, RULES_DIR, CUSTOM_DIR };
