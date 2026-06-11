/*
 * Validate a candidate rule by running it through the real CLI/Spectral against
 * the sample fixtures (Istio, Gateway, OpenAPI). Reports whether the rule loads
 * cleanly and how many findings it produced.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { buildSpec, toSpectralRule, toYaml } = require("./generator");
const { CLI_DIR } = require("./rules");

const BIN = path.join(CLI_DIR, "bin.js");
const FIX_DIR = path.resolve(__dirname, "../fixtures");
const FIXTURES = fs
  .readdirSync(FIX_DIR)
  .filter((f) => /\.(ya?ml|json)$/.test(f))
  .map((f) => path.join(FIX_DIR, f));

function run(args) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [BIN, ...args],
      { cwd: CLI_DIR, timeout: 60000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) =>
        resolve({
          code: err && typeof err.code === "number" ? err.code : err ? 1 : 0,
          stdout: stdout || "",
          stderr: stderr || (err && err.message) || "",
        }),
    );
  });
}

function parseReport(stdout) {
  const s = stdout.indexOf("[");
  const e = stdout.lastIndexOf("]");
  if (s === -1 || e === -1 || e < s) return null;
  try {
    return JSON.parse(stdout.slice(s, e + 1));
  } catch {
    return null;
  }
}

async function validateForm(form) {
  let spec;
  try {
    spec = buildSpec(form);
  } catch (e) {
    return { ok: false, stage: "build", error: e.message };
  }

  const ruleset = { rules: { [spec.name]: toSpectralRule(spec) } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tetrate-rs-"));
  const rulesetPath = path.join(dir, "ruleset.json");
  fs.writeFileSync(rulesetPath, JSON.stringify(ruleset), "utf8");

  try {
    const res = await run([...FIXTURES, "--ruleset", rulesetPath, "--format", "json"]);
    const report = parseReport(res.stdout);
    if (!report) {
      return {
        ok: false,
        stage: "execute",
        error: "The rule did not run cleanly — check the JSONPath in 'given' and the 'then' clause.",
        detail: (res.stderr || res.stdout || "").split("\n").slice(0, 20).join("\n"),
        code: toYaml(spec),
      };
    }
    const findings = report
      .filter((m) => m.code === spec.name)
      .map((m) => ({
        source: m.source ? path.basename(m.source) : undefined,
        line: m.range && m.range.start ? m.range.start.line + 1 : undefined,
        severity: m.severity,
        message: m.message,
      }));
    return { ok: true, ruleName: spec.name, firedCount: findings.length, findings, code: toYaml(spec) };
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}

module.exports = { validateForm, FIXTURES };
