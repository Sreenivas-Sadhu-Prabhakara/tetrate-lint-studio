# tetrate-lint

A Spectral-based linter for **Tetrate service-mesh & API configs** — Istio/Envoy/Kubernetes YAML
and OpenAPI — with your organization's custom rules **bundled in**. Authored via
[Tetrate Lint Studio](https://github.com/Sreenivas-Sadhu-Prabhakara/tetrate-lint-studio); ship inside
this CLI.

## Install

```bash
npm install -g ./tetrate-lint-<version>.tgz   # from a packed tarball
```

## Use

```bash
tetrate-lint config.yaml                       # lint a file (bundled rules apply automatically)
tetrate-lint manifests/*.yaml --format json    # multiple files, JSON output
tetrate-lint --list                            # list the bundled rules
tetrate-lint api.yaml --ruleset my.yaml        # use your own ruleset instead
tetrate-lint api.yaml --no-bundled-rules       # skip the bundled rules for one run
```

Any flags other than the wrapper's own pass straight through to `spectral lint`.

## How it works

`tetrate-lint` wraps [`@stoplight/spectral-cli`](https://github.com/stoplightio/spectral). At runtime
it compiles a ruleset from `rules/base.json` + every `rules/custom/*.json` (the studio-authored rules)
and applies it by default — so a downloaded CLI already carries your rules, no `--ruleset` needed.

Custom rules are plain Spectral rules: a `given` (JSONPath), a `then` (function + options) and a
`severity`. Add or edit them in Tetrate Lint Studio, or drop a JSON spec into `rules/custom/`.
