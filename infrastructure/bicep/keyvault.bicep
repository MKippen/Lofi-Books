param location string
param vaultName string
param workloadIdentityPrincipalId string

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true   // RBAC mode (not legacy access policies)
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: false    // Allow purge during dev; set true for production lock-down
  }
}

// Grant the workload MSI read-only access to secrets — principle of least privilege
resource kvSecretUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, workloadIdentityPrincipalId, 'KeyVaultSecretsUser')
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6'  // Key Vault Secrets User
    )
    principalId: workloadIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output vaultName string = kv.name
output vaultUri string = kv.properties.vaultUri
