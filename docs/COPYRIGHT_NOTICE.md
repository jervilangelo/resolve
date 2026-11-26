# Resolve — Copyright and source file notice

**Copyright © Jervil Angelo De Leon. All rights reserved.**

Resolve is proprietary. The repository is **not** licensed under MIT, Apache, GPL, or any other open-source license. No general permission is granted to reuse, modify, or redistribute the project source. See [../LICENSE](../LICENSE).

## Required source-file headers

Place a concise header at the beginning of **new, original project source files**, using the correct comment syntax for the language. Add headers to existing project-owned source files when they are created or modified. Do not add copyright claims to third-party, vendored, generated, or externally licensed files. Retain third-party copyright/license notices.

**TypeScript / JavaScript / TSX / JSX / CSS:**

```ts
/**
 * Resolve — Take every thought captive.
 * Copyright © Jervil Angelo De Leon. All rights reserved.
 * Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
 * See LICENSE for terms and applicable exceptions.
 */
```

**Python / shell / YAML / Terraform (.tf supports #):**

```text
# Resolve — Take every thought captive.
# Copyright © Jervil Angelo De Leon. All rights reserved.
# Proprietary source code. Unauthorized copying, modification, or distribution is prohibited.
# See LICENSE for terms and applicable exceptions.
```

**HTML / Markdown (where appropriate):**

```html
<!--
Resolve — Take every thought captive.
Copyright © Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->
```

For JSON (which has no comments), use an adjacent `LICENSE` or `NOTICE` file instead of inserting invalid JSON comments. For files with a required shebang or special directive, keep that directive first. Do not insert comments that break parsers, code generators, or tooling.

## Security and access reminder

A copyright header is a **legal notice**, not access control or encryption. Public GitHub repository content can be viewed and may be forked under GitHub's platform terms. If the source must not be visible to others, set the repository to **private** and limit collaborators. The project owner should review dependencies and third-party license obligations before distribution.

## Contribution policy

External contributions and reuse require the copyright owner's prior written approval. Do not imply that a pull request automatically transfers copyright or grants rights.
