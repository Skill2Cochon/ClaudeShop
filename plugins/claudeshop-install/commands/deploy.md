---
name: deploy
description: Deploy ClaudeShop from the current working tree — build images, push to registry, apply Coolify stack, run migrations on boot.
---

# /deploy

Run the deploy phase of the install playbook (`.claude/install.md § 4`). Pre-conditions: green build, all secrets set, domains DNS-resolved.

If deploying to Coolify, use `.coolify/stack.yaml`. For generic Docker hosts, use `docker-compose.prod.yml` with `.env.production`.

Post-deploy, run `/ultrareview` if available and emit the hand-off report.
