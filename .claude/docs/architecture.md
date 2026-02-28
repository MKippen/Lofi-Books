# SM2GK Platform Architecture

## Overview

The SM2GK platform is a generic Azure Kubernetes Service cluster at `aks-sm2gk` that hosts
multiple apps as isolated namespaces. Lofibooks is one app; zeroproof, and others will follow.
Infrastructure naming is app-agnostic. Apps are isolated via namespaces, network policies,
and per-app MSIs with minimal Key Vault access.

## Platform Components

```
rg-sm2gk (Resource Group)
├── aks-sm2gk          — Single AKS cluster (all apps, prod + preprod namespaces)
├── acrsm2gk           — Container registry (all app images)
├── kv-sm2gk           — Key Vault (all app secrets, prefixed by app+env)
└── law-sm2gk          — Log Analytics (all cluster logs)
```

## Cluster Namespace Layout

```
aks-sm2gk:
  ingress-nginx/           ← Shared NGINX Ingress Controller (1 LoadBalancer IP)
  cert-manager/            ← Shared cert-manager + ClusterIssuer (Let's Encrypt)
  lofibooks/               ← lofibooks PROD  → lofibooks.sm2gk.com
  lofibooks-preprod/       ← lofibooks PREPROD → preprod.lofibooks.sm2gk.com
  zeroproof/               ← [future] zeroproof PROD
  zeroproof-preprod/       ← [future] zeroproof PREPROD
```

## Request Flow

```
User → HTTPS → GoDaddy A record → Azure Load Balancer (single IP)
  → NGINX Ingress Controller
    → lofibooks.sm2gk.com /api → lofibooks/lofibooks-api   (port 3001, Express.js)
    → lofibooks.sm2gk.com /    → lofibooks/lofibooks-frontend (port 80, nginx SPA)
    → preprod.lofibooks.sm2gk.com → lofibooks-preprod/...
```

## Key Vault Secret Naming

Secrets are prefixed to isolate apps and environments in the shared vault:
```
lofibooks-prod-openai-api-key
lofibooks-prod-msal-client-id
lofibooks-preprod-openai-api-key
lofibooks-preprod-msal-client-id
zeroproof-prod-stripe-key       ← future
```

Each app's MSI (`id-lofibooks-prod`, `id-lofibooks-preprod`) has `Key Vault Secrets User`
role on the vault — can read ALL secrets. Future: scope to secret-level RBAC when GA.

## Authentication (Lofibooks)

```
1. User logs in with Microsoft personal account (MSAL, consumers tenant)
2. MSAL stores ID token in localStorage
3. Every API call sends: Authorization: Bearer <id-token>
4. Backend validates: JWKS public keys from Microsoft (no stored secrets, no rotation)
5. Backend extracts: userId from 'oid' claim → per-user SQLite isolation
```

## CI/CD Flow

```
releasev1 push → CI tests → build images → deploy to lofibooks-preprod
main push      → promote same image (no rebuild) → deploy to lofibooks (prod)
```

Images are tagged by git SHA and promoted between environments — what runs in preprod
is exactly what runs in prod.

## Adding a New App (e.g., zeroproof)

1. Create `infrastructure/bicep/apps/zeroproof/identity.bicep`
2. Create `infrastructure/k8s/apps/zeroproof/base/` + `overlays/prod/` + `overlays/preprod/`
3. Add `.github/workflows/deploy-zeroproof-preprod.yml` + `deploy-zeroproof-prod.yml`
4. Run `deploy-app.sh zeroproof prod` + `deploy-app.sh zeroproof preprod`
5. Add A record in GoDaddy pointing `zeroproof.sm2gk.com` to the same ingress IP
6. cert-manager issues TLS cert automatically
