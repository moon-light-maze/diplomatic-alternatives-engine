#!/bin/bash
# Wrapper the scheduler runs each morning. Sets a known PATH (node + the `claude` CLI the
# Agent SDK spawns), then runs the refresh CLI. Output is appended to data/run.log.
# Portable: derives the project dir from this script's location — no hardcoded paths.
set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# launchd/cron run with a minimal PATH; make node + claude discoverable.
NODE_BIN="$(dirname "$(command -v node 2>/dev/null || true)")"
if [ -z "$NODE_BIN" ] && [ -d "$HOME/.nvm/versions/node" ]; then
  NODE_BIN="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" | sort -V | tail -1)/bin"
fi
export PATH="$NODE_BIN:$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "$PROJECT"
mkdir -p data
echo "=== run-daily $(date) ===" >> data/run.log
node "$PROJECT/server/dist/refresh.js" >> data/run.log 2>&1
echo "=== run-daily exit $? $(date) ===" >> data/run.log
