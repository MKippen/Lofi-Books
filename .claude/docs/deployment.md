# Deployment Runbook

## Initial Platform Setup (one-time)

```bash
# Prerequisites: az login, helm, kubectl, docker, gh auth login

export AZURE_SUBSCRIPTION_ID="a989f0bf-5286-4d53-83b7-61b3a7ce82fb"
export GITHUB_REPO="MKippen/Lofi-Books"

bash infrastructure/scripts/setup-cluster.sh
```

Creates: `rg-sm2gk`, `aks-sm2gk`, `acrsm2gk`, `kv-sm2gk`, `law-sm2gk`,
NGINX Ingress Controller, cert-manager, ClusterIssuer, GitHub OIDC SP.

## Deploy an App+Env (repeatable for each app and environment)

```bash
# Preprod first
bash infrastructure/scripts/deploy-app.sh lofibooks preprod

# Production
bash infrastructure/scripts/deploy-app.sh lofibooks prod
```

Creates: MSI `id-lofibooks-<env>`, federated credential, KV secrets, K8s namespace + workloads.

## Build & Push Images (first time, or for manual deploys)

```bash
bash infrastructure/scripts/build-push.sh lofibooks
```

## Set GoDaddy DNS (manual — output from setup-cluster.sh)

In GoDaddy DNS for sm2gk.com, add:
| Type | Name | Value |
|------|------|-------|
| A | `lofibooks` | `<ingress-ip>` |
| A | `preprod.lofibooks` | `<ingress-ip>` |

TTL: 600

## Update Entra App Registration (manual)

1. portal.azure.com → Entra ID → App Registrations → find Lofi-Books app
2. Authentication → Add redirect URI: `https://lofibooks.sm2gk.com/`
3. Also add: `https://preprod.lofibooks.sm2gk.com/`
4. Under "Implicit grant and hybrid flows" → check "ID tokens"
5. Save

## Verify Deployment

```bash
kubectl get pods -n lofibooks          # Running
kubectl get pods -n lofibooks-preprod   # Running
kubectl get certificate -n lofibooks    # READY=True (takes ~2 min post-DNS)
curl https://lofibooks.sm2gk.com/api/health
curl https://preprod.lofibooks.sm2gk.com/api/health
```

## Adding a Second App to the Platform

```bash
# 1. Create app Bicep (copy/modify infrastructure/bicep/apps/lofibooks/)
# 2. Create K8s manifests (copy/modify infrastructure/k8s/apps/lofibooks/)
# 3. Create GitHub Actions workflows (copy/modify .github/workflows/deploy-lofibooks-*)
# 4. Deploy:
bash infrastructure/scripts/deploy-app.sh zeroproof preprod
bash infrastructure/scripts/deploy-app.sh zeroproof prod
bash infrastructure/scripts/build-push.sh zeroproof
# 5. Add DNS A record for zeroproof.sm2gk.com (same ingress IP)
# No cluster changes needed — shared platform handles it automatically
```

## Scaling the Node Pool

```bash
# Upgrade to more RAM (handles 3-5 small apps)
az aks nodepool update \
  --resource-group rg-sm2gk --cluster-name aks-sm2gk \
  --name nodepool1 --node-vm-size Standard_B2ms

# Add a second node (horizontal scale)
az aks nodepool scale \
  --resource-group rg-sm2gk --cluster-name aks-sm2gk \
  --name nodepool1 --node-count 2
```
