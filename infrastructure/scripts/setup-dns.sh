#!/usr/bin/env bash
# setup-dns.sh — Creates/updates GoDaddy A records for all sm2gk subdomains.
# Reads the current ingress IP from kubectl.
#
# Usage:
#   export GODADDY_API_KEY=<key>
#   export GODADDY_API_SECRET=<secret>
#   bash infrastructure/scripts/setup-dns.sh
set -euo pipefail

GODADDY_API_KEY="${GODADDY_API_KEY:?Set GODADDY_API_KEY}"
GODADDY_API_SECRET="${GODADDY_API_SECRET:?Set GODADDY_API_SECRET}"
DOMAIN="sm2gk.com"
AUTH="sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}"

INGRESS_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

if [ -z "$INGRESS_IP" ]; then
  echo "ERROR: Ingress controller has no external IP yet."
  echo "Run: kubectl get svc ingress-nginx-controller -n ingress-nginx"
  exit 1
fi

echo "Ingress IP: $INGRESS_IP"

# A records to create/update (add new subdomains here for future apps)
SUBDOMAINS=(
  "lofibooks"
  "preprod.lofibooks"
)

for SUB in "${SUBDOMAINS[@]}"; do
  echo "Setting A record: ${SUB}.${DOMAIN} → ${INGRESS_IP}"
  RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT \
    "https://api.godaddy.com/v1/domains/${DOMAIN}/records/A/${SUB}" \
    -H "Authorization: $AUTH" \
    -H "Content-Type: application/json" \
    -d "[{\"data\": \"${INGRESS_IP}\", \"ttl\": 600}]")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "  ✓ ${SUB}.${DOMAIN}"
  else
    echo "  ✗ ${SUB}.${DOMAIN} — HTTP $HTTP_CODE: $(echo "$RESPONSE" | head -1)"
  fi
done

echo ""
echo "DNS propagation may take up to 10 minutes."
echo "Verify: dig lofibooks.sm2gk.com"
