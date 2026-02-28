# Cost Management

## Budget

- Monthly budget: **$150/month** (configured in Bicep)
- Alert at 80% ($120): email to mike@sm2gk.com
- Alert at 100% ($150): email to mike@sm2gk.com

## Estimated Costs

| Resource | SKU | Est. Monthly |
|----------|-----|-------------|
| AKS (Free tier) | 1× Standard_B2s node | ~$35 |
| ACR | Basic | ~$5 |
| Key Vault | Standard | ~$1 |
| Log Analytics | PerGB2018, 30d retention | ~$2-5 |
| Managed Disk (PV) | 4 GiB Standard HDD | ~$0.20 |
| Public IP (ingress) | Standard | ~$4 |
| **Total** | | **~$47-50/month** |

Well within the $150 budget. Remaining ~$100 can accommodate 2-3 additional small apps.

## Multi-App Cost Model

The AKS node, ACR, Key Vault, Log Analytics, and ingress IP are **shared across all apps**. Adding a new app to the cluster adds essentially $0 in fixed infrastructure costs (just the app's PV and storage).

Estimated cost to add a second app: ~$1-2/month (4 GiB PV + minor compute).

## Cost Optimization Tips

- **Free tier AKS**: Currently using Free tier (no SLA). If uptime SLA is needed, Standard tier adds ~$72/month.
- **Standard_B2s** handles both frontend + backend comfortably. Upgrade to B2ms (~$60/mo) only if CPU is consistently > 80%.
- **Log retention**: 30 days is the minimum. Reducing doesn't save much at this scale.
- **Disk**: Standard HDD is fine for SQLite. Premium SSD is unnecessary unless IOPS become a bottleneck.

## Monitoring Cost

```bash
# Check current month cost by resource
az consumption usage list \
  --scope /subscriptions/${AZURE_SUBSCRIPTION_ID}/resourceGroups/rg-lofi-books-prod \
  --start-date $(date +%Y-%m-01) --end-date $(date +%Y-%m-%d) \
  --query "sort_by([].{Resource:instanceName, Cost:pretaxCost}, &Cost)" -o table
```
