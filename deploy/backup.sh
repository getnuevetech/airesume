#!/usr/bin/env bash
# Copy jobpilot.sqlite (consistent snapshot) and uploads/ to a directory outside the repo.
# Usage: deploy/backup.sh <destination-directory>
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: deploy/backup.sh <destination-directory>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$1"
DEST="$(cd "$1" && pwd -P)"
ROOT_P="$(cd "$ROOT" && pwd -P)"
case "$DEST" in
  "$ROOT_P"|"$ROOT_P"/*)
    echo "Backup destination must be outside the repository." >&2
    exit 1
    ;;
esac

DATA="${JOBPILOT_DATA_DIR:-$ROOT/server/data}"
if [[ ! -f "$DATA/jobpilot.sqlite" ]]; then
  echo "No database at $DATA/jobpilot.sqlite" >&2
  exit 1
fi

cd "$ROOT"
JOBPILOT_BACKUP_SOURCE="$DATA" JOBPILOT_BACKUP_DEST="$DEST" node --input-type=module <<'EOF'
import { backupDataDir } from "./server/data-backup.mjs";
backupDataDir(process.env.JOBPILOT_BACKUP_SOURCE, process.env.JOBPILOT_BACKUP_DEST);
EOF

echo "Backup written to $DEST"
