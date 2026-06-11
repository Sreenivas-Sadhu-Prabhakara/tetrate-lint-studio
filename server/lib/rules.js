/*
 * Rule repository — the bridge between the UI and cli/rules/custom/.
 *
 * Each custom rule is one JSON "studio spec" file. The CLI compiles these into
 * its bundled ruleset at runtime, so anything written here ships in the next
 * packed/published CLI build.
 */
const fs = require("fs");
const path = require("path");
const { buildSpec } = require("./generator");

const CLI_DIR = path.resolve(__dirname, "../../cli");
const RULES_DIR = path.join(CLI_DIR, "rules");
const CUSTOM_DIR = path.join(RULES_DIR, "custom");
const BASE_PATH = path.join(RULES_DIR, "base.json");
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ensureDir = () => {
  if (!fs.existsSync(CUSTOM_DIR)) fs.mkdirSync(CUSTOM_DIR, { recursive: true });
};
const fileFor = (name) => path.join(CUSTOM_DIR, name + ".json");

function listCustomRules() {
  ensureDir();
  return fs
    .readdirSync(CUSTOM_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => {
      const s = JSON.parse(fs.readFileSync(path.join(CUSTOM_DIR, f), "utf8"));
      return {
        name: s.name,
        description: s.description,
        given: s.given,
        severity: s.severity,
        templateId: s.templateId || null,
        params: s.params || null,
        editable: !!s.templateId,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getCustomRule(name) {
  const p = fileFor(name);
  if (!fs.existsSync(p)) return null;
  const s = JSON.parse(fs.readFileSync(p, "utf8"));
  return { ...s, editable: !!s.templateId };
}

function loadBase() {
  try {
    return JSON.parse(fs.readFileSync(BASE_PATH, "utf8"));
  } catch {
    return {};
  }
}

// Rulesets the bundled ruleset inherits via `extends` (empty for Tetrate's
// generic base; populated for OpenAPI-focused setups that extend spectral:oas).
function listInherited() {
  const base = loadBase();
  const ext = base.extends ? (Array.isArray(base.extends) ? base.extends : [base.extends]) : [];
  return ext.map((e) => (Array.isArray(e) ? `${e[0]} (${e[1]})` : String(e)));
}

function saveRule(form) {
  ensureDir();
  const spec = buildSpec(form); // throws on invalid template/name/given
  if (!NAME_RE.test(spec.name)) {
    throw new Error("name must be kebab-case (lowercase letters, digits and dashes)");
  }
  const isNew = !form.originalName;
  const renamed = spec.name !== form.originalName;
  if (renamed && fs.existsSync(fileFor(spec.name))) {
    throw new Error(`a rule named "${spec.name}" already exists`);
  }
  fs.writeFileSync(fileFor(spec.name), JSON.stringify(spec, null, 2) + "\n", "utf8");
  if (form.originalName && renamed && fs.existsSync(fileFor(form.originalName))) {
    fs.unlinkSync(fileFor(form.originalName));
  }
  return { ...spec, editable: true, created: isNew };
}

function deleteRule(name) {
  const p = fileFor(name);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

module.exports = {
  CLI_DIR,
  RULES_DIR,
  CUSTOM_DIR,
  listCustomRules,
  getCustomRule,
  listInherited,
  saveRule,
  deleteRule,
};
