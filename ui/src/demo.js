/*
 * Demo mode — lets the UI be browsed as a static site (GitHub Pages) with no
 * backend. GET data is canned; the Validate preview builds the Spectral rule
 * YAML client-side; mutating actions are disabled with a message.
 *
 * Active when built with VITE_DEMO=1 or when served from *.github.io.
 */
export const DEMO_MODE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_DEMO === "1") ||
  (typeof location !== "undefined" && /github\.io$/.test(location.hostname));

export const MUTATION_MSG =
  "Demo mode — this is a static preview with no backend, so authoring/building is disabled. Clone the repo and run it locally (npm start) to author rules and build the CLI.";

const CASING_TYPES = ["flat", "camel", "pascal", "kebab", "snake", "macro", "cobol"];
const SEVERITIES = ["error", "warn", "info", "hint", "off"];

const undef = (v) => (v === "" || v == null ? undefined : v);
const num = (v) => (v === "" || v == null ? undefined : Number(v));

const TEMPLATES = [
  { id: "field-truthy", label: "Field must be present & truthy", description: "Flags when the target (or a named field) is missing, empty, false, or 0.", advanced: false, params: [{ name: "field", label: "Field of the matched object (optional)", type: "string", required: false, placeholder: "contact" }] },
  { id: "field-defined", label: "Field must be defined", description: "Flags when the field is absent (undefined). Empty/false values pass.", advanced: false, params: [{ name: "field", label: "Field (optional)", type: "string", required: false, placeholder: "license" }] },
  { id: "field-falsy", label: "Field must be absent / falsy", description: "Flags when the field IS present/truthy — use to forbid something.", advanced: false, params: [{ name: "field", label: "Field (optional)", type: "string", required: false, placeholder: "deprecated" }] },
  { id: "field-pattern", label: "Value must match / not match a regex", description: "Apply a regex to the matched value or a named field.", advanced: false, params: [{ name: "field", label: "Field (optional)", type: "string", required: false, placeholder: "" }, { name: "match", label: "Must match (regex)", type: "string", required: false, placeholder: "^/v[0-9]+" }, { name: "notMatch", label: "Must NOT match (regex)", type: "string", required: false, placeholder: "^\\*$" }] },
  { id: "casing", label: "Value must follow a casing style", description: "Enforce camelCase / kebab-case / snake_case etc.", advanced: false, params: [{ name: "field", label: "Field (optional)", type: "string", required: false, placeholder: "" }, { name: "type", label: "Casing", type: "enum", required: true, options: CASING_TYPES, placeholder: "camel" }] },
  { id: "enumeration", label: "Value must be one of a set", description: "Restrict the matched value (or field) to an allowed list.", advanced: false, params: [{ name: "field", label: "Field (optional)", type: "string", required: false, placeholder: "" }, { name: "values", label: "Allowed values (comma-separated)", type: "string", required: true, placeholder: "GET, POST, PUT" }] },
  { id: "length", label: "Length within bounds", description: "Constrain string length or array/object size.", advanced: false, params: [{ name: "field", label: "Field (optional)", type: "string", required: false, placeholder: "" }, { name: "min", label: "Min", type: "number", required: false, placeholder: "1" }, { name: "max", label: "Max", type: "number", required: false, placeholder: "60" }] },
  { id: "advanced", label: "Advanced — write the `then` clause", description: "Full control over the Spectral `then` clause as JSON.", advanced: true, params: [{ name: "then", label: "then (JSON)", type: "code", required: true, placeholder: '{\n  "field": "summary",\n  "function": "truthy"\n}' }] },
];

