# Operational Runbooks

## Check Cluster Health

```bash
# Pod status
kubectl get pods -n lofi-books
kubectl get pods -n ingress-nginx
kubectl get pods -n cert-manager

# Events (recent errors)
kubectl get events -n lofi-books --sort-by='.lastTimestamp' | tail -20

# Logs
kubectl logs -n lofi-books -l app=lofi-books-api --tail=100
kubectl logs -n lofi-books -l app=lofi-books-frontend --tail=50
```

## Debug a Failing Pod

```bash
# Describe pod (events, volume mounts, env vars)
kubectl describe pod -n lofi-books -l app=lofi-books-api

# Check CSI secret store
kubectl get secretproviderclass -n lofi-books
kubectl describe secretproviderclass lofi-books-secrets -n lofi-books

# Exec into pod (if running)
kubectl exec -it -n lofi-books deploy/lofi-books-api -- sh
```

## Check TLS Certificate

```bash
kubectl get certificate -n lofi-books
kubectl describe certificate lofi-books-tls -n lofi-books
# If stuck: check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager --tail=50
```

## Restart a Deployment

```bash
# Rolling restart (triggers new pod)
kubectl rollout restart deployment/lofi-books-api -n lofi-books
kubectl rollout restart deployment/lofi-books-frontend -n lofi-books

# Watch rollout
kubectl rollout status deployment/lofi-books-api -n lofi-books
```

## Manual Deployment (bypass CI/CD)

```bash
# Get ACR server
ACR_SERVER=$(az acr show --name acrlofibooks prod --query loginServer -o tsv)
az acr login --name acrlofibooks prod
IMAGE_TAG=$(git rev-parse --short HEAD)

# Build + push
docker build -t ${ACR_SERVER}/lofi-books-api:${IMAGE_TAG} server/
docker push ${ACR_SERVER}/lofi-books-api:${IMAGE_TAG}

# Deploy
kubectl set image deployment/lofi-books-api api=${ACR_SERVER}/lofi-books-api:${IMAGE_TAG} -n lofi-books
kubectl rollout status deployment/lofi-books-api -n lofi-books
```

## Key Vault Secret Update (OpenAI key)

```bash
export KEY_VAULT_NAME=kv-lofi-books-prod
export NEW_OPENAI_API_KEY=sk-proj-...
bash infrastructure/scripts/rotate-secrets.sh
# CSI driver auto-syncs within 5 minutes, no restart needed
```

## Scale Node Pool

```bash
# Scale to 2 nodes (if resources are tight)
az aks nodepool scale \
  --resource-group rg-lofi-books-prod \
  --cluster-name aks-lofi-books-prod \
  --name nodepool1 \
  --node-count 2
```

## Backup Database

The OneDrive backup feature is built into the app (Backup button in the UI). For a manual backup:

```bash
# Copy SQLite file from pod to local
kubectl exec -n lofi-books deploy/lofi-books-api -- \
  sqlite3 /data/lofi-books.db ".backup /tmp/backup.db"
kubectl cp lofi-books/$(kubectl get pod -n lofi-books -l app=lofi-books-api -o jsonpath='{.items[0].metadata.name}'):/tmp/backup.db ./backup-$(date +%Y%m%d).db
```

## View Costs

```bash
# Current month spend
az consumption usage list \
  --scope /subscriptions/${AZURE_SUBSCRIPTION_ID}/resourceGroups/rg-lofi-books-prod \
  --start-date $(date +%Y-%m-01) \
  --end-date $(date +%Y-%m-%d) \
  --query "[].{name:instanceName, cost:pretaxCost}" -o table
```
