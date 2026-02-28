param location string
param acrName string

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false  // MSI-only pull; no username/password credentials
  }
}

output acrId string = acr.id
output loginServer string = acr.properties.loginServer
