/*
 * Tetrate Lint Studio backend.
 *
 * REST API the UI uses to browse rules, author/validate/save Spectral rules into
 * the CLI, and pack/build the CLI for download. Also serves the built UI and the
 * packed CLI tarballs.
 */
const express = require("express");
const path = require("path");
const fs = require("fs");

const { TEMPLATES, SEVERITIES, CASING_TYPES } = require("./lib/templates");
const rules = require("./lib/rules");
const { validateForm } = require("./lib/validator");
const publisher = require("./lib/publisher");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) console.log(`${req.method} ${req.path}`);
  next();
});

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(e);
    res.status(400).json({ error: e.message || String(e) });
  });

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/templates", (_req, res) =>
  res.json({
    templates: TEMPLATES.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      advanced: !!t.advanced,
      params: t.params,
    })),
    severities: SEVERITIES,
    casingTypes: CASING_TYPES,
  }),
);

app.get(
  "/api/rules",
  wrap((_req, res) =>
    res.json({ custom: rules.listCustomRules(), inherited: rules.listInherited() }),
  ),
);

app.get(
  "/api/rules/:name",
  wrap((req, res) => {
    const r = rules.getCustomRule(req.params.name);
    if (!r) return res.status(404).json({ error: "not found" });
    res.json(r);
  }),
);

app.post(
  "/api/rules/validate",
  wrap(async (req, res) => res.json(await validateForm(req.body || {}))),
);

app.post(
  "/api/rules",
  wrap(async (req, res) => {
    const form = req.body || {};
    const validation = await validateForm(form);
    if (!validation.ok) return res.status(422).json({ error: "validation failed", validation });
    const saved = rules.saveRule(form);
    res.json({ saved, validation });
  }),
);

app.delete(
  "/api/rules/:name",
  wrap((req, res) => {
    const ok = rules.deleteRule(req.params.name);
    if (!ok) return res.status(404).json({ error: "not found" });
    res.json({ deleted: req.params.name });
  }),
);

app.get("/api/cli", wrap((_req, res) => res.json(publisher.cliInfo())));
app.post("/api/cli/pack", wrap(async (req, res) => res.json(await publisher.packCli(req.body || {}))));
app.post("/api/cli/docker", wrap(async (req, res) => res.json(await publisher.buildDocker(req.body || {}))));

app.get("/download/:file", (req, res) => {
  const file = path.basename(req.params.file);
  const full = path.join(publisher.DIST_DIR, file);
  if (!file.endsWith(".tgz") || !fs.existsSync(full)) return res.status(404).send("not found");
  res.download(full);
});

const UI_DIST = path.resolve(__dirname, "../ui/dist");
if (fs.existsSync(UI_DIST)) {
  app.use(express.static(UI_DIST));
  app.get(/^(?!\/api|\/download).*/, (_req, res) => res.sendFile(path.join(UI_DIST, "index.html")));
}

const PORT = process.env.PORT || 4700;
app.listen(PORT, () => {
  console.log(`Tetrate Lint Studio API on http://localhost:${PORT}`);
  if (!fs.existsSync(UI_DIST)) console.log("UI not built yet — run ../ui dev server or build it.");
});

module.exports = app;
