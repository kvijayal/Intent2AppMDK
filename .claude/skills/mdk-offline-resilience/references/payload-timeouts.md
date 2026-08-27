# MDK Large Payload Timeout — Development Fixes

*Part of the mdk-offline-resilience skill. Use when writing DefiningRequests and sync action chains that need to handle large datasets.*

## Timeout Prevention Checklist

| Area | Rule | Example |
|---|---|---|
| DefiningRequests | Always use `$top` | `WorkOrders?$top=200` |
| DefiningRequests | Filter to user-relevant data | `$filter=AssignedTo eq '${me}'` |
| DefiningRequests | Order by most recent | `$orderby=CreatedAt desc` |
| DefiningRequests | Exclude closed/archived | `$filter=Status ne 'Closed'` |
| Entity sets | Split large sets across multiple requests | Use separate DefiningRequest per entity |
| Attachments | Never include binary in DefiningRequests | Use streaming media URLs instead |
| Initialize | Show progress indicator | `ShowActivityIndicator: true` |
| Upload | Limit batch size | Process in chunks of 50-100 ops |

## DefiningRequest Size Guidelines

| Entity row count | Risk level | Action |
|---|---|---|
| < 500 | Low | Safe to sync |
| 500 – 2,000 | Medium | Add `$filter` to reduce scope |
| 2,000 – 10,000 | High | Add `$top` + user-scope filter required |
| > 10,000 | Critical | Delta sync or pagination required |

## Recommended DefiningRequest Patterns

### Field worker pattern (safe)
```json
"DefiningRequests": [
  { "Name": "MyOpenOrders",   "Query": "WorkOrders?$top=50&$filter=TechnicianId eq '${userId}' and Status eq 'Open'&$orderby=DueDate asc" },
  { "Name": "RecentCustomers","Query": "Customers?$top=100&$filter=LastVisit gt ${thirtyDaysAgo}" },
  { "Name": "Equipment",      "Query": "Equipment?$top=200&$select=EquipId,Name,Location,Status" }
]
```

### Delta sync pattern (reduces payload over time)
```json
"DefiningRequests": [
  { "Name": "ChangedSince", "Query": "WorkOrders?$filter=ModifiedAt gt '${lastSyncTime}'&$top=500" }
]
```

### Progressive load pattern (critical data first)
```json
// Phase 1 — Initialize with critical only
"DefiningRequests": [
  { "Name": "UrgentOrders", "Query": "WorkOrders?$top=20&$filter=Priority eq 'High' and Status eq 'Open'" }
]
// Phase 2 — Add secondary after first launch succeeds
// Use AddDefiningRequest action
```

## ProgressMessages Template (schema 26.6+)

```json
{
  "_Type": "Action.Type.OfflineOData.Initialize",
  "ShowActivityIndicator": true,
  "ActivityIndicatorText": "{i18n>Initializing_Message}",
  "ProgressMessages": {
    "BuildingEntityStore":    "{i18n>Progress_Building}",
    "DownloadingEntityStore": "{i18n>Progress_Downloading}",
    "LoadingMetadata":        "{i18n>Progress_Metadata}"
  }
}
```

```properties
Initializing_Message=Setting up offline storage...
Progress_Building=Building local store ({0}/{1})...
Progress_Downloading=Downloading data, please wait...
Progress_Metadata=Loading service configuration ({0}/{1})...
```

## Mobile Services Timeout Settings

Configure in BTP Cockpit → Mobile Services → App → Mobile Connectivity → Destination:

| Setting | Default | Recommended for large payload |
|---|---|---|
| Connection Timeout | 30s | 60s |
| Read Timeout | 60s | 120s–180s |
| Max Payload Size | varies | Contact Mobile Services admin |

## Network Conditions by Region

Plan DefiningRequest sizes for the weakest network your users will experience:

| Network | Effective bandwidth | Max safe payload |
|---|---|---|
| 4G LTE | ~10 Mbps | Up to 5MB per sync |
| 3G | ~1 Mbps | Up to 500KB per sync |
| 2G / EDGE | ~100 Kbps | Up to 50KB — delta sync only |
| WiFi (warehouse) | ~50 Mbps | Up to 20MB per sync |
