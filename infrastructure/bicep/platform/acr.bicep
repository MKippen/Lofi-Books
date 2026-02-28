// Container Registry — shared across all apps and environments on this platform.
// Admin access disabled: image pulls use AKS kubelet MSI (AcrPull role).
// Image names: acrsm2gk.azurecr.io/<app>-<component>:<git-sha>
param location string
param acrName string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false  // MSI-only; no username/password credentials
  }
}

output acrId string = acr.id
output acrName string = acr.name
output loginServer string = acr.properties.loginServer
