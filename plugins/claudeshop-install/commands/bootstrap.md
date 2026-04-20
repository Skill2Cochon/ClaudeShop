---
name: bootstrap
description: Bootstrap an already-cloned ClaudeShop repo — pnpm install + docker up + migrations + seed. No git work.
---

# /bootstrap

Run the bootstrap phase of the install playbook (`.claude/install.md § 3`). Skip the clone step — assumes we're already in the repo.

If the user passes `$ARGUMENTS`, interpret it as the target env (local / production) and pass it to `scripts/bootstrap-demo.sh`.
