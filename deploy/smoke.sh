#!/usr/bin/env bash
# Post-deploy smoke: confirm the public host answers /api/health.
# Usage: deploy/smoke.sh https://your.host
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: deploy/smoke.sh https://your.host" >&2
  exit 1
fi

HOST="${1%/}"
case "$HOST" in
  http://*|https://*) ;;
  *)
    echo "Host must start with http:// or https://" >&2
    exit 1
    ;;
esac

BODY="$(curl -fsS "$HOST/api/health")"
if ! grep -q '"ok"[[:space:]]*:[[:space:]]*true' <<<"$BODY"; then
  echo "Unexpected health payload: $BODY" >&2
  exit 1
fi

echo "health ok · $HOST/api/health"
echo "Next: sign in as admin → Launch, then follow docs/LAUNCH_CHECKLIST.md"
