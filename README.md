# Agentic Awesome Skills

Official GitHub Action for [Agentic Awesome Skills](https://github.com/sickn33/agentic-awesome-skills). It installs a pinned npm release of `agentic-awesome-skills` and fails the job when the requested stack is invalid.

The action is a bridge. It does not fork AAS Core. Validation and skill-ID checks go through the published CLI.

## Validate a manifest

```yaml
- name: Validate AAS stack
  uses: sickn33/aas-action@v1
  with:
    manifest: aas-stack.json
```

This runs `aas stack validate` on `aas-stack.json`, then checks every skill ID in that manifest with the direct installer dry run for `catalog.version`. The manifest package must be `agentic-awesome-skills`. If `version` is set, it must equal `catalog.version`.

`aas stack validate` checks manifest structure. Catalog membership of each skill ID is checked by the installer.

## Preview explicit skill IDs

```yaml
- uses: sickn33/aas-action@v1
  with:
    version: 18.3.0
    target: codex
    skills: concise-planning,verification-before-completion
    dry-run: true
```

`dry-run` defaults to `true`. The preview writes nothing under the runner home directory. Set `dry-run: false` only when a later step needs those skills installed on the runner for `target`.

## Inputs

| Input | Default | Purpose |
| --- | --- | --- |
| `version` | `18.3.0` | Exact npm version. `latest` is rejected so the job stays reproducible. |
| `manifest` | empty | Repository-relative path to `aas-stack.json`. |
| `skills` | empty | Comma-separated skill IDs. |
| `target` | `codex` | Installer target used only when `dry-run` is `false`. |
| `dry-run` | `true` | Preview the installer plan without writing skills. |

Supply `manifest` or `skills`, not both. Skill ID checks need network access because the installer verifies the published release.

## Outputs

- `version` — npm version that ran
- `skill-count` — IDs checked
- `manifest-digest` — digest from `aas stack validate` when a manifest was supplied

## What this action does not do

It does not generate an AAS Core plan. `aas stack plan` needs a verified runtime cache and runtime integrity, and it does not install skills. Wrapping that path here would look like CI validation while depending on a separate cache setup. Plan generation stays on the AAS CLI.

It also does not run experimental `stack apply` or `stack recover`.

## Publishing

GitHub lists a public action in Marketplace when the repository has one root `action.yml`, a unique name, a release, and the Marketplace developer agreement is accepted. Listing is immediate once those requirements are met. Primary category: **Utilities**. Secondary category: **Continuous integration**.