const CUSTOM = [
  { name: "gateway-no-wildcard-host", description: "Gateway servers must not expose a wildcard host ('*').", given: "$.spec.servers[*].hosts[*]", severity: "error", templateId: "field-pattern", params: { notMatch: "^\\*$" }, message: "{{description}} (at {{path}})", then: { function: "pattern", functionOptions: { notMatch: "^\\*$" } }, editable: true },
  { name: "istio-http-route-timeout", description: "Istio VirtualService HTTP routes should set an explicit timeout.", given: "$.spec.http[*]", severity: "warn", templateId: "field-truthy", params: { field: "timeout" }, message: "{{description}} (at {{path}})", then: { field: "timeout", function: "truthy" }, editable: true },
  { name: "k8s-require-app-label", description: "Kubernetes/Istio resources should carry an 'app' label.", given: "$.metadata.labels", severity: "warn", templateId: "field-truthy", params: { field: "app" }, message: "{{description}} (at {{path}})", then: { field: "app", function: "truthy" }, editable: true },
  { name: "openapi-info-contact", description: "OpenAPI documents should declare an info.contact.", given: "$.info", severity: "warn", templateId: "field-truthy", params: { field: "contact" }, message: "{{description}} (at {{path}})", then: { field: "contact", function: "truthy" }, editable: true },
];

// --- client-side rule builder + YAML, just for the demo preview --------------
function buildThen(templateId, p = {}) {
  switch (templateId) {
    case "field-defined": return { field: undef(p.field), function: "defined" };
    case "field-falsy": return { field: undef(p.field), function: "falsy" };
    case "field-pattern": {
      const fo = {};
      if (undef(p.match)) fo.match = p.match;
      if (undef(p.notMatch)) fo.notMatch = p.notMatch;
      return { field: undef(p.field), function: "pattern", functionOptions: fo };
    }
    case "casing": return { field: undef(p.field), function: "casing", functionOptions: { type: p.type || "camel" } };
    case "enumeration": return { field: undef(p.field), function: "enumeration", functionOptions: { values: String(p.values || "").split(",").map((s) => s.trim()).filter(Boolean) } };
    case "length": {
      const fo = {};
      if (num(p.min) !== undefined) fo.min = num(p.min);
      if (num(p.max) !== undefined) fo.max = num(p.max);
      return { field: undef(p.field), function: "length", functionOptions: fo };
    }
    case "advanced": try { return JSON.parse(p.then || "{}"); } catch { return { function: "truthy" }; }
    default: return { field: undef(p.field), function: "truthy" };
  }
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function thenYaml(then) {
  const t = Array.isArray(then) ? then[0] : then;
  const L = [];
  if (t.field) L.push(`      field: ${t.field}`);
  L.push(`      function: ${t.function}`);
  const fo = t.functionOptions || {};
  if (Object.keys(fo).length) {
    L.push("      functionOptions:");
    for (const [k, v] of Object.entries(fo)) {
      if (Array.isArray(v)) {
        L.push(`        ${k}:`);
        v.forEach((x) => L.push(`          - ${x}`));
      } else {
        L.push(`        ${k}: ${q(v)}`);
      }
    }
  }
  return L.join("\n");
}

function toYaml(form) {
  const then = buildThen(form.templateId, form.params);
  const L = ["rules:", `  ${form.name || "my-rule"}:`];
  L.push(`    description: ${q(form.description || form.name || "")}`);
  if (form.message) L.push(`    message: ${q(form.message)}`);
  L.push(`    given: ${q(form.given || "$")}`);
  L.push(`    severity: ${form.severity || "warn"}`);
  L.push("    then:");
  L.push(thenYaml(then));
  return L.join("\n") + "\n";
}

export const demo = {
  templates: () => ({ templates: TEMPLATES, severities: SEVERITIES, casingTypes: CASING_TYPES }),
  rules: () => ({ custom: CUSTOM.map((r) => ({ ...r })), inherited: [] }),
  rule: (name) => {
    const r = CUSTOM.find((x) => x.name === name) || CUSTOM[0];
    return { ...r };
  },
  validate: (form) => ({
    ok: true,
    ruleName: form.name,
    firedCount: 1,
    findings: [{ source: "sample-istio.yaml", message: "(demo) example finding for this rule on the sample configs" }],
    code: toYaml(form),
  }),
  cli: () => ({ name: "tetrate-lint", version: "1.0.1", bin: "tetrate-lint", customRuleCount: CUSTOM.length, artifacts: [] }),
};
