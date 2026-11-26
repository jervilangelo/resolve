<!--
Resolve — Take every thought captive.
Copyright © Jervil Angelo De Leon. All rights reserved.
Proprietary source code. See LICENSE.
-->

# Resolve — instructions for Claude Code

- **At the start of every session, read [docs/PROGRESS.md](docs/PROGRESS.md)** to see where work
  stopped, then continue from its "Next steps" unless the owner says otherwise.
- **Before pausing or when a phase or major step finishes, update docs/PROGRESS.md** (status
  table, what works, next steps, open decisions, date) and commit it with the related work.
- Follow [docs/DEVELOPMENT_HANDBOOK.md](docs/DEVELOPMENT_HANDBOOK.md) for agent roles: Claude Code
  is the primary coder. **Reviews use Claude (the owner's Claude Pro plan), not Codex:** run
  `/code-review` after each coherent batch and Claude reviewer agents for whole-system checks (see
  handbook §4.2). Do not use or suggest the Codex CLI.
- [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md) is the authoritative specification.
