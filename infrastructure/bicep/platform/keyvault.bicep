// Key Vault — shared platform secret store for all apps.
// Secrets are namespaced by app and environment: <app>-<env>-<secret-name>
// Each app's MSI is granted Key Vault Secrets User at the individual secret level
// via deploy-app.sh (not here) — principle of least privilege.
param location string
param vaultName string

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true   // RBAC mode for fine-grained per-secret access
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: false
  }
}

output vaultName string = kv.name
output vaultUri string = kv.properties.vaultUri
output vaultId string = kv.id
