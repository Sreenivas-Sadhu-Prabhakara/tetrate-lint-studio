/*
 * Turn a UI form payload into a "studio spec" (stored as rules/custom/<name>.json)
 * and a Spectral rule / YAML preview.
 */
const yaml = require("js-yaml");
const { byId } = require("./templates");

// Keep only the keys Spectral allows in a `then` clause.
function cleanThen(then) {
  const one = (t) => {
    const o = {};
    if (t.field !== undefined && t.field !== "") o.field = t.field;
    o.function = t.function;
    if (t.functionOptions && Object.keys(t.functionOptions).length) {
      o.functionOptions = t.functionOptions;
    }
    return o;
  };
  return Array.isArray(then) ? then.map(one) : one(then);
}

function buildSpec(form) {
  const tmpl = byId(form.templateId);
  if (!tmpl) throw new Error("unknown template: " + form.templateId);
  if (!form.name || !String(form.name).trim()) throw new Error("name is required");
  if (!form.given || !String(form.given).trim()) throw new Error("given (JSONPath) is required");

  const then = cleanThen(tmpl.buildThen(form.params || {}));

  const spec = {
    name: String(form.name).trim(),
    description: form.description || form.name,
    given: form.given,
    severity: form.severity || "warn",
    templateId: form.templateId,
    params: form.params || {},
    then,
  };
  if (form.message) spec.message = form.message;
  return spec;
}

// Studio spec -> plain Spectral rule (the form the ruleset uses).
function toSpectralRule(spec) {
  const r = {
    description: spec.description,
    given: spec.given,
    severity: spec.severity,
    then: spec.then,
  };
  if (spec.message) r.message = spec.message;
  return r;
}

function toYaml(spec) {
  return yaml.dump({ rules: { [spec.name]: toSpectralRule(spec) } }, {
    lineWidth: 100,
    noRefs: true,
  });
}

module.exports = { buildSpec, toSpectralRule, toYaml, cleanThen };
