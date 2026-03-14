#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLATFORM_ENV="$REPO_ROOT/infrastructure/.platform-outputs.env"

GODADDY_API_KEY="${GODADDY_API_KEY:?Set GODADDY_API_KEY}"
GODADDY_API_SECRET="${GODADDY_API_SECRET:?Set GODADDY_API_SECRET}"
DOMAIN="sm2gk.com"
AUTH="sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}"

if [ ! -f "$PLATFORM_ENV" ]; then
  echo "ERROR: infrastructure/.platform-outputs.env not found."
  exit 1
fi

# shellcheck disable=SC1090
source "$PLATFORM_ENV"

curl -s -X PUT \
  "https://api.godaddy.com/v1/domains/${DOMAIN}/records/CNAME/lofibooks" \
  -H "Authorization: $AUTH" \
  -H "Content-Type: application/json" \
  -d "[{\"data\": \"${LOFIBOOKS_STATIC_SITE_DEFAULT_HOSTNAME}\", \"ttl\": 600}]"
echo ""
echo "Updated lofibooks.${DOMAIN} -> ${LOFIBOOKS_STATIC_SITE_DEFAULT_HOSTNAME}"
