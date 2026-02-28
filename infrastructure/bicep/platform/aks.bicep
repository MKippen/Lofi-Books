// AKS cluster — generic sm2gk platform cluster.
// Hosts all apps as separate namespaces. Scale by adjusting node count or vmSize.
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
    tier: 'Free'  // ~$72/mo savings; upgrade to Standard for SLA if needed
  }
  properties: {
    dnsPrefix: clusterName
    kubernetesVersion: '1.32'

    agentPoolProfiles: [
      {
        name: 'nodepool1'
        count: 1
        vmSize: 'Standard_B2s'   // 2 vCPU, 4 GB — handles 2-3 small apps
        // Scale: upgrade to B2ms (4GB) or increase count as apps grow
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
      networkPolicy: 'calico'  // Required for NetworkPolicy isolation between namespaces
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
          rotationPollInterval: '5m'  // Auto-syncs KV secret updates to pods
        }
      }
    }

    // OIDC + Workload Identity: MSI-first access for all pods, no credentials in manifests
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

// AKS kubelet MSI gets AcrPull on the registry — no credentials needed for image pulls
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
