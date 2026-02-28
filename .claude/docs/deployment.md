# Deployment Runbook

## Initial Deployment

### Prerequisites
- Azure CLI (`az`) logged in: `az login`
- Helm installed: `brew install helm`
- kubectl installed: `brew install kubectl`
- gh CLI authenticated: `gh auth login`
- Docker running

### Step 1: Set environment variables
```bash
export AZURE_SUBSCRIPTION_ID="<your-subscription-id>"
export GITHUB_REPO="MKippen/Lofi-Books"
# OpenAI key is read from .env automatically
```

### Step 2: Run the setup script
```bash
bash infrastructure/scripts/setup-azure.sh
```

This script:
1. Deploys Bicep (AKS, ACR, Key Vault, Log Analytics, MSI, budget alerts)
2. Stores OpenAI API key and MSAL client ID in Key Vault
3. Creates Workload Identity federated credential
4. Creates GitHub Actions OIDC federated credential (no stored secrets)
5. Installs NGINX Ingress Controller + cert-manager via Helm
6. Applies all K8s manifests
7. Sets GitHub variables and secrets via `gh`
8. Outputs the ingress LoadBalancer IP

### Step 3: Build and push Docker images (first time)
```bash
ACR_SERVER=$(az acr show --name acrlofibooks prod --query loginServer -o tsv)
az acr login --name acrlofibooks prod

# Frontend
docker build \
  --build-arg VITE_MSAL_CLIENT_ID=$(grep VITE_MSAL_CLIENT_ID .env | cut -d= -f2) \
  --build-arg VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/consumers \
  -t ${ACR_SERVER}/lofi-books-frontend:latest .
docker push ${ACR_SERVER}/lofi-books-frontend:latest

# Backend
docker build -t ${ACR_SERVER}/lofi-books-api:latest server/
docker push ${ACR_SERVER}/lofi-books-api:latest
```

### Step 4: Set DNS in GoDaddy (manual)
The setup script outputs the ingress IP. In GoDaddy DNS Management for sm2gk.com:
- Type: A
- Name: lofibooks
- Value: `<ingress-ip>`
- TTL: 600

### Step 5: Update Entra App Registration (manual)
1. Go to portal.azure.com → Entra ID → App Registrations → Lofi-Books
2. Authentication → Add platform → SPA → Redirect URI: `https://lofibooks.sm2gk.com/`
3. Under "Implicit grant and hybrid flows" → check "ID tokens"
4. Save

### Step 6: Verify
```bash
# All pods running
kubectl get pods -n lofi-books

# TLS cert issued (takes ~2 min after DNS propagates)
kubectl get certificate -n lofi-books

# Health check
curl https://lofibooks.sm2gk.com/api/health
```

---

## Ongoing Deployments (CI/CD)

Push to `releasev1` branch → GitHub Actions:
1. Builds and pushes frontend + backend images with git SHA tag
2. `kubectl set image` on both deployments
3. Waits for rollout completion
4. Verifies pods are Ready

---

## Adding a New App to the Cluster

1. Create a new namespace:
   ```bash
   kubectl create namespace my-new-app
   ```

2. Create a new Workload Identity MSI:
   ```bash
   az identity create --name id-my-new-app --resource-group rg-lofi-books-prod --location eastus
   ```

3. Grant it Key Vault Secrets User role for its secrets

4. Create K8s manifests (copy `infrastructure/k8s/` as a template, update names)

5. Add an Ingress rule for `mynewapp.sm2gk.com` (references same `letsencrypt-prod` ClusterIssuer)

6. Add DNS A record in GoDaddy pointing to the same ingress IP

TLS cert is issued automatically. No changes to existing infrastructure needed.
