#!/usr/bin/env bash
# setup-cluster.sh — One-time SM2GK platform setup.
# Deploys the generic AKS cluster + shared tooling (NGINX Ingress, cert-manager).
# Run from repo root after `az login`. Safe to re-run (idempotent via --upgrade).
#
# Usage:
#   export AZURE_SUBSCRIPTION_ID=<your-sub-id>
#   export GITHUB_REPO=MKippen/Lofi-Books
#   bash infrastructure/scripts/setup-cluster.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:?Set AZURE_SUBSCRIPTION_ID}"
LOCATION="westus2"
RESOURCE_GROUP="rg-sm2gk"
CLUSTER_NAME="aks-sm2gk"
ACR_NAME="acrsm2gk"
GITHUB_REPO="${GITHUB_REPO:-MKippen/Lofi-Books}"

echo "=== [SM2GK Platform] Setting subscription ==="
az account set --subscription "$SUBSCRIPTION_ID"

echo "=== [SM2GK Platform] Deploying Bicep infrastructure ==="
DEPLOY_NAME="sm2gk-platform-$(date +%Y%m%d%H%M)"
az deployment sub create \
  --location "$LOCATION" \
  --template-file "$REPO_ROOT/infrastructure/bicep/platform/main.bicep" \
  --parameters "$REPO_ROOT/infrastructure/bicep/platform/parameters/sm2gk.bicepparam" \
  --name "$DEPLOY_NAME" \
  --output none

echo "=== Getting deployment outputs ==="
AKS_NAME=$(az deployment sub show --name "$DEPLOY_NAME" --query "properties.outputs.aksClusterName.value" -o tsv)
AKS_OIDC_ISSUER=$(az deployment sub show --name "$DEPLOY_NAME" --query "properties.outputs.aksOidcIssuerUrl.value" -o tsv)
ACR_LOGIN_SERVER=$(az deployment sub show --name "$DEPLOY_NAME" --query "properties.outputs.acrLoginServer.value" -o tsv)
KV_NAME=$(az deployment sub show --name "$DEPLOY_NAME" --query "properties.outputs.keyVaultName.value" -o tsv)
AZURE_TENANT_ID=$(az account show --query "tenantId" -o tsv)

# Save platform outputs for use by other scripts
cat > "$REPO_ROOT/infrastructure/.platform-outputs.env" <<EOF
export AZURE_SUBSCRIPTION_ID=${SUBSCRIPTION_ID}
export AZURE_TENANT_ID=${AZURE_TENANT_ID}
export RESOURCE_GROUP=${RESOURCE_GROUP}
export AKS_NAME=${AKS_NAME}
export AKS_OIDC_ISSUER=${AKS_OIDC_ISSUER}
export ACR_NAME=${ACR_NAME}
export ACR_LOGIN_SERVER=${ACR_LOGIN_SERVER}
export KV_NAME=${KV_NAME}
EOF
echo ".platform-outputs.env written (sourced by deploy-app.sh)"

echo "=== Getting AKS credentials ==="
az aks get-credentials \
  --resource-group "$RESOURCE_GROUP" \
  --name "$AKS_NAME" \
  --overwrite-existing

echo "=== Installing NGINX Ingress Controller (shared, resource-constrained) ==="
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx --force-update
helm repo update
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.replicaCount=1 \
  --set controller.nodeSelector."kubernetes\.io/os"=linux \
  --set controller.resources.requests.cpu=100m \
  --set controller.resources.requests.memory=128Mi \
  --set controller.resources.limits.cpu=250m \
  --set controller.resources.limits.memory=256Mi \
  --wait --timeout=5m
echo "NGINX Ingress Controller installed"

echo "=== Installing cert-manager (shared TLS for all apps) ==="
helm repo add jetstack https://charts.jetstack.io --force-update
helm repo update
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true \
  --set resources.requests.cpu=50m \
  --set resources.requests.memory=64Mi \
  --wait --timeout=5m
echo "cert-manager installed"

echo "=== Applying platform K8s resources (ClusterIssuer) ==="
kubectl apply -f "$REPO_ROOT/infrastructure/k8s/platform/"
echo "ClusterIssuer applied"

echo "=== Creating GitHub Actions OIDC service principal (no expiring secrets) ==="
SP_NAME="sp-sm2gk-github-actions"
GITHUB_SUBJECT_PREPROD="repo:${GITHUB_REPO}:ref:refs/heads/releasev1"
GITHUB_SUBJECT_PROD="repo:${GITHUB_REPO}:ref:refs/heads/main"

