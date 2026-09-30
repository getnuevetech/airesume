#!/usr/bin/env bash
# Replace JobPilot's database and uploads with a backup from deploy/backup.sh.
# Destructive. Usage: deploy/restore.sh <backup-directory> [target-data-dir] --yes
set -euo pipefail

YES=0
ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--yes" ]]; then
    YES=1
  else
    ARGS+=("$arg")
  fi
done

if [[ "$YES" -ne 1 || ${#ARGS[@]} -lt 1 || ${#ARGS[@]} -gt 2 ]]; then
  echo "Usage: deploy/restore.sh <backup-directory> [target-data-dir] --yes" >&2
  echo "This replaces the target database and uploads. Pass --yes to confirm." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="$(cd "${ARGS[0]}" && pwd -P)"
TARGET="${ARGS[1]:-${JOBPILOT_DATA_DIR:-$ROOT/server/data}}"
mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd -P)"

if [[ ! -f "$ARCHIVE/jobpilot.sqlite" ]]; then
  echo "Backup has no jobpilot.sqlite in $ARCHIVE" >&2
  exit 1
fi

stopped=0
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet jobpilot 2>/dev/null; then
  sudo systemctl stop jobpilot
  stopped=1
fi

cd "$ROOT"
JOBPILOT_RESTORE_ARCHIVE="$ARCHIVE" JOBPILOT_RESTORE_TARGET="$TARGET" node --input-type=module <<'EOF'
import { restoreDataDir } from "./server/data-backup.mjs";
restoreDataDir(process.env.JOBPILOT_RESTORE_ARCHIVE, process.env.JOBPILOT_RESTORE_TARGET);
EOF

if [[ "$stopped" -eq 1 ]]; then
  sudo systemctl start jobpilot
fi

echo "Restored database and uploads to $TARGET"
echo "This replaced any previous JobPilot database and uploads in that directory."
