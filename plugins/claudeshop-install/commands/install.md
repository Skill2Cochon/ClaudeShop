---
name: install
description: One-shot "install ClaudeShop" command. Delegates to the claudeshop-install skill. Accepts an optional argument for the target environment (local|vps|coolify).
---

# /install

Install ClaudeShop into $ARGUMENTS (default: local).

Delegate the work to the **claudeshop-install** skill. The skill reads `.claude/install.md` and runs the 6-phase playbook. Do not shortcut — the playbook encodes the secret-handling, checkpoint, and hand-off rules.

When you're done, emit the hand-off report template from `.claude/install.md § 7`.
