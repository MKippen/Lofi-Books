# Lofibooks Infrastructure Notes

This repo no longer carries its own AKS or Kubernetes deployment model.

Supported production deployment path:
- frontend -> Azure Static Web Apps
- backend -> Azure Container Apps
- secrets -> Azure Key Vault
- data -> Azure Files

Primary infra owner repo:
- `/Users/mike/code/sm2gk`

Useful local scripts:
- `infrastructure/scripts/deploy-app.sh`
- `infrastructure/scripts/rotate-secret.sh`
- `infrastructure/scripts/setup-dns.sh`
