// Log Analytics — shared workspace collecting logs from all cluster namespaces.
param location string
param workspaceName string

resource law 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: workspaceName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

output workspaceId string = law.id
output workspaceName string = law.name
