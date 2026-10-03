#!/usr/bin/env bash
# Exercise account-deletion fan-out on a throwaway user and record Admin → Launch marker.
# Usage: deploy/deletion-drill.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "${JOBPILOT_DATA_DIR:-$ROOT/server/data}"
cd "$ROOT"

JOBPILOT_DATA_DIR="${JOBPILOT_DATA_DIR:-$ROOT/server/data}" node --input-type=module <<'EOF'
import { runDeletionDrill, deletionDrillStatus } from "./server/deletion-drill.mjs";
import { dataDir } from "./server/db.mjs";
import { migrate } from "./server/schema.mjs";

migrate();
const result = runDeletionDrill({ dir: dataDir });
const status = deletionDrillStatus(dataDir);
console.log(`Deletion drill ok · cleared ${result.tablesCleared.join(", ")}`);
console.log(status.detail);
EOF
