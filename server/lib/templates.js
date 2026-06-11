/*
 * Spectral rule templates for the Lint Studio.
 *
 * Every Spectral rule shares four top-level fields the UI collects directly:
 * name, description, given (JSONPath) and severity. A template only decides the
 * `then` clause — which Spectral function runs and with what options.
 */

// Spectral severities.
const SEVERITIES = ["error", "warn", "info", "hint", "off"];

const CASING_TYPES = ["flat", "camel", "pascal", "kebab", "snake", "macro", "cobol"];

const num = (v) => (v === "" || v == null ? undefined : Number(v));
const undef = (v) => (v === "" || v == null ? undefined : v);

const TEMPLATES = [
  {
    id: "field-truthy",
    label: "Field must be present & truthy",
    description: "Flags when the target (or a named field of it) is missing, empty, false, or 0.",
    params: [
      { name: "field", label: "Field of the matched object (optional)", type: "string", required: false, placeholder: "contact" },
    ],
    buildThen: (p) => ({ field: undef(p.field), function: "truthy" }),
  },
  {
    id: "field-defined",
    label: "Field must be defined",
    description: "Flags when the field is absent (undefined). Unlike truthy, empty/false values pass.",
    params: [
      { name: "field", label: "Field of the matched object (optional)", type: "string", required: false, placeholder: "license" },
    ],
    buildThen: (p) => ({ field: undef(p.field), function: "defined" }),
  },
  {
    id: "field-falsy",
    label: "Field must be absent / falsy",
    description: "Flags when the field IS present/truthy — use to forbid something.",
    params: [
      { name: "field", label: "Field of the matched object (optional)", type: "string", required: false, placeholder: "deprecated" },
    ],
    buildThen: (p) => ({ field: undef(p.field), function: "falsy" }),
  },
  {
    id: "field-pattern",
    label: "Value must match / not match a regex",
    description: "Apply a regular expression to the matched value (or a named field).",
    params: [
      { name: "field", label: "Field (optional)", type: "string", required: false, placeholder: "" },
      { name: "match", label: "Must match (regex)", type: "string", required: false, placeholder: "^/v[0-9]+" },
      { name: "notMatch", label: "Must NOT match (regex)", type: "string", required: false, placeholder: "^\\*$" },
    ],
    buildThen: (p) => {
      const functionOptions = {};
      if (undef(p.match)) functionOptions.match = p.match;
      if (undef(p.notMatch)) functionOptions.notMatch = p.notMatch;
      return { field: undef(p.field), function: "pattern", functionOptions };
    },
  },
  {
    id: "casing",
    label: "Value must follow a casing style",
    description: "Enforce camelCase / kebab-case / snake_case etc. on the matched value or field.",
    params: [
      { name: "field", label: "Field (optional)", type: "string", required: false, placeholder: "" },
      { name: "type", label: "Casing", type: "enum", required: true, options: CASING_TYPES, placeholder: "camel" },
    ],
    buildThen: (p) => ({ field: undef(p.field), function: "casing", functionOptions: { type: p.type || "camel" } }),
  },
  {
    id: "enumeration",
    label: "Value must be one of a set",
    description: "Restrict the matched value (or field) to an allowed list.",
    params: [
      { name: "field", label: "Field (optional)", type: "string", required: false, placeholder: "" },
      { name: "values", label: "Allowed values (comma-separated)", type: "string", required: true, placeholder: "GET, POST, PUT, DELETE" },
    ],
    buildThen: (p) => ({
      field: undef(p.field),
      function: "enumeration",
      functionOptions: { values: String(p.values || "").split(",").map((s) => s.trim()).filter(Boolean) },
    }),
  },
  {
    id: "length",
    label: "Length within bounds",
    description: "Constrain string length or array/object size of the matched value or field.",
    params: [
      { name: "field", label: "Field (optional)", type: "string", required: false, placeholder: "" },
      { name: "min", label: "Min", type: "number", required: false, placeholder: "1" },
      { name: "max", label: "Max", type: "number", required: false, placeholder: "60" },
    ],
    buildThen: (p) => {
      const functionOptions = {};
      if (num(p.min) !== undefined) functionOptions.min = num(p.min);
      if (num(p.max) !== undefined) functionOptions.max = num(p.max);
      return { field: undef(p.field), function: "length", functionOptions };
    },
  },
  {
    id: "advanced",
    label: "Advanced — write the `then` clause",
    description:
      "Full control over the Spectral `then` clause. Provide JSON, e.g. {\"field\":\"x\",\"function\":\"pattern\",\"functionOptions\":{\"match\":\"^a\"}}. Supports an array of clauses too.",
    advanced: true,
    params: [
      {
        name: "then",
        label: "then (JSON)",
        type: "code",
        required: true,
        placeholder: '{\n  "field": "summary",\n  "function": "truthy"\n}',
      },
    ],
    buildThen: (p) => JSON.parse(p.then),
  },
];

const byId = (id) => TEMPLATES.find((t) => t.id === id);

module.exports = { TEMPLATES, byId, SEVERITIES, CASING_TYPES };
