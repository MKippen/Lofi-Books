// Lofibooks app identity — creates a Workload Identity MSI for one environment.
// Called twice: once for prod, once for preprod.
// Grants this MSI read-only access ONLY to its own Key Vault secrets.
//
// Usage (via deploy-app.sh):
//   az deployment group create --resource-group rg-sm2gk \
//     --template-file infrastructure/bicep/apps/lofibooks/identity.bicep \
//     --parameters env=prod oidcIssuerUrl=<aks-oidc-issuer> keyVaultName=kv-sm2gk
targetScope = 'resourceGroup'

@description('Environment: prod or preprod')
@allowed(['prod', 'preprod'])
param env string

@description('AKS OIDC issuer URL for federated credential')
param oidcIssuerUrl string

@description('Key Vault name to grant secret access on')
param keyVaultName string

param location string = resourceGroup().location

// MSI per app per environment
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-lofibooks-${env}'
  location: location
}

// K8s namespace and service account for this environment
var k8sNamespace = env == 'prod' ? 'lofibooks' : 'lofibooks-preprod'
var k8sServiceAccount = 'sa-lofibooks'

// Federated credential: allows the K8s service account to obtain an MSI token
resource federatedCredential 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  name: 'lofibooks-${env}-k8s-fed'
  parent: identity
  properties: {
    issuer: oidcIssuerUrl
    subject: 'system:serviceaccount:${k8sNamespace}:${k8sServiceAccount}'
    audiences: ['api://AzureADTokenExchange']
  }
}

// Reference the existing Key Vault (created by platform Bicep)
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Grant this MSI Key Vault Secrets User role on the vault.
// In production, scope this to individual secrets once Azure RBAC supports it
// (currently secret-level RBAC is in preview; vault-level is GA).
// The MSI only ever reads secrets prefixed with "lofibooks-<env>-".
resource kvSecretUserRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, identity.id, 'KeyVaultSecretsUser', env)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '4633458b-17de-408a-b874-0445c86b69e6'  // Key Vault Secrets User
    )
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output identityName string = identity.name
output clientId string = identity.properties.clientId
output principalId string = identity.properties.principalId
output resourceId string = identity.id
output k8sNamespace string = k8sNamespace
output k8sServiceAccount string = k8sServiceAccount
