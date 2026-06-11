# Architecture

How Tetrate Lint Studio turns "a rule in a form" into "a rule inside a downloadable CLI."

## Components

```
tetrate-lint-studio/
├── cli/                     tetrate-lint — the publishable artifact
│   ├── bin.js               compiles rules/ into a ruleset, runs spectral-cli with it
│   ├── lib/compile.js       base.json + rules/custom/*.json -> one Spectral ruleset
│   └── rules/
│       ├── base.json        ruleset header (extends, documentationUrl) — no oas base
│       └── custom/*.json    custom rules (studio specs) — bundled into the package
├── server/                  Express backend (Studio API)
│   ├── lib/templates.js     Spectral rule templates -> `then` clause
│   ├── lib/generator.js     form -> studio spec + Spectral YAML
│   ├── lib/rules.js         read/write cli/rules/custom
│   ├── lib/validator.js     run a candidate rule through the real CLI/Spectral
│   ├── lib/publisher.js     version bump + npm pack + docker build
│   └── fixtures/            sample Istio / Gateway / OpenAPI files
├── ui/                      React (Vite) front end (with demo mode)
├── dist/                    packed CLI tarballs
└── Dockerfile               self-contained CLI image
```

## Why a wrapper instead of "just Spectral"

Plain Spectral needs the user to point `--ruleset` at a file they have locally. That doesn't travel.
`tetrate-lint` **bundles** the ruleset inside the package and applies it by default (resolved from the
package's own `rules/` dir), so a globally-installed or Docker'd CLI just *has* the rules. `bin.js`:

```js
const args = ["lint", ...passthrough];
if (useBundled) args.push("--ruleset", writeCompiled());   // compiled from rules/custom/*.json
spawnSync(node, [spectralCli, ...args], { stdio: "inherit" });
```

`--no-bundled-rules` opts out; an explicit `--ruleset` overrides; all other flags pass through to
`spectral lint`.

## The Spectral rule contract

A custom rule is one JSON file in `cli/rules/custom/`:

```json
{
  "name": "gateway-no-wildcard-host",
  "templateId": "field-pattern",
  "params": { "notMatch": "^\\*$" },
  "description": "Gateway servers must not expose a wildcard host ('*').",
  "given": "$.spec.servers[*].hosts[*]",
  "severity": "error",
  "then": { "function": "pattern", "functionOptions": { "notMatch": "^\\*$" } }
}
```

`templateId`/`params` are studio metadata for round-trip editing; `given`/`severity`/`then`/
`description`/`message` are the Spectral rule. `compile.js` strips the metadata and keys each rule by
`name` into the ruleset.

## Request flow

### Validate
```
form ──▶ generator.buildSpec ──▶ { rules: { name: rule } } to a temp file
                                 ▼
   node cli/bin.js <fixtures...> --ruleset <temp> --format json
                                 ▼
   parse JSON report → findings where code === rule.name → { ok, firedCount, findings, yaml }
```
Runs the real CLI against the sample fixtures in isolation. A bad `given`/`then` surfaces as a failed
load.

### Save
`POST /api/rules` re-validates, then writes `cli/rules/custom/<name>.json`. Invalid rules are never
written. Renames remove the old file.

### Publish
`POST /api/cli/pack` bumps `cli/package.json` and `npm pack`s into `dist/`. The tarball contains
`rules/`, so every authored rule is inside. Docker copies `cli/` (incl. `rules/`) into the image.

## Tetrate vs. the Apiwiz studio

Same architecture, different `base.json`:
- **Tetrate** — no `extends`; lints generic Istio/Envoy/K8s YAML + OpenAPI with only the custom rules.
- **Apiwiz** — `extends: [[spectral:oas, recommended]]`; inherits the full OpenAPI ruleset, then layers custom rules on top.

## API reference

| Method & path | Purpose |
| ------------- | ------- |
| `GET /api/templates` | Templates + severities + casing types |
| `GET /api/rules` | `{ custom: [...], inherited: [...] }` |
| `GET /api/rules/:name` | One custom rule |
| `POST /api/rules/validate` | Validate without saving |
| `POST /api/rules` | Validate + save |
| `DELETE /api/rules/:name` | Remove a rule |
| `GET /api/cli` | CLI name/version, rule count, artifacts |
| `POST /api/cli/pack` | Bump + `npm pack` |
| `POST /api/cli/docker` | Build the Docker image |
| `GET /download/:file` | Download a packed tarball |
