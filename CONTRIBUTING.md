# Contributing

Use GitHub issues for bug reports and proposals, and pull requests for changes.
When reporting a metadata problem, provide a **synthetic** minimal JSON example,
the Node.js version, CLI arguments, and expected versus actual findings. Do not
include unpublished production metadata, credentials, personal contact addresses,
analytics identifiers, or absolute paths from your machine.

## Local checks

Node.js 24.19+ (24.x) is required. mise.toml pins the maintainer runtime.

```sh
mise exec -- npm ci --ignore-scripts
mise exec -- npm run check
mise exec -- npm run demo
mise exec -- npm run pack:check
```

Use `.ts` files and erasable TypeScript syntax. Runtime dependencies should remain
absent. Add focused tests when a rule or input contract changes. Any new metadata
rule needs a source and an explicit account of its limitations in docs/rules.md.
Maintain stable JSON output and keep advisory findings separate from hard errors.

Before publishing a commit, stage its candidate files and run:

```sh
npm run check:publication
```

This checks the Git index for credential patterns, private key files, contact
addresses, local-machine paths, and excluded branding without printing matched values. It supplements
manual review; pattern checks cannot establish the absence of every possible
secret. Platform-generated GitHub noreply author addresses may appear in commit
metadata; use one instead of a personal address for public commits.

No npm publication or automated App Store operation is part of this project.
