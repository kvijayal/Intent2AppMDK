---
name: mdk-migration
version: 0.4.0
description: >
  Use when migrating an MDK project to a newer schema version, understanding
  what changed between MDK schema versions, checking if a feature is available
  in a specific schema version, or fixing validation errors after migration.
  Trigger on: "migrate MDK project", "upgrade to schema 26.3", "what changed in
  26.6", "migrate from 25.9 to 26.3", "what's new in MDK 26.6", "migration path",
  "schema version", "breaking changes", "deprecated properties", "migrate offline
  OData", "migrate to latest schema".
source: SAP/mdk-mcp-server (Apache-2.0) — res/schemas/
---

# MDK Metadata Migration Guide

This skill covers migrating MDK projects between schema versions — what changed,
what broke, what's new, and the exact CLI command to run.

---

## Supported Schema Versions

| Version | Status | Notes |
|---|---|---|
| **26.6** | Latest | AI FormCells, Stepper, FilterBar, ProgressMessages |
| **26.3** | Stable | AppSettings, Validation improvements |
| **25.9** | Supported | Calendar events, BooleanOrString, CalendarQueryTarget |
| **25.6** | Supported | Grouping in DataTable, ListPickerSearch, GenerateContent AI action, UploadStore |
| **24.11** | Supported | AI Core ChatCompletions action |
| **24.7** | Legacy | Oldest supported version |

---

## Migration Command

Always migrate using the MDK CLI — never edit metadata files manually:

```bash
# Migrate to latest schema version
npx @sap/mdk-tools migrate --project .

# Always validate immediately after migration
npx @sap/mdk-tools validate --project .
```

---

## Migration Path (Never Skip Versions)

```
24.7 → 24.11 → 25.6 → 25.9 → 26.3 → 26.6
```

The migration tool handles each step. If you are on 24.7 and want 26.6, run
`migrate` once — it will traverse all intermediate versions automatically.

---

## How to Check Current Schema Version

```bash
cat .project.json | grep -i schema
```

Or read `.project.json` directly — look for `"SchemaVersion": "26.3"`.

---

## What's New Per Version

### 26.6 (Latest)

**New FormCell controls:**
- `Control.Type.FormCell.AIFeedback` — thumbs up/down feedback control for AI-generated content
- `Control.Type.FormCell.AINotice` — disclaimer/notice banner for AI-generated content
- `Control.Type.FormCell.Stepper` — numeric increment/decrement stepper

**New styles:**
- `AIFeedbackBackgroundClass`, `AIFeedbackCaptionClass`
- `AINoticeBackgroundClass`, `AINoticeCaptionClass`
- `StepperFormCellClass`, `FilterBarClass`, `FilterBarItemClass`, `VoteButtonsClass`

**New FilterBar control:**
- `Control.Type.FilterBar` — inline filter bar embedded directly in a SectionedTable section
- Supports `ListPicker`, `Segmented`, `Switch`, `Slider`, `SimpleQuery`, `MultiSorter` sub-controls

**New ProgressMessages definition:**
Custom offline sync progress messages with placeholders:
```json
{
  "ProgressMessages": {
    "BuildingEntityStore": "Building local store... ({0}/{1})",
    "DownloadingEntityStore": "Downloading... {2} of {3}",
    "LoadingMetadata": "Loading metadata... ({0}/{1})"
  }
}
```
Placeholders: `{0}` = current step, `{1}` = total steps, `{2}/{3}` = step-specific values.

**Migration impact:** Low. New controls are additive. No breaking changes. Existing metadata runs unchanged.

---

### 26.3

**New AppSettings definition in Application.app:**
```json
{
  "Settings": {
    "UseInAppCamera": true
  }
}
```
`UseInAppCamera` (Android only) — uses in-app camera instead of device default camera for `FormCell.Attachment` "Take Photo" option.

**Validation definition improvements:**
`Validation` object now supports `SeparatorVisible` (iOS/WebClient only) and `Styles.ValidationView` for custom validation background color.

**Migration impact:** Low. New optional properties only. No breaking changes.

---

### 25.9

**New Calendar features:**
- `CalendarQueryTarget` definition — dedicated target for Calendar sections with OData binding
- `CalendarDateRange` control — selectable date ranges on Calendar sections
- `CalendarEvent` and `Indicator` sub-controls for Calendar

**New BooleanOrString type:**
Certain properties that previously only accepted `boolean` now also accept a rule reference string. Allows dynamic boolean values via rules without requiring full rule rewrites.

**Migration impact:** Low. Existing calendar metadata remains valid. New controls are additive.

---

### 25.6

**New DataTable Grouping:**
```json
{
  "_Type": "Section.Type.DataTable",
  "Grouping": {
    "GroupingProperties": ["Country", "City"],
    "Header": {
      "Items": [{
        "Title": "Group: {Country}, {City}",
        "Styles": { "Title": "DataTableGroupHeaderItem" }
      }]
    }
  },
  "Target": {
    "EntitySet": "MyEntities",
    "Service": "/AppName/Services/MyService.service",
    "QueryOptions": "$orderby=Country,City"
  }
}
```
`QueryOptions` must include `$orderby` on the same properties as `GroupingProperties`.

