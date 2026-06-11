# Adding linting rules (and getting them into the CLI)

Author a Spectral rule in the Studio and have it ship inside the downloadable CLI. No separate
ruleset for end users — the rule travels *inside* the CLI package.

## The flow

```
  UI: New rule  ──▶  POST /api/rules  ──▶  validate against sample configs
                                          │  (real CLI / Spectral run, isolated)
                                          ▼
                              write cli/rules/custom/<name>.json
                                          │
  Download CLI: Build  ──▶  POST /api/cli/pack  ──▶  bump version + `npm pack`
                                          ▼
                              dist/tetrate-lint-<version>.tgz
                                          │
                          anyone: npm i -g ./that.tgz  (rule is built in)
```

## 1. Open the Studio

```bash
npm start          # http://localhost:4700
```

Go to **+ New rule**.

## 2. Fill the rule

Every Spectral rule has four core pieces, plus a template that builds the `then` clause:

- **name** — kebab-case, unique (becomes the file name and the rule id).
- **description** — human-readable; also the default message.
- **given** — a **JSONPath** selecting what the rule applies to. Examples:
  - `$.info` — the OpenAPI info object
  - `$.spec.http[*]` — each HTTP route of an Istio VirtualService
  - `$.metadata.labels` — a Kubernetes resource's labels
  - `$.paths[*]~` — each path *key* (the `~` selects the property name)
  - `$.spec.servers[*].hosts[*]` — each Gateway server host
- **severity** — `error`, `warn`, `info`, `hint`, or `off`.

## 3. Pick a template (the `then` clause)

| Template | Spectral function | Use it to… |
| -------- | ----------------- | ---------- |
| Field must be present & truthy | `truthy` | require a field exists and is non-empty |
| Field must be defined | `defined` | require a field exists (empty allowed) |
| Field must be absent / falsy | `falsy` | forbid a field |
| Value must match / not match a regex | `pattern` | enforce/forbid a string shape |
| Value must follow a casing style | `casing` | camelCase / kebab-case / snake_case / … |
| Value must be one of a set | `enumeration` | restrict to allowed values |
| Length within bounds | `length` | min/max string length or collection size |
| **Advanced** | any | write the `then` JSON yourself |

The optional **Field** narrows the check to a sub-property of the `given` match (e.g. `given: $.info`,
field `contact`). Leave it blank to apply the function to the matched value itself.

## 4. Validate

**Validate** runs the rule through the **real CLI/Spectral** against the sample fixtures
(`server/fixtures/`): an Istio VirtualService, a Gateway, and an OpenAPI doc. You get back whether it
loaded cleanly, how many findings it produced, the findings, and the generated Spectral YAML.

## 5. Create

**Create rule** re-validates and writes `cli/rules/custom/<name>.json`. A rule that fails to load is
never saved. It's immediately active for the local CLI:

```bash
node cli/bin.js server/fixtures/sample-istio.yaml --format stylish
node cli/bin.js --list
```

## 6. Bundle it into a download

**Download CLI → Build new download** (or `npm run pack:cli`) bumps the version and runs `npm pack`,
producing `dist/tetrate-lint-<version>.tgz` with your rule inside. See
[downloading-the-cli.md](downloading-the-cli.md).

## Without the UI

Drop a JSON spec into `cli/rules/custom/`:

```json
{
  "name": "require-mesh-mtls",
  "given": "$.spec.mtls",
  "severity": "error",
  "then": { "field": "mode", "function": "truthy" },
  "description": "PeerAuthentication must set an mTLS mode."
}
```

The CLI compiles everything in that folder at runtime.
