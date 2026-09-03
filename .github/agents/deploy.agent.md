---
description: "Use when deploying to EC2, managing PM2 processes, configuring nginx, running database migrations, SSH operations, or troubleshooting production infrastructure. Use for: deploy, push to dev, SSH, PM2 restart, 502 error, CORS fix, production logs, server status, database migration."
tools: [read, search, execute]
---
## Production is FROZEN

Production is FROZEN. No agent session runs `ssh`, `scp`, `pm2`, or `aws`
against any host in this project, ever. Deploys are Evoni-only, performed
personally via `workflow_dispatch` of `deploy-dev.yml` from a browser.

For the reasons and the full freeze rules, read
`F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root) and
`DEVELOPMENT_WORKFLOW.md` §7.
