#!/usr/bin/env bash
# setup-dns.sh — Creates an A record in GoDaddy for lofibooks.sm2gk.com
# pointing to the NGINX Ingress LoadBalancer IP.
#
# Usage:
#   export GODADDY_API_KEY=<your-key>
#   export GODADDY_API_SECRET=<your-secret>
#   bash infrastructure/scripts/setup-dns.sh
set -euo pipefail

GODADDY_API_KEY="${GODADDY_API_KEY:?Set GODADDY_API_KEY}"
GODADDY_API_SECRET="${GODADDY_API_SECRET:?Set GODADDY_API_SECRET}"
DOMAIN="sm2gk.com"
SUBDOMAIN="lofibooks"

echo "=== Getting ingress controller external IP ==="
INGRESS_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

if [ -z "$INGRESS_IP" ]; then
  echo "ERROR: Ingress controller does not have an external IP yet."
  echo "Run: kubectl get svc -n ingress-nginx"
  exit 1
fi

echo "Ingress IP: $INGRESS_IP"
echo "Creating A record: ${SUBDOMAIN}.${DOMAIN} → ${INGRESS_IP}"

# GoDaddy REST API — PUT replaces the record entirely
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT \
  "https://api.godaddy.com/v1/domains/${DOMAIN}/records/A/${SUBDOMAIN}" \
  -H "Authorization: sso-key ${GODADDY_API_KEY}:${GODADDY_API_SECRET}" \
  -H "Content-Type: application/json" \
  -d "[{\"data\": \"${INGRESS_IP}\", \"ttl\": 600}]")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "DNS A record created successfully"
  echo ""
  echo "Verify with: dig ${SUBDOMAIN}.${DOMAIN}"
  echo "Note: DNS propagation may take up to 10 minutes"
else
  echo "ERROR: GoDaddy API returned HTTP $HTTP_CODE"
  echo "Response: $BODY"
  exit 1
fi
