# MDK Binding & i18n Reference

*Part of the mdk-patterns skill.*

## Binding Syntax

| Pattern | Use | Example |
|---|---|---|
| `{PropertyName}` | OData property from current binding context | `{Name}` |
| `{@odata.readLink}` | OData read link of current entity (Update/Delete Target) | `"ReadLink": "{@odata.readLink}"` |
| `{{#Property:Name}}` | Explicit property reference | `{{#Property:FirstName}} {{#Property:LastName}}` |
| `{{#ActionResults:name/#Property:error}}` | Action result error message | `"{{#ActionResults:createProduct/#Property:error}}"` |
| `{i18n>KeyName}` | Localized string | `{i18n>Products_Name_Label}` |
| `#Control:Name/#Value` | SimpleProperty, Switch, DatePicker, Note value | `"#Control:Name/#Value"` |
| `#Control:Name/#SelectedValue` | ListPicker selected value | `"#Control:Category/#SelectedValue"` |
| `/AppName/Rules/Name.js` | Rule reference (computed at runtime) | `"/AppName/Rules/Products/StatusColor.js"` |
| `$(N,{Price},'',{minimumFractionDigits:2})` | Number format expression | Shows price with 2 decimal places |
| `$(D,{Date},'',{format:'medium'})` | Date format expression | Shows date in medium format |
| `$(D,{DateTime},'',{format:'short',time:'short'})` | Date + time format | |

## Rules

1. `{PropertyName}` reads from the current OData entity binding — the entity must be in the Target
2. `#Control:Name/#Value` — `Name` must exactly match the control's `_Name` property
3. `#Control:Name/#SelectedValue` for ListPicker — `/#Value` returns an array, not a string
4. Rule references must include the file extension: `/AppName/Rules/Folder/Name.js`
5. Number format `$(N,...)` locale defaults to device locale — specify explicitly for consistent output
6. Date format `$(D,...)` respects the device timezone — use `timezone` param for UTC

## i18n Key Naming Convention

```properties
# Page captions
Products_List_Caption=Products
Products_Detail_Caption=Product Details
Products_Create_Caption=Create Product
Products_Edit_Caption=Edit Product

# Field labels (EntityName_PropertyName_Label)
Products_Name_Label=Name
Products_Price_Label=Price
Products_Category_Label=Category
Products_Active_Label=Active

# Placeholders
Products_Name_Placeholder=Enter product name

# Section headers
Details_Header=Details
Dimensions_Header=Dimensions

# Buttons (shared across entities)
Save_Button=Save
Cancel_Button=Cancel
Delete_Button=Delete
Edit_Button=Edit
Create_Button=Create
Sync_Button=Sync

# Common UI
Search_Placeholder=Search
NoItems=No items found

# Messages (EntityName_Operation_Message)
CreateSuccess_Message=Record created successfully
UpdateSuccess_Message=Record updated successfully
DeleteSuccess_Message=Record deleted successfully
ValidationFailed_Message=Please fill in all required fields
SyncFailed_Message=Sync failed. Please try again.

# Dialog
Delete_Title=Confirm Delete
Delete_Confirmation=Are you sure you want to delete this record?

# Offline
Initializing_Message=Initializing...
Syncing_Message=Syncing data...
SyncSuccess_Message=Sync completed
```

## Rules for i18n

6. All user-visible strings must use `{i18n>Key}` — never hardcode text in metadata JSON
7. Read existing `i18n.properties` before adding keys to avoid duplicates
8. Share common button keys (`Save_Button`, `Cancel_Button`, etc.) across all entities
9. Entity-specific keys follow `EntityName_PropertyName_Type` pattern
10. Use `{i18n>Key, [param]}` for parametric strings: `items_count={0} items` → `{i18n>items_count, [{count}]}`

## Anti-Patterns

```
❌ "Caption": "Products" → hardcoded string, fails i18n
❌ #Control:Category/#Value for ListPicker → returns array, not selected string
❌ /AppName/Rules/StatusColor (no .js) → file reference broken
❌ {Name} in a page with no Target binding → renders empty
❌ $(N,{Price}) without locale → inconsistent formatting across device locales
```
