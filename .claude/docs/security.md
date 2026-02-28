# Security Architecture — SM2GK Platform

## Credential Philosophy: Zero Rotation, MSI-First

| Credential | Mechanism | Rotation |
|-----------|-----------|----------|
| AKS → ACR | MSI (kubelet identity, AcrPull role) | None needed |
| AKS pod → Key Vault | Workload Identity MSI per app+env | None needed |
| GitHub Actions → Azure | OIDC federation (no client secret) | None needed |
| TLS certificates | cert-manager + Let's Encrypt | Automatic (30d before expiry) |
| JWT validation keys | JWKS public keys (cached, auto-follows Microsoft rotation) | None needed |
| OpenAI API key | Stored once in Key Vault | None (key doesn't expire) |

## Platform Isolation

Each app+env has its own:
- **MSI** (`id-lofibooks-prod`, `id-lofibooks-preprod`) — separate Azure identities
- **K8s Namespace** — network policies enforce namespace-level isolation
- **Key Vault secrets** — prefixed `<app>-<env>-*` for logical separation
  (full secret-level RBAC scoping is future work when Azure RBAC for KV secrets is GA)
- **SecretProviderClass** — each references only its own prefixed secrets

## Network Policies (per namespace)

```
Default: deny all ingress
Allow: ingress-nginx → frontend:80
Allow: ingress-nginx → backend:3001
Allow: backend → all egress (OpenAI, Graph, Key Vault, DNS)
Block: frontend → backend directly (must go through ingress)
Block: cross-namespace pod communication
```

## JWT Authentication (Lofibooks backend)

- Token type: MSAL **ID token** (aud: clientId, RS256)
- JWKS URI: `https://login.microsoftonline.com/consumers/discovery/v2.0/keys`
- Validation: `jsonwebtoken` + `jwks-rsa` with 10-min key cache
- Microsoft rotates JWKS keys; the `jwks-rsa` client follows automatically — no action needed
- Health endpoint `/api/health` is excluded from auth (used by K8s probes)

## Workload Identity Flow

```
Pod label: azure.workload.identity/use=true
SA annotation: azure.workload.identity/client-id=<msi-client-id>
  ↓
Workload Identity mutating webhook injects projected SA token
  ↓
CSI Secret Store driver uses token → authenticates to Key Vault (no secret)
  ↓
Secrets mounted at /mnt/secrets-store/ and synced to K8s Secret
  ↓
Pod reads OPENAI_API_KEY + MSAL_CLIENT_ID from env vars
```

## Container Security

- Backend: non-root user (`appuser`, UID 1001), `runAsNonRoot: true`
- `allowPrivilegeEscalation: false` on all containers
- `seccompProfile: RuntimeDefault` on all pods
- Resource limits set to prevent one pod from starving others

## TLS

- cert-manager + Let's Encrypt (HTTP-01 challenge via NGINX)
- Shared `letsencrypt-prod` ClusterIssuer across all apps
- HSTS header: `max-age=31536000; includeSubDomains`
- Auto-renewal 30 days before expiry — zero manual cert management ever
