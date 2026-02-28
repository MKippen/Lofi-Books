// SM2GK Platform — Azure Infrastructure
// Generic cluster infrastructure for sm2gk.com hosting multiple apps.
// App-specific MSIs and secret access are provisioned separately via deploy-app.sh.
targetScope = 'subscription'

@description('Azure region for all resources')
param location string = 'eastus'

@description('Email for budget and cert-manager alerts')
param alertEmail string = 'mike@sm2gk.com'

// Single resource group for all sm2gk platform infrastructure
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: 'rg-sm2gk'
  location: location
}

module monitoring './monitoring.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    workspaceName: 'law-sm2gk'
  }
}

module acr './acr.bicep' = {
  name: 'acr'
  scope: rg
  params: {
    location: location
    acrName: 'acrsm2gk'
  }
}

module keyvault './keyvault.bicep' = {
  name: 'keyvault'
  scope: rg
  params: {
    location: location
    vaultName: 'kv-sm2gk'
  }
}

module aks './aks.bicep' = {
  name: 'aks'
  scope: rg
  params: {
    location: location
    clusterName: 'aks-sm2gk'
    acrId: acr.outputs.acrId
    logAnalyticsWorkspaceId: monitoring.outputs.workspaceId
  }
}

// Cost budget — covers all sm2gk resources
resource budget 'Microsoft.Consumption/budgets@2021-10-01' = {
  name: 'budget-sm2gk-monthly'
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
        values: ['rg-sm2gk']
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

output resourceGroupName string = rg.name
output aksClusterName string = aks.outputs.clusterName
output aksOidcIssuerUrl string = aks.outputs.oidcIssuerUrl
output acrName string = acr.outputs.acrName
output acrLoginServer string = acr.outputs.loginServer
output keyVaultName string = keyvault.outputs.vaultName
output keyVaultUri string = keyvault.outputs.vaultUri
output logAnalyticsWorkspaceId string = monitoring.outputs.workspaceId
