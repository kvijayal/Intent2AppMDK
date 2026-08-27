# MDK Schema Version Matrix

*Part of the mdk-migration skill.*

## Feature Availability by Version

| Feature | 24.7 | 24.11 | 25.6 | 25.9 | 26.3 | 26.6 |
|---|---|---|---|---|---|---|
| `FormCell.Attachment` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Section.Type.DataTable` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Section.Type.Timeline` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Section.Type.Calendar` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Action.Type.AICore.ChatCompletions` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Action.Type.AICore.GenerateContent` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `Action.Type.OfflineOData.UploadStore` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `DataTable.Grouping` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `FormCell.ListPicker.Search` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `CalendarDateRange` control | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `CalendarQueryTarget` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `AppSettings.UseInAppCamera` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `Validation.SeparatorVisible` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `FormCell.AIFeedback` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `FormCell.AINotice` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `FormCell.Stepper` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `Control.Type.FilterBar` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `ProgressMessages` (offline) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Breaking Changes History

| Version | Change | Fix |
|---|---|---|
| 25.6 | `Action.Type.ODataService.Open` removed | Replace with `Action.Type.ODataService.Initialize` |
| 25.6 | `Action.Type.ODataService.Create` removed | Replace with `Action.Type.ODataService.CreateEntity` |
| 24.11 | Offline Initialize syntax changed | Run `mdkcli migrate` — handled automatically |

## Migration Path

Never skip versions. Migrate in order:

```
24.7 → 24.11 → 25.6 → 25.9 → 26.3 → 26.6
```

## Migration Commands

```bash
# Read current schema version
cat .project.json | grep SchemaVersion

# Migrate to latest
npx @sap/mdk-tools migrate --project .

# Always validate after migration
npx @sap/mdk-tools validate --project .
```

## Post-Migration Checklist

- [ ] `validate` passes with 0 errors
- [ ] No hardcoded strings that the validator now flags more strictly
- [ ] No deprecated `_Type` values (run `validate` to catch these)
- [ ] `DataSubscriptions` still reference entity sets that exist in the service
- [ ] Rule file paths in metadata still match actual files on disk
- [ ] i18n keys referenced in metadata all exist in `i18n.properties`
