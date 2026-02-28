# Security Architecture

## Credential Philosophy: Zero Rotation, MSI-First

This deployment is designed so you **never need to rotate credentials**:

| Credential | Mechanism | Rotation |
|-----------|-----------|----------|
| AKS → ACR | MSI (kubelet identity, AcrPull role) | None needed |
| AKS pod → Key Vault | Workload Identity MSI | None needed |
| GitHub Actions → Azure | OIDC federation (no client secret) | None needed |
| TLS certificates | cert-manager + Let's Encrypt | Automatic (30 days before expiry) |
| JWT validation keys | JWKS public keys (jwks-rsa client caches) | Microsoft rotates, our code follows |
| OpenAI API key | Stored in Key Vault once | None (key doesn't expire) |

## JWT Authentication

The backend validates Microsoft ID tokens:
- **JWKS URI**: `https://login.microsoftonline.com/consumers/discovery/v2.0/keys`
- **Audience**: `MSAL_CLIENT_ID` (the Entra app client ID)
- **Issuer**: `https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0`
- **Algorithm**: RS256

The `jwks-rsa` client caches public keys and re-fetches them when Microsoft rotates.
No client secret involved — validation uses asymmetric public keys only.

## Workload Identity (MSI)

The backend pod uses Azure Workload Identity to access Key Vault:
1. Pod has label `azure.workload.identity/use: "true"`
2. ServiceAccount annotated with `azure.workload.identity/client-id: <MSI-client-id>`
3. AKS OIDC issuer issues a projected service account token
4. The Workload Identity mutating webhook injects env vars + volume mount
5. The CSI Secret Store driver uses the token to authenticate to Key Vault

**Result**: No credentials in pod spec, environment variables, or code. Secrets arrive as files at `/mnt/secrets-store/` and as a K8s Secret `lofi-books-env-secrets`.

## Network Policies

Default deny-all ingress in the `lofi-books` namespace:
- ✅ ingress-nginx → frontend (port 80)
- ✅ ingress-nginx → backend (port 3001)
- ✅ backend → external (all egress: OpenAI, Graph, Key Vault, DNS)
- ❌ frontend → backend directly (blocked — all traffic routes through ingress)
- ❌ Any pod from other namespaces reaching lofi-books pods

## Encryption

- **In transit**: TLS everywhere (Let's Encrypt cert via cert-manager)
- **At rest**: Azure Managed Disk uses AES-256 with platform-managed keys

## CORS

Restricted to `https://lofibooks.sm2gk.com` via `ALLOWED_ORIGINS` env var.
In local dev (no env var set), defaults to localhost:5174/5173.

## Container Security

- Backend: runs as non-root user (`appuser`, UID 1001)
- `allowPrivilegeEscalation: false` on backend container
- `seccompProfile: RuntimeDefault` on all pods
- Resource limits set on all containers

## Entra App Registration

- Client type: Public (SPA) — no client secret
- Redirect URIs: `https://lofibooks.sm2gk.com/`, `http://localhost:5174`
- ID token issuance: enabled (used as Bearer token for API auth)
- Scopes requested: `User.Read`, `Files.ReadWrite` (for OneDrive backup)
