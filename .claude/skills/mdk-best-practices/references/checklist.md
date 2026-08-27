# MDK Code Review Checklist

*Part of the mdk-best-practices skill.*

Use this before every pull request, deployment, or handover.

## Pages ✅ / ❌

- [ ] All `_Name` values match their filename without extension
- [ ] All `Caption`, `Header.Caption` values use `{i18n>Key}` — zero hardcoded strings
- [ ] Every list page has `Search.Enabled: true` + `EmptySection` set
- [ ] Every detail page starts with `Section.Type.ObjectHeader`
- [ ] Every detail page SectionedTable has `DataSubscriptions: ["EntitySetName"]`
- [ ] Every create/edit page has ActionBar with Cancel (Left) + Save/Create (Right)
- [ ] Primary key fields are NOT present as editable FormCell controls on create pages
- [ ] `$top` is set in every ObjectTable `QueryOptions`
- [ ] FormCell control types match OData Edm types (Boolean→Switch, DateTime→DatePicker)

## Actions ✅ / ❌

- [ ] Every OData action has `ActionResult: { "_Name": "..." }`
- [ ] Every OData action has `OnSuccess` and `OnFailure`
- [ ] Every `OnFailure` ToastMessage uses `{{#ActionResults:name/#Property:error}}`
- [ ] Every Delete operation preceded by a `Message` confirmation dialog
- [ ] Every navigation to Create/Edit uses `ModalPage: true, ModalPageFullscreen: true`
- [ ] Every UpdateEntity/DeleteEntity Target has `"ReadLink": "{@odata.readLink}"`
- [ ] Every ListPicker control uses `/#SelectedValue` in action Properties (not `/#Value`)
- [ ] `CheckRequiredFields` chained before every Create/Update save

## Rules ✅ / ❌

- [ ] All rules use `export default function Name(clientAPI) {}`
- [ ] All rules return a value or Promise — no void rules
- [ ] No `async/await` — Promise chains only (`.then().catch()`)
- [ ] All `.catch()` blocks log the error with `console.error()`
- [ ] ListPicker rules return `[{ ReturnValue, DisplayValue }]`
- [ ] No OData `clientAPI.read()` calls inside per-row bindings (ObjectCell Title, etc.)

## i18n ✅ / ❌

- [ ] Zero hardcoded strings in any `.page` or `.action` file
- [ ] All `{i18n>Key}` references exist in `i18n.properties`
- [ ] No orphaned keys in `i18n.properties` not referenced in any metadata file
- [ ] Key naming follows `EntityName_PropertyName_Label` convention

## Offline (if applicable) ✅ / ❌

- [ ] `UploadOfflineOData` wired before every Create, Update, Delete
- [ ] `DownloadOfflineOData` chained in every `UploadOfflineOData` OnSuccess
- [ ] `ShowActivityIndicator: true` on Initialize, Upload, Download actions
- [ ] `DefiningRequests` use filters — not syncing full unfiltered entity sets

## Deployment ✅ / ❌

- [ ] `.service.metadata` exists in project root
- [ ] `mdkcli validate` passes with **0 errors** (warnings acceptable)
- [ ] CF CLI is logged in (`cf target` shows org and space)
- [ ] Schema version confirmed in `.project.json`
