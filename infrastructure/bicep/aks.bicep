param location string
param clusterName string
param acrId string
param logAnalyticsWorkspaceId string

resource aks 'Microsoft.ContainerService/managedClusters@2024-01-01' = {
  name: clusterName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'Base'
    tier: 'Free'  // Saves ~$72/mo vs Standard; no SLA but fine for personal project
  }
  properties: {
    dnsPrefix: clusterName
    kubernetesVersion: '1.29'

    agentPoolProfiles: [
      {
        name: 'nodepool1'
        count: 1
        vmSize: 'Standard_B2s'  // 2 vCPU, 4 GB RAM
        osType: 'Linux'
        osDiskSizeGB: 32
        osDiskType: 'Managed'
        type: 'VirtualMachineScaleSets'
        mode: 'System'
        enableAutoScaling: false
      }
    ]

    networkProfile: {
      networkPlugin: 'azure'
      networkPolicy: 'calico'  // Required for NetworkPolicy resources
      serviceCidr: '10.0.0.0/16'
      dnsServiceIP: '10.0.0.10'
    }

    addonProfiles: {
      omsagent: {
        enabled: true
        config: {
          logAnalyticsWorkspaceResourceID: logAnalyticsWorkspaceId
        }
      }
      azureKeyvaultSecretsProvider: {
        enabled: true
        config: {
          enableSecretRotation: 'true'
          rotationPollInterval: '5m'
        }
      }
    }

    // Enable OIDC issuer + Workload Identity (MSI-first, no service principal secrets)
    oidcIssuerProfile: {
      enabled: true
    }
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
  }
}

// Grant AKS kubelet MSI the AcrPull role on the registry — no credentials needed
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(aks.id, acrId, 'AcrPull')
  scope: resourceGroup()
  properties: {
    roleDefinitionId: subscriptionResourceId(
      'Microsoft.Authorization/roleDefinitions',
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'  // AcrPull
    )
    principalId: aks.properties.identityProfile.kubeletidentity.objectId
    principalType: 'ServicePrincipal'
  }
}

output clusterName string = aks.name
output oidcIssuerUrl string = aks.properties.oidcIssuerProfile.issuerURL
output kubeletPrincipalId string = aks.properties.identityProfile.kubeletidentity.objectId
