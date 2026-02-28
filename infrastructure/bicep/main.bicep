targetScope = 'subscription'

@description('Azure region for all resources')
param location string = 'eastus'

@description('Environment suffix')
param environment string = 'prod'

@description('Email for budget alerts and cert-manager')
param alertEmail string = 'mike@sm2gk.com'

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-lofi-books-${environment}'
  location: location
}

module monitoring './monitoring.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    workspaceName: 'law-lofi-books-${environment}'
  }
}

module acr './acr.bicep' = {
  name: 'acr'
  scope: rg
  params: {
    location: location
    acrName: 'acrlofibooks${environment}'
  }
}

module identity './identity.bicep' = {
  name: 'identity'
  scope: rg
  params: {
    location: location
    identityName: 'id-lofi-books-workload-${environment}'
  }
}

module keyvault './keyvault.bicep' = {
  name: 'keyvault'
  scope: rg
  params: {
    location: location
    vaultName: 'kv-lofi-books-${environment}'
    workloadIdentityPrincipalId: identity.outputs.principalId
  }
}

module aks './aks.bicep' = {
  name: 'aks'
  scope: rg
  params: {
    location: location
    clusterName: 'aks-lofi-books-${environment}'
    acrId: acr.outputs.acrId
    logAnalyticsWorkspaceId: monitoring.outputs.workspaceId
  }
}

// Cost budget with email alerts at 80% and 100% of $150/month
resource budget 'Microsoft.Consumption/budgets@2021-10-01' = {
  name: 'lofi-books-monthly-${environment}'
  properties: {
    category: 'Cost'
    amount: 150
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: '2026-03-01'
      endDate: '2028-12-31'
    }
    filter: {
      dimensions: {
        name: 'ResourceGroupName'
        operator: 'In'
        values: ['rg-lofi-books-${environment}']
      }
    }
    notifications: {
      threshold80: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 80
        contactEmails: [alertEmail]
        thresholdType: 'Actual'
      }
      threshold100: {
        enabled: true
        operator: 'GreaterThanOrEqualTo'
        threshold: 100
        contactEmails: [alertEmail]
        thresholdType: 'Actual'
      }
    }
  }
}

output aksClusterName string = aks.outputs.clusterName
output aksOidcIssuerUrl string = aks.outputs.oidcIssuerUrl
output acrLoginServer string = acr.outputs.loginServer
output keyVaultName string = keyvault.outputs.vaultName
output keyVaultUri string = keyvault.outputs.vaultUri
output workloadIdentityClientId string = identity.outputs.clientId
output workloadIdentityPrincipalId string = identity.outputs.principalId
output resourceGroupName string = rg.name
