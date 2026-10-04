# App Store Metadata Lint

A small offline CLI for checking localized App Store text metadata before a
release. It measures character and UTF-8 budgets, preserves Japanese and other
Unicode tokens, and reports duplicate terms and common keyword formatting issues.

**[日本語](README.ja.md)** · [Rule sources and limitations](docs/rules.md)

[![CI](https://github.com/mekkoo/app-store-metadata-lint/actions/workflows/ci.yml/badge.svg)](https://github.com/mekkoo/app-store-metadata-lint/actions/workflows/ci.yml)

Node.js 24.19+ (24.x). Zero runtime dependencies. No App Store Connect login,
network requests, telemetry, or metadata writes.

## Run from the source directory

Get the source and enter its directory:

```sh
git clone https://github.com/mekkoo/app-store-metadata-lint.git
cd app-store-metadata-lint
```

With [mise](https://mise.jdx.dev/) installed:

```sh
mise exec -- npm run demo
mise exec -- npm run lint -- examples/valid --strict --json
```

Or use an existing Node.js 24 installation directly:

```sh
node src/cli.ts path/to/metadata.json
node src/cli.ts store/ios --strict --json
node src/cli.ts en-US.json ja-JP.json --keyword-limit characters
```

No dependency installation or build is needed to run the CLI. Directory input
recursively discovers `metadata.json` and `*.metadata.json`. Other JSON files,
hidden paths, `node_modules`, and symlinks are skipped. An explicit regular-file
path may have any filename. Paths are deduplicated and sorted. Inputs are limited
to 1 MiB per file and 20 directory levels; directories should contain metadata,
not a whole source tree. Explicit symlink inputs are rejected.

## Input

One JSON object per locale:

```json
{
  "locale": "en-US",
  "name": "Pantry Notes",
  "subtitle": "Plan dinner with what you have",
  "keywords": "recipe,cooking,meal,grocery,budget,leftovers",
  "companyName": "Example Studio",
  "primaryCategory": "Food & Drink"
}
```

`name` and `keywords` are required. Optional checked fields are `locale`,
`subtitle`, `companyName`, `primaryCategory`, and `secondaryCategory`; they must be
strings when provided. Extra fields are accepted but ignored. `locale` is a
BCP 47 language tag; English plural hints only run for explicitly English locales.
Examples are synthetic and contain no production app metadata.

## Rules and exit codes

| Check | Severity |
| --- | --- |
| Missing name/keywords, name outside 2–30 characters, subtitle above 30 | Error |
| Keywords above 100 UTF-8 bytes (default) or 100 characters (opt-in) | Error |
| Exact duplicate terms, repeated tokens across metadata fields | Warning |
| Separators, empty terms, separator whitespace, outer whitespace | Warning |
| Generic `app`/`apps`, regular English singular/plural pairs | Warning |

Apple's documentation describes keywords as both **100 bytes** and **100
characters** on different pages. The default follows the App Store Connect field
reference's byte wording; `--keyword-limit characters` selects the other reading.
Both counts are always reported. This tool does not prove server acceptance.
See [sources and counting details](docs/rules.md).

| Exit | Meaning |
| --- | --- |
| `0` | No errors; warnings allowed unless `--strict` is set |
| `1` | Metadata errors, or warnings with `--strict` |
| `2` | CLI usage, filesystem, JSON, or input schema failure |

`--json` emits one object with `schemaVersion: 1`, `files`, `errors`, `warnings`,
and `usageErrors`, including on input failures. Each file includes counts, the
selected keyword unit, and structured findings. Valid files are still reported
when another input fails; exit `2` takes precedence. The report contains paths and
matched tokens; review it before sharing private metadata. Malformed JSON source
contents are not echoed. Use `--help` for all options.

## CI integration

Once this directory is part of your own checkout, any CI runner with Node.js 24
can run:

```sh
node src/cli.ts store/ios --strict --json > metadata-report.json
```

Preserve the command's exit status to fail the job. No secrets are needed.

## Development

```sh
mise exec -- npm ci --ignore-scripts
mise exec -- npm run check
mise exec -- npm run demo
mise exec -- npm run pack:check
```

TypeScript and Node types are pinned development dependencies; tests use Node's
built-in test runner. `src/lint.ts` also exports the validator and pure lint
function for TypeScript consumers.

This personal project is maintained by [mekkoo](https://github.com/mekkoo) under the MIT license.
No npm package is published: `private: true` blocks accidental npm publication,
and npm name availability has not been checked. The tool is intentionally limited
to local linting; no keyword demand estimates, search ranking predictions,
automatic rewriting, App Store uploads, or submission approval claims are provided.

Contributions and bug reports are welcome through
[GitHub issues](https://github.com/mekkoo/app-store-metadata-lint/issues) and pull
requests. See [CONTRIBUTING.md](CONTRIBUTING.md). CI runs type checks, tests, sample
linting, package inspection, and staged-content publication checks on Linux and macOS.
