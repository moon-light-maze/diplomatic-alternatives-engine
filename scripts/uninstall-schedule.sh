#!/bin/bash
# Removes the daily launchd job.
set -euo pipefail
DEST="$HOME/Library/LaunchAgents/com.diplomatic-alternatives.daily.plist"
launchctl unload "$DEST" 2>/dev/null || true
rm -f "$DEST"
echo "Uninstalled the daily schedule."
