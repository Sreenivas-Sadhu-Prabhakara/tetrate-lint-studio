/*
 * Build & distribute the CLI: bump version, `npm pack` into ../dist (the tarball
 * contains every authored rule), and optionally build a Docker image.
 */
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { CLI_DIR, listCustomRules } = require("./rules");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DIST_DIR = path.join(REPO_ROOT, "dist");
const PKG_PATH = path.join(CLI_DIR, "package.json");

const ensureDist = () => {
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });
};
const readPkg = () => JSON.parse(fs.readFileSync(PKG_PATH, "utf8"));

function exec(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 180000, maxBuffer: 32 * 1024 * 1024, ...opts }, (err, stdout, stderr) =>
      resolve({
        ok: !err,
        code: err && typeof err.code === "number" ? err.code : err ? 1 : 0,
        stdout: stdout || "",
        stderr: stderr || (err && err.message) || "",
      }),
    );
  });
}

function bumpVersion(type = "patch") {
  const pkg = readPkg();
  const parts = String(pkg.version).split(".").map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  if (type === "major") parts.splice(0, 3, parts[0] + 1, 0, 0);
  else if (type === "minor") parts.splice(1, 2, parts[1] + 1, 0);
  else parts[2] += 1;
  pkg.version = parts.join(".");
  fs.writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  return pkg.version;
}

function listArtifacts() {
  ensureDist();
  return fs
    .readdirSync(DIST_DIR)
    .filter((f) => f.endsWith(".tgz"))
    .map((f) => {
      const st = fs.statSync(path.join(DIST_DIR, f));
      return { file: f, bytes: st.size, mtimeMs: st.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function cliInfo() {
  const pkg = readPkg();
  return {
    name: pkg.name,
    version: pkg.version,
    bin: Object.keys(pkg.bin || {})[0],
    customRuleCount: listCustomRules().length,
    artifacts: listArtifacts(),
  };
}

async function packCli({ bump } = {}) {
  ensureDist();
  const version = bump && ["patch", "minor", "major"].includes(bump) ? bumpVersion(bump) : readPkg().version;
  const res = await exec("npm", ["pack", "--pack-destination", DIST_DIR], { cwd: CLI_DIR });
  if (!res.ok) return { ok: false, error: "npm pack failed", detail: res.stderr || res.stdout, version };

  const pkg = readPkg();
  const printed = res.stdout.trim().split("\n").filter(Boolean).pop();
  const expected = `${pkg.name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
  const file =
    printed && printed.endsWith(".tgz") && fs.existsSync(path.join(DIST_DIR, printed)) ? printed : expected;
  const full = path.join(DIST_DIR, file);

  return {
    ok: true,
    version,
    file,
    bytes: fs.existsSync(full) ? fs.statSync(full).size : 0,
    installCommand: `npm install -g ./${file}`,
    customRuleCount: listCustomRules().length,
  };
}

async function buildDocker({ tag } = {}) {
  const pkg = readPkg();
  const imageTag = tag || `${pkg.name.replace(/^@/, "").replace("/", "-")}:${pkg.version}`;
  const probe = await exec("docker", ["--version"]);
  if (!probe.ok) return { ok: false, error: "Docker is not available on this host.", detail: probe.stderr };
  const res = await exec("docker", ["build", "-f", "Dockerfile", "-t", imageTag, "."], { cwd: REPO_ROOT });
  return {
    ok: res.ok,
    tag: imageTag,
    error: res.ok ? null : "docker build failed",
    detail: (res.stdout + "\n" + res.stderr).split("\n").slice(-25).join("\n"),
    runCommand: `docker run --rm -v "$PWD:/work" ${imageTag} /work/your-config.yaml --format stylish`,
  };
}

module.exports = { cliInfo, packCli, buildDocker, bumpVersion, listArtifacts, DIST_DIR, REPO_ROOT };