SP_APP_ID=$(az ad sp list --display-name "$SP_NAME" --query "[0].appId" -o tsv 2>/dev/null || true)
if [ -z "${SP_APP_ID:-}" ]; then
  SP_APP_ID=$(az ad sp create-for-rbac --name "$SP_NAME" --skip-assignment --query "appId" -o tsv)
  echo "Created service principal: $SP_APP_ID"
else
  echo "Using existing service principal: $SP_APP_ID"
fi

ACR_ID=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query "id" -o tsv)

# AcrPush: build and push images from CI/CD
az role assignment create --assignee "$SP_APP_ID" --role "AcrPush" \
  --scope "$ACR_ID" --output none 2>/dev/null || true
# Contributor on RG for kubectl access (get-credentials)
az role assignment create --assignee "$SP_APP_ID" --role "Azure Kubernetes Service Cluster User Role" \
  --scope "$(az aks show --resource-group "$RESOURCE_GROUP" --name "$AKS_NAME" --query id -o tsv)" \
  --output none 2>/dev/null || true

# OIDC federated credentials: releasev1 → preprod deploys, main → prod deploys
SP_APP_OBJECT_ID=$(az ad app show --id "$SP_APP_ID" --query "id" -o tsv)
for SUBJECT in "$GITHUB_SUBJECT_PREPROD" "$GITHUB_SUBJECT_PROD"; do
  CRED_NAME="github-$(echo "$SUBJECT" | sed 's|.*refs/heads/||')"
  az ad app federated-credential create \
    --id "$SP_APP_OBJECT_ID" \
    --parameters "{
      \"name\": \"${CRED_NAME}\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"${SUBJECT}\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }" --output none 2>/dev/null || echo "  Federated credential '${CRED_NAME}' may already exist"
done
echo "GitHub Actions OIDC federated credentials created"

echo "=== Getting ingress LoadBalancer IP (may take up to 5 min) ==="
for i in $(seq 1 30); do
  INGRESS_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx \
    -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
  if [ -n "${INGRESS_IP:-}" ]; then break; fi
  echo "  Waiting... ($i/30)"
  sleep 10
done

# Set GitHub Actions variables if gh CLI is available
if command -v gh &>/dev/null; then
  echo "=== Setting GitHub Actions variables via gh CLI ==="
  gh variable set AZURE_CLIENT_ID       --body "$SP_APP_ID"          --repo "$GITHUB_REPO"
  gh variable set AZURE_TENANT_ID       --body "$AZURE_TENANT_ID"    --repo "$GITHUB_REPO"
  gh variable set AZURE_SUBSCRIPTION_ID --body "$SUBSCRIPTION_ID"    --repo "$GITHUB_REPO"
  gh variable set ACR_NAME              --body "$ACR_NAME"           --repo "$GITHUB_REPO"
  gh variable set ACR_LOGIN_SERVER      --body "$ACR_LOGIN_SERVER"   --repo "$GITHUB_REPO"
  gh variable set AKS_CLUSTER           --body "$AKS_NAME"           --repo "$GITHUB_REPO"
  gh variable set AKS_RESOURCE_GROUP    --body "$RESOURCE_GROUP"     --repo "$GITHUB_REPO"
  echo "GitHub Actions variables set"
fi

echo ""
echo "============================================================"
echo "  SM2GK Platform Setup Complete"
echo "============================================================"
echo ""
echo "  AKS Cluster:        $AKS_NAME"
echo "  ACR:                $ACR_LOGIN_SERVER"
echo "  Key Vault:          $KV_NAME"
echo "  Resource Group:     $RESOURCE_GROUP"
echo ""
if [ -n "${INGRESS_IP:-}" ]; then
  echo "  Ingress IP: $INGRESS_IP"
  echo "  → GoDaddy DNS: Add A records pointing to this IP:"
  echo "    lofibooks.sm2gk.com        → $INGRESS_IP"
  echo "    preprod.lofibooks.sm2gk.com → $INGRESS_IP"
else
  echo "  Ingress IP not yet assigned. Check:"
  echo "    kubectl get svc -n ingress-nginx"
fi
echo ""
echo "  Next step: deploy each app+env:"
echo "    bash infrastructure/scripts/deploy-app.sh lofibooks preprod"
echo "    bash infrastructure/scripts/deploy-app.sh lofibooks prod"
echo ""