**New ListPickerSearch:**
ListPicker now supports inline search. Add `Search` to `FormCell.ListPicker`:
```json
{
  "_Type": "Control.Type.FormCell.ListPicker",
  "Search": {
    "Enabled": true,
    "Placeholder": "{i18n>Search_Placeholder}",
    "MinimumCharacterThreshold": 1
  }
}
```

**New AI Action:**
`Action.Type.AICore.GenerateContent` — SAP AI Core content generation (Gemini/Vertex AI backend).

**New OfflineOData action:**
`Action.Type.OfflineOData.UploadStore` — uploads the entire offline store as a file to a backend:
```json
{
  "_Type": "Action.Type.OfflineOData.UploadStore",
  "Service": "/AppName/Services/MyService.service",
  "Note": "Optional note",
  "EncryptionKey": "optional-key"
}
```

**Migration impact:** Low. All new features are additive.

---

### 25.6 — Stepper (added in 26.6, noted here for reference)

If migrating from below 25.6, the `FormCell.Stepper` control is not available. Do not use it until migrated to 26.6.

---

### 24.11

**New AI Action:**
`Action.Type.AICore.ChatCompletions` — SAP AI Core chat completions (OpenAI-compatible backend):
```json
{
  "_Type": "Action.Type.AICore.ChatCompletions",
  "Target": {
    "Service": "/AppName/Services/MyService.service"
  },
  "Properties": {
    "Messages": [{ "role": "user", "content": "Summarize this work order." }],
    "ModelName": "gpt-4"
  }
}
```

**Migration impact:** None — purely additive new action type.

---

## Breaking Change History

No schema version upgrade in the MDK 24.7–26.6 range introduced hard breaking changes that would cause existing working metadata to stop functioning. The MDK migration tool handles all property renames and removals automatically.

**However, these patterns commonly cause validation failures after migration:**

### Pattern 1 — Hardcoded strings (any version)
The validator flags any `Caption`, `Title`, `Message`, `Placeholder` that is a hardcoded string rather than `{i18n>Key}`. This has always been flagged but validation strictness increased in 25.6.

**Fix:**
```json
// Before
"Caption": "My Entity List"
// After
"Caption": "{i18n>MyEntity_List_Caption}"
```

### Pattern 2 — `_Type` missing on nested controls (24.x projects)
Older MDK projects generated before 24.7 sometimes omit `_Type` on nested FormCell controls. The validator requires it in all versions.

**Fix:** Add `"_Type": "Control.Type.FormCell.SimpleProperty"` (or appropriate type) to every control.

### Pattern 3 — Deprecated `Action.Type.ODataService.Open` (removed in 25.6)
Projects using `Action.Type.ODataService.Open` (from schema 24.7) fail in 25.6+.

**Fix:** Replace with `Action.Type.ODataService.Initialize`:
```json
// Before (24.7)
{ "_Type": "Action.Type.ODataService.Open" }
// After (25.6+)
{ "_Type": "Action.Type.ODataService.Initialize" }
```

### Pattern 4 — Deprecated `Action.Type.ODataService.Create` (removed in 25.6)
The old `Create` action (without `Entity` suffix) is removed in 25.6+.

**Fix:** Replace with `Action.Type.ODataService.CreateEntity`.

### Pattern 5 — `OfflineOData/Initialize.schema` moved (24.7 → 24.11)
In 24.7, offline initialization used `Action.Type.ODataService.Initialize` with `Offline: true`. In 24.11+ it became `Action.Type.OfflineOData.Initialize`.

**Fix:** The migration tool handles this automatically. If migrating manually, update `_Type`.

---

## Migration Checklist

Run after every migration:

```bash
# Step 1 — Migrate
npx @sap/mdk-tools migrate --project .

# Step 2 — Validate
npx @sap/mdk-tools validate --project .
```

Then manually check:

- [ ] No hardcoded strings in `Caption`, `Title`, `Message`, `Placeholder` properties
- [ ] All controls have `_Type`
- [ ] No deprecated action types (`ODataService.Open`, `ODataService.Create`)
- [ ] `DataSubscriptions` arrays reference entity sets that still exist in the service
- [ ] Rule file paths in metadata still match actual rule files on disk
- [ ] i18n keys referenced in metadata all exist in `i18n.properties`

---

## Version Compatibility Matrix

| Feature | 24.7 | 24.11 | 25.6 | 25.9 | 26.3 | 26.6 |
|---|---|---|---|---|---|---|
| `FormCell.Attachment` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Action.AICore.ChatCompletions` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Action.AICore.GenerateContent` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `Action.OfflineOData.UploadStore` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `DataTable.Grouping` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `ListPicker.Search` | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `CalendarDateRange` | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `AppSettings.UseInAppCamera` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `FormCell.AIFeedback` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `FormCell.AINotice` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `FormCell.Stepper` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `FilterBar` section control | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `ProgressMessages` (offline) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Reference

- MDK Release Notes: https://help.sap.com/docs/MDK/977416d43cd74bdc958289038749100e
- MDK CLI: `npm info @sap/mdk-tools`
- Source: SAP/mdk-mcp-server `res/schemas/`
