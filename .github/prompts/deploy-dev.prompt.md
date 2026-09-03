---
description: "Deploy to the dev server (dev.primepisodes.com). Builds frontend, SSHs to EC2, pulls code, restarts PM2, and verifies."
agent: "deploy"
---
## Production is FROZEN

Production is FROZEN. No agent session runs `ssh`, `scp`, `pm2`, or `aws`
against any host in this project, ever. Deploys are Evoni-only, performed
personally via `workflow_dispatch` of `deploy-dev.yml` from a browser.

For the reasons and the full freeze rules, read
`F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root) and
`DEVELOPMENT_WORKFLOW.md` §7.
