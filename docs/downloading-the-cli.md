# Downloading & installing the CLI

How anyone gets `tetrate-lint` — with your org's custom rules already inside. Rules apply
automatically; no `--ruleset` needed.

## Option A — npm (recommended)

Build a tarball (UI **Download CLI → Build**, or `npm run pack:cli`). It lands in `dist/` as
`tetrate-lint-<version>.tgz`. Share it, then:

```bash
npm install -g ./tetrate-lint-1.0.1.tgz
```

Use it:

```bash
tetrate-lint config.yaml                      # lint a single YAML/JSON file
tetrate-lint manifests/*.yaml --format json   # multiple files, JSON output
tetrate-lint api.yaml --format pretty         # human-friendly output
tetrate-lint --list                           # list bundled rules
tetrate-lint api.yaml --no-bundled-rules      # ignore bundled rules for one run
```

`tetrate-lint` wraps the Spectral CLI, which is installed as a dependency — so all Spectral output
formats (`json`, `stylish`, `pretty`, `junit`, `html`, `sarif`, `github-actions`, …) and flags work.

### Private registry

Set a scoped name (e.g. `@your-org/tetrate-lint`) in `cli/package.json`, then from `cli/`:

```bash
npm publish --registry https://your-registry
```

## Option B — Docker

```bash
docker build -t tetrate-lint .                              # from the repo root
docker run --rm -v "$PWD:/work" tetrate-lint /work/config.yaml --format stylish
docker run --rm tetrate-lint --list
```

### In CI

```yaml
- name: Lint mesh configs
  run: |
    docker run --rm -v "$PWD:/work" \
      ghcr.io/your-org/tetrate-lint:latest \
      /work/manifests --format json
```

## Exit codes

`0` = clean; `1` = findings at or above the fail severity. Use `--fail-severity warn` (a Spectral
flag, passed through) to gate CI on warnings too.

## Verify the rules are bundled

```bash
tetrate-lint --list
# tetrate-lint — N bundled rule(s):
#   gateway-no-wildcard-host  [error]  ...
```
