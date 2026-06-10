#!/bin/bash
# Installs the daily 5am-PT launchd job. Portable: derives paths from this script's
# location and substitutes them into the plist template. Safe to re-run (reloads).
set -euo pipefail

LABEL="com.diplomatic-alternatives.daily"
PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$PROJECT/scripts/$LABEL.plist"
DEST="$HOME/Library/LaunchAgents/$LABEL.plist"

chmod +x "$PROJECT/scripts/run-daily.sh"
mkdir -p "$HOME/Library/LaunchAgents"

# Substitute the repo's absolute path into the template (launchd needs absolute paths).
sed "s#__PROJECT__#$PROJECT#g" "$TEMPLATE" > "$DEST"

launchctl unload "$DEST" 2>/dev/null || true
launchctl load "$DEST"

echo "Installed and loaded: $DEST"
echo "Scheduled daily at 05:00 (TZ America/Los_Angeles, system-local trigger)."
launchctl list | grep diplomatic-alternatives || echo "(will appear in launchctl list after load)"
