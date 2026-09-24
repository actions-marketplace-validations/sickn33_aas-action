<p align="center">
  <img src="assets/aas-banner.png" alt="AAS — Agentic Awesome Skills" width="100%">
</p>

<p align="center">
  <img src="assets/aas-mark.png" alt="AAS mark" width="280">
</p>

<p align="center">
  <a href="https://github.com/marketplace/actions/agentic-awesome-skills"><img alt="GitHub Marketplace" src="https://img.shields.io/badge/Marketplace-Agentic%20Awesome%20Skills-00E5FF?style=flat-square&logo=github&logoColor=black"></a>
  <a href="https://www.npmjs.com/package/agentic-awesome-skills"><img alt="npm" src="https://img.shields.io/npm/v/agentic-awesome-skills?style=flat-square&color=00E5FF&label=npm"></a>
  <a href="https://aaskills.tech/"><img alt="Catalog" src="https://img.shields.io/badge/catalog-aaskills.tech-111111?style=flat-square"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-111111?style=flat-square"></a>
</p>

<h1 align="center">Agentic Awesome Skills</h1>

<p align="center">
  Validate a reproducible AI agent skill stack in GitHub Actions.<br>
  Official bridge from Actions to the published <a href="https://github.com/sickn33/agentic-awesome-skills">AAS</a> CLI.
</p>

A pull request opens, this Action installs one exact `agentic-awesome-skills` release, checks the stack, and fails the job if the manifest or the skill IDs are not valid.

```text
pull request
    →  sickn33/aas-action
    →  aas stack validate
    →  installer dry-run of the exact skill IDs
    →  job fails closed, or the stack is valid
```

The catalog stays in [agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills). This repository contains only the Action.

## Validate a manifest

```yaml
name: AAS

on:
  pull_request:

jobs:
  stack:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate AAS stack
        uses: sickn33/aas-action@v1
        with:
          manifest: aas-stack.json
```

`aas-stack.json` must pin `catalog.package` to `agentic-awesome-skills` and an exact `catalog.version`. The Action runs `aas stack validate` on that file, then checks every skill ID against that same published release. If you also set `version`, it must match `catalog.version`.

`stack validate` checks the manifest structure. Membership of each skill ID is checked by the direct installer, because Core validation does not look the IDs up in the catalog.

## Preview explicit skill IDs

```yaml
- uses: sickn33/aas-action@v1
  with:
    version: 18.3.0
    target: codex
    skills: concise-planning,verification-before-completion
    dry-run: true
```

Use this when the repository does not carry an `aas-stack.json` and the workflow should prove that those IDs exist in a pinned release. `dry-run` defaults to `true`, so the runner home directory is left untouched.

Set `dry-run: false` only when a later step needs those skills installed on the runner for `target`. Supported targets are `cursor`, `claude`, `gemini`, `codex`, `kiro`, `antigravity`, and `agy`.

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `version` | `18.3.0` | Exact npm version. `latest` is rejected so the job stays reproducible. |
| `manifest` | | Path inside the repository to `aas-stack.json`. |
| `skills` | | Comma-separated skill IDs. |
| `target` | `codex` | Installer target, used only when `dry-run` is `false`. |
| `dry-run` | `true` | Preview the installer plan without writing skills. |

Pass `manifest` or `skills`, not both. Skill ID checks need network access: the installer resolves the published release and verifies its git commit.

## Outputs

| Output | Meaning |
| --- | --- |
| `version` | npm version that ran |
| `skill-count` | number of skill IDs checked |
| `manifest-digest` | digest from `aas stack validate`, when a manifest was supplied |

```yaml
- id: aas
  uses: sickn33/aas-action@v1
  with:
    manifest: aas-stack.json

- run: echo "${{ steps.aas.outputs.manifest-digest }}"
```

## Limits

This Action does not generate an AAS Core plan. `aas stack plan` needs a verified runtime cache and runtime integrity, and it does not install skills. Plan generation stays on the AAS CLI.

It also does not run experimental `stack apply` or `stack recover`.

Node.js 22 is set up by the Action. The npm package is installed with `--ignore-scripts`.

## Links

- Marketplace: [Agentic Awesome Skills](https://github.com/marketplace/actions/agentic-awesome-skills)
- Catalog: [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills)
- Hosted catalog: [aaskills.tech](https://aaskills.tech/)
- npm: [agentic-awesome-skills](https://www.npmjs.com/package/agentic-awesome-skills)
