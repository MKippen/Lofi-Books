#!/usr/bin/env bash
# rotate-secrets.sh — Helper to update the OpenAI API key in Key Vault.
# This is the only credential that may ever need updating (if you choose to rotate it).
# All Azure/AKS credentials use MSI and never need rotation.
#
# Usage:
#   export NEW_OPENAI_API_KEY=sk-proj-...
#   bash infrastructure/scripts/rotate-secrets.sh
set -euo pipefail

KV_NAME="${KEY_VAULT_NAME:-kv-lofi-books-prod}"
NEW_KEY="${NEW_OPENAI_API_KEY:?Set NEW_OPENAI_API_KEY}"

echo "=== Updating openai-api-key in Key Vault: $KV_NAME ==="
az keyvault secret set --vault-name "$KV_NAME" --name "openai-api-key" --value "$NEW_KEY" --output none
echo "Secret updated"

echo ""
echo "The CSI driver will pick up the new value within 5 minutes (rotationPollInterval)."
echo "No pod restart required — the secretObjects K8s Secret is also auto-updated."
