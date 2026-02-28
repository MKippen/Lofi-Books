# Architecture — Lofi-Books on AKS

## Overview

Lofi-Books is a React 19 + Express.js full-stack writing tool deployed to Azure Kubernetes Service at `lofibooks.sm2gk.com`. The AKS cluster is a **shared platform** — multiple apps can be hosted at different subdomains by adding new namespaces.

## Request Flow

```
User Browser
  ↓ HTTPS (Let's Encrypt cert, auto-renewed by cert-manager)
Azure Load Balancer (static IP, GoDaddy A record)
  ↓
NGINX Ingress Controller (ingress-nginx namespace)
  ├─ /api/* ──→ lofi-books-api Service (ClusterIP :3001)
  │               → lofi-books-api Pod (Express.js)
  │                 → /data/lofi-books.db (SQLite, Azure Managed Disk PV)
  │                 → /data/images/ (image files, same PV)
  │                 → Key Vault secrets via CSI driver (OPENAI_API_KEY, MSAL_CLIENT_ID)
  │                 → OpenAI API (external, HTTPS)
  │                 → Microsoft Graph API (OneDrive backup, HTTPS)
  │
  └─ /* ─────→ lofi-books-frontend Service (ClusterIP :80)
                  → lofi-books-frontend Pod (nginx serving Vite SPA)
```

## Authentication Flow

```
1. User visits https://lofibooks.sm2gk.com/
2. MSAL (Microsoft Authentication Library) redirects to Microsoft login
3. User authenticates with personal Microsoft account (consumers tenant)
4. MSAL stores tokens in localStorage
5. Every API call:
   a. Frontend: msalInstance.acquireTokenSilent() → ID token (aud: clientId)
   b. Frontend: sends Authorization: Bearer <id-token> header
   c. Backend: requireAuth middleware validates token via JWKS public keys
   d. Backend: extracts userId (oid claim) from validated token
   e. Backend: uses userId to isolate user's books/data in SQLite
```

**Why ID token?** The app uses a Public Client (SPA), so access tokens for Graph have `aud: graph.microsoft.com`. The ID token has `aud: clientId`, making it directly validatable by the backend without any shared secret.

## Data Storage

- **Database**: SQLite at `/data/lofi-books.db` (WAL mode for performance)
- **Images**: Binary files at `/data/images/`
- **PV**: Azure Managed Disk (4 GiB Standard HDD, ReadWriteOnce)
- **Encryption**: AES-256 at rest, managed by Azure (platform-managed keys)
- **Replica strategy**: `Recreate` (not RollingUpdate) — SQLite is single-writer

## Namespace Design (Multi-App)

```
ingress-nginx/        ← Shared NGINX Ingress Controller
cert-manager/         ← Shared cert-manager (ClusterIssuer: letsencrypt-prod)
lofi-books/           ← App namespace: lofi-books
  pods: frontend, api
  network policy: default-deny ingress, allow only from ingress-nginx
future-app/           ← Next app: its own namespace, MSI, secrets
```

Adding a new app:
1. Create namespace + workload MSI
2. Add app's secrets to Key Vault
3. Create K8s manifests (deployment, service, pvc, network-policy)
4. Add `host` + `path` rules to the shared ingress OR create a new Ingress with same ingressClass
5. cert-manager issues TLS cert automatically

## Component Versions

| Component | Version |
|-----------|---------|
| Kubernetes | 1.29 |
| Node (runtime) | 22-alpine |
| nginx (frontend) | 1.27-alpine |
| NGINX Ingress | latest (Helm) |
| cert-manager | latest (Helm) |
| MSAL Browser | v5 |
