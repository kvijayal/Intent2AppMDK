---
name: mdk-rules-library
version: 0.4.0
description: >
  Use when writing or asking about MDK JavaScript rules. Trigger on: "add a rule
  for", "write a rule that", "give me a rule to", "how do I write a rule",
  "rule for list picker", "visibility rule", "rule to read OData", "rule to count",
  "rule to navigate", "rule to set binding", "OnLoaded rule", "filter rule",
  "format number in a rule", "UpdateLinks rule", "rule for status color",
  "rule to get action result", "rule to show/hide a section", "rule to redraw",
  "rule to validate", "clientAPI", "getPageProxy", "evaluateTargetPath",
  "createLinkSpecifierProxy", "NativeScript in rules".
source: SAP/mdk-mcp-server (Apache-2.0) — res/templates/Rule/
---

# MDK Rules Library

MDK rules are JavaScript ES6 modules that add application logic to the metadata-driven
app. Rules receive a `clientAPI` (or proxy) parameter and return a value. They run
client-side inside the MDK NativeScript runtime — no server, no REST call.

---

## Anatomy of a Rule

```js
/**
 * @param {IClientAPI} clientAPI
 */
export default function RuleName(clientAPI) {
  // logic here
  return value; // or Promise
}
```

**Required:**
- ES6 default export
- Single `clientAPI` parameter
- Must return a value or `Promise`

**Reference path in metadata:**
```
"/AppName/Rules/FolderName/RuleName.js"
```

---

## clientAPI Proxy Types

The type of `clientAPI` depends on where the rule is referenced:

| Reference context | Proxy type | Extra methods |
|---|---|---|
| `OnLoaded`, `OnPageLoaded` | `IPageProxy` | `setCaption()`, `setActionBarItemVisible()` |
| FormCell `OnValueChange` | `IFormCellProxy` | `getValue()`, `getTargetSpecifier()`, `setTargetSpecifier()` |
| Section `Target` / `Footer` | `ISectionProxy` | `getSections()`, `setIndicatorState()` |
| ActionBar item `OnPress` | `IControlProxy` | `getParent()`, `getName()` |
| OData action `OnSuccess/OnFailure` | `IClientAPI` | `getActionResult()` |
| Rule called from another rule | `IClientAPI` | base interface only |

All proxy types extend `IClientAPI` — all base methods are always available.

---

## Base clientAPI Methods (Always Available)

```js
// Page & navigation
clientAPI.getPageProxy()               // → IPageProxy
clientAPI.executeAction('/App/Actions/MyAction.action')  // run an action
clientAPI.getActionResult('actionName')  // → IActionResult (in OnSuccess/OnFailure)

// Binding & data
clientAPI.binding                      // current entity binding object
clientAPI.getBindingObject()           // same as .binding
clientAPI.setActionBinding(obj)        // set navigation binding for next page

// Evaluate target paths
clientAPI.evaluateTargetPath('#Page:PageName/#Control:ControlName')
clientAPI.evaluateTargetPath('#Page:PageName/#Control:ControlName/#Value')

// OData reads (async)
clientAPI.read(service, entitySet, [], queryOptions)   // → Promise<result>
clientAPI.count(service, entitySet, queryOptions)      // → Promise<number>

// OData links
clientAPI.createLinkSpecifierProxy(navPropName, entitySet, queryOptions, readLink)

// Formatting
clientAPI.formatNumber(value, locale, options)
clientAPI.formatCurrency(value, currencyCode, locale, options)
clientAPI.formatPercentage(value, locale, options)
clientAPI.formatDatetime(date, locale, timezone)
clientAPI.formatDate(date, locale)
clientAPI.formatTime(date, locale, timezone)

// i18n
clientAPI.localizeText('i18n_key')
clientAPI.localizeText('i18n_key', [param1, param2])
clientAPI.getLanguage()
clientAPI.setLanguage('en')
clientAPI.getSupportedLanguages()

// App info
clientAPI.getAppName()
clientAPI.getAppClientData()

// Logger
clientAPI.getLogger()       // → ILoggerManager
clientAPI.initializeLogger(fileName, maxFileSizeMB)

// NativeScript modules
clientAPI.nativescript.platformModule       // iOS/Android detection
clientAPI.nativescript.fileSystemModule     // file I/O
clientAPI.nativescript.connectivityModule   // network status
clientAPI.nativescript.appSettingsModule    // key-value store
clientAPI.nativescript.applicationModule    // app lifecycle
```

---

## Rule Category 1 — Visibility & Conditionals

### Always Return True / False

```js
export default function AlwaysTrue() {
  return true;
}
```

```js
export default function AlwaysFalse() {
  return false;
}
```

### Visibility Based on Binding Property

```js
/**
 * Returns true if the entity Status is not 'Closed'.
 * Use as: IsVisible, IsEditable, or ActionBar item Visible binding.
 * @param {IClientAPI} clientAPI
 */
export default function IsEditVisible(clientAPI) {
  return clientAPI.binding.Status !== 'Closed';
}
```

### Visibility Based on User Role (clientData)

```js
export default function IsAdminVisible(clientAPI) {
  const userData = clientAPI.getAppClientData();
  return userData && userData.userRole === 'admin';
}
```

### Toggle Section Visibility

```js
/**
 * Shows all sections in the SectionedTable except the last.
 * @param {IClientAPI} context
 */
export default function SetVisible(context) {
  const sections = context.getPageProxy()
    .getControl('SectionedTable0')
    .getSections();
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i].setVisible(true, false);  // (visible, animated)
  }
}
```

### Conditional Navigation

```js
export default function NavBasedOnStatus(clientAPI) {
  const status = clientAPI.binding.Status;
  if (status === 'Open') {
    return clientAPI.executeAction('/AppName/Actions/NavToEdit.action');
  }
  return clientAPI.executeAction('/AppName/Actions/NavToDetail.action');
}
```

---

## Rule Category 2 — OData Reads

### Read OData and Return a Value

```js
/**
 * Reads one entity and returns a derived value.
 * @param {IClientAPI} clientAPI
 */
export default function GetReadLink(clientAPI) {
  const serviceName = '/AppName/Services/MyService.service';
  const entitySet   = 'EntitySetName';
  const queryOptions = `$filter=Id eq '${clientAPI.binding.Id}'`;

  return clientAPI.read(serviceName, entitySet, [], queryOptions)
    .then(result => {
      if (result && result.length > 0) {
        return result.getItem(0)['@odata.readLink'];
      }
      return '';
    })
    .catch(err => {
      console.error('GetReadLink error:', err);
      return '';
    });
}
```

### Count Entity Set (List Footer / KPI)

```js
/**
 * Returns formatted count string for ObjectTable footer.
 * @param {IClientAPI} controlProxy
 */
export default function EntityCount(controlProxy) {
  const serviceName = '/AppName/Services/MyService.service';
  const entitySet   = 'EntitySetName';

  return controlProxy.count(serviceName, entitySet, '')
    .then(result => `${result} items`)
    .catch(() => '');
}
```

### Count with Filter

```js
export default function OpenOrdersCount(controlProxy) {
  const serviceName = '/AppName/Services/MyService.service';
  const entitySet   = 'SalesOrders';
  const queryOptions = "$filter=Status eq 'Open'";

  return controlProxy.count(serviceName, entitySet, queryOptions)
    .then(result => result > 0 ? `${result} Open` : 'None Open')
    .catch(() => '0');
}
```

### Read Related Entity Count (Navigation Property)

```js
export default function RelatedItemsCount(clientAPI) {
  const serviceName = '/AppName/Services/MyService.service';
  const readLink    = clientAPI.binding['@odata.readLink'];
  const entitySet   = `${readLink}/LineItems`;

  return clientAPI.count(serviceName, entitySet, '')
    .then(result => `${result} line items`)
    .catch(() => '');
}
```

### Remaining Operations (Offline Pending Changes)

```js
/**
 * Returns the number of pending offline operations.
 * Use as ObjectTable footer count or KPI.
 * @param {IClientAPI} controlProxy
 */
export default function RemainingOperations(controlProxy) {
  const operations = controlProxy.getBindingObject();
  return operations ? operations.length : 0;
}
```

---

## Rule Category 3 — ListPicker Items

### Static Item List

```js
/**
 * Returns static items for a FormCell.ListPicker.
 * @param {IClientAPI} context
 */
export default function GetStatusItems(context) {
  return [
    { ReturnValue: 'Open',       DisplayValue: 'Open' },
    { ReturnValue: 'InProgress', DisplayValue: 'In Progress' },
    { ReturnValue: 'Completed',  DisplayValue: 'Completed' },
    { ReturnValue: 'Closed',     DisplayValue: 'Closed' }
  ];
}
```

### OData-Backed ListPicker Items (Async)

```js
export default function GetCategoryItems(clientAPI) {
  const serviceName = '/AppName/Services/MyService.service';
  const entitySet   = 'Categories';
  const queryOptions = '$orderby=Name asc';

  return clientAPI.read(serviceName, entitySet, [], queryOptions)
    .then(result => {
      const items = [];
      for (let i = 0; i < result.length; i++) {
        const item = result.getItem(i);
        items.push({
          ReturnValue: item.CategoryId,
          DisplayValue: item.Name
        });
      }
      return items;
    })
    .catch(() => []);
}
```

### ListPicker with ObjectCell Display

```js
export default function GetEquipmentObjectCellItems(context) {
  return [
    {
      ObjectCell: {
        Title: 'Pump Unit A',
        Subhead: 'EQ-1001',
        DetailImage: 'sap-icon://machine'
      },
      ReturnValue: 'EQ-1001'
    },
    {
      ObjectCell: {
        Title: 'Compressor B',
        Subhead: 'EQ-2002',
        DetailImage: 'sap-icon://technical-object'
      },
      ReturnValue: 'EQ-2002'
    }
  ];
}
```

### Dynamic ListPicker Items (Change Based on Other Control)

```js
/**
 * Updates ListPicker items based on a Segmented control value.
 * @param {IFormCellProxy} controlProxy  — the Segmented control
 */
export default function UpdateListPickerItems(controlProxy) {
  const selection = controlProxy.getValue()[0].ReturnValue;
  const container = controlProxy.getPageProxy().getControl('SectionedTable0');
  const listPicker = container.getControl('CategoryListPicker');
  const specifier  = listPicker.getTargetSpecifier();

  specifier.setEntitySet('Categories');
  specifier.setService('/AppName/Services/MyService.service');
  specifier.setDisplayValue('{Name}');
  specifier.setReturnValue('{CategoryId}');
  specifier.setQueryOptions(
    selection === 'All' ? '' : `$filter=Type eq '${selection}'`
  );

  listPicker.setTargetSpecifier(specifier);
}
```

---

## Rule Category 4 — Navigation & Binding

### Set Navigation Binding and Navigate

```js
/**
 * Sets a custom binding object and navigates to a page.
 * Use when you need to pass data that isn't in the current entity binding.
 * @param {IClientAPI} clientAPI
 */
export default function NavWithCustomBinding(clientAPI) {
  const pageProxy = clientAPI.getPageProxy();
  pageProxy.setActionBinding({
    CustomProp: 'value',
    EntityId: clientAPI.binding.Id
  });
  return pageProxy.executeAction('/AppName/Actions/NavToDetail.action');
}
```

### Navigate Based on Action Result

```js
/**
 * After CreateEntity succeeds, navigate to the detail page of the new entity.
 * Used in OnSuccess of CreateEntity action.
 * @param {IClientAPI} clientAPI
 */
export default function NavAfterCreate(clientAPI) {
  const result = clientAPI.getActionResult('CreateEntity');
  if (result && result.data) {
    clientAPI.getPageProxy().setActionBinding(result.data);
    return clientAPI.executeAction('/AppName/Actions/NavToDetail.action');
  }
  return clientAPI.executeAction('/AppName/Actions/NavBackToList.action');
}
```

---

## Rule Category 5 — Action Results

### Get Created Entity Data (OnSuccess)

```js
/**
 * Returns a toast message with the created entity description.
 * Used as the Message value in a ToastMessage action chained after Create.
 * @param {IClientAPI} clientAPI
 */
export default function CreateEntityMessage(clientAPI) {
  const result = clientAPI.getActionResult('CreateEntity');
  if (result && result.data) {
    return `Created: "${result.data.Name}"`;
  }
  return 'Entity created successfully';
}
```

### Get Error Detail (OnFailure)

```js
/**
 * Returns the backend error message for a failed OData action.
 * Use as Message in a ToastMessage OnFailure action.
 * @param {IClientAPI} clientAPI
 */
export default function CreateEntityFailMessage(clientAPI) {
  const result = clientAPI.getActionResult('CreateEntity');
  if (result && result.error) {
    if (result.error.responseCode > 0) {
      return result.error.responseBody; // backend error JSON
    }
    return result.error.message;        // full error string
  }
  return 'Operation failed';
}
```

---

## Rule Category 6 — Formatting

### Status Color

```js
/**
 * Returns a hex color based on entity Status.
 * Use in ObjectCell StatusTextColor or ObjectHeader StatusTextColor.
 * @param {IClientAPI} clientAPI
 */
export default function StatusColor(clientAPI) {
  switch (clientAPI.binding.Status) {
    case 'Open':        return '#107E3E'; // SAP Green
    case 'InProgress':  return '#E9730C'; // SAP Orange
    case 'Completed':   return '#0070F2'; // SAP Blue
    case 'Closed':      return '#6A6D70'; // SAP Grey
    default:            return '#BB0000'; // SAP Red
  }
}
```

### Format Number

```js
export default function FormatPrice(clientAPI) {
  return clientAPI.formatNumber(
    clientAPI.binding.Price,
    'en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );
}
```

### Format Currency

```js
export default function FormatCurrency(clientAPI) {
  return clientAPI.formatCurrency(
    clientAPI.binding.Amount,
    clientAPI.binding.CurrencyCode || 'USD',
    'en-US'
  );
}
```

### Computed Display Value

```js
export default function FullName(clientAPI) {
  const { FirstName, LastName } = clientAPI.binding;
  return `${LastName}, ${FirstName}`;
}
```

---

## Rule Category 7 — Page & Control Manipulation (OnLoaded)

### OnLoaded — Set Page Caption Dynamically

```js
/**
 * Sets the page caption to include binding data.
 * Reference as: "OnLoaded": "/AppName/Rules/Entity_Detail_OnLoaded.js"
 * @param {IPageProxy} pageProxy
 */
export default function EntityDetailOnLoaded(pageProxy) {
  const name = pageProxy.binding.Name || 'Detail';
  pageProxy.setCaption(name);
}
```

### OnLoaded — Prepopulate Edit Form

```js
/**
 * Populates edit form fields from the current entity binding.
 * @param {IPageProxy} pageProxy
 */
export default function EntityEditOnLoaded(pageProxy) {
  const container = pageProxy.getControl('SectionedTable0');
  const nameCell  = container.getControl('NameFormCell');
  nameCell.setValue(pageProxy.binding.Name || '');
}
```

### Redraw a Section

```js
export default function RedrawSection(clientAPI) {
  const pageProxy = clientAPI.getPageProxy();
  const section   = pageProxy.getControl('SectionedTable0')
                             .getSections()[0];
  section.redraw();
}
```

### Set ActionBar Item Visible

```js
export default function ToggleEditButton(pageProxy) {
  const isOpen = pageProxy.binding.Status === 'Open';
  pageProxy.setActionBarItemVisible(0, isOpen); // 0 = first right item
}
```

---

## Rule Category 8 — OData Associations (UpdateLinks)

### UpdateLinks — Set Navigation Property (Association)

```js
/**
 * Returns a link specifier array to set a navigation property (association) in UpdateEntity.
 * Add to UpdateEntity action: "UpdateLinks": "/AppName/Rules/UpdateEquipmentLink.js"
 * @param {IClientAPI} ClientAPI
 */
export default function UpdateEquipmentLink(ClientAPI) {
  const container  = ClientAPI.getControl('SectionedTable0');
  const listPicker = container.getControl('EquipmentListPicker');
  const links      = [];

  if (listPicker.getValue().length > 0) {
    const selectedId  = listPicker.getValue()[0].ReturnValue;
    const queryOption = `$filter=EquipId eq '${selectedId}'`;
    const link        = ClientAPI.createLinkSpecifierProxy(
      'Equipment',          // navigation property name
      'MyEquipments',       // entity set
      queryOption,          // filter to find the target entity
      ''                    // readLink (empty = use query)
    );
    links.push(link.getSpecifier());
  }
  return links;
}
```

---

## Rule Category 9 — Filter & Query

### Build Filter from Form Controls

```js
/**
 * Returns filter criteria from a filter page's controls.
 * Use as the "OnApply" rule of a Filter action.
 * @param {IClientAPI} clientAPI
 */
export default function SaveFilters(clientAPI) {
  const status   = clientAPI.evaluateTargetPath('#Page:FilterPage/#Control:StatusPicker/#Value');
  const category = clientAPI.evaluateTargetPath('#Page:FilterPage/#Control:CategoryPicker/#Value');
  return [status, category];
}
```

### Dynamic QueryOptions from ClientData

```js
export default function GetFilteredQueryOptions(clientAPI) {
  const clientData = clientAPI.getPageProxy().context.clientData;
  const filter     = clientData.activeFilter || '';
  return filter ? `$filter=Status eq '${filter}'` : '';
}
```

### DataSubscriptions — Dynamic Entity List

```js
/**
 * Returns entity set names that this page should watch for changes.
 * Use in SectionedTable "DataSubscriptions" property.
 * @param {IClientAPI} proxy
 */
export default function DataSubscriptions(proxy) {
  return ['Products', 'Categories'];
}
```

---

## Rule Category 10 — NativeScript Platform

### Detect iOS vs Android

```js
export default function GetPlatformText(clientAPI) {
  const platform = clientAPI.nativescript.platformModule;
  return platform.isAndroid ? 'Android' : 'iOS';
}
```

### Read/Write App Settings (Key-Value Store)

```js
export default function SaveUserPreference(clientAPI) {
  const appSettings = clientAPI.nativescript.appSettingsModule;
  appSettings.setString('lastViewedEntity', clientAPI.binding.Id);
  return clientAPI.binding.Id;
}

export default function GetUserPreference(clientAPI) {
  const appSettings = clientAPI.nativescript.appSettingsModule;
  return appSettings.getString('lastViewedEntity', '');
}
```

### Check Network Connectivity

```js
export default function IsOnline(clientAPI) {
  const connectivity = clientAPI.nativescript.connectivityModule;
  const type = connectivity.getConnectionType();
  // 0 = none, 1 = wifi, 2 = mobile
  return type !== 0;
}
```

---

## Rule Writing Rules (Always Follow)

1. Always use `export default function` — only ES6 default exports work in MDK
2. Single parameter only — MDK passes exactly one `clientAPI` argument
3. Always return a value — void rules cause unpredictable behavior
4. Async operations must return a `Promise` — use `.then().catch()` not `async/await`
5. Never use `require()` for NativeScript modules — use `clientAPI.nativescript.*`
6. For ListPicker items: always return `[{ ReturnValue, DisplayValue }]`
7. For color rules: use hex strings (`'#107E3E'`), not CSS color names
8. When accessing controls: always use `getControl('_Name')` — `_Name` must match exactly
9. Log errors with `console.error()`, never `throw` — uncaught errors crash the rule silently
10. For `evaluateTargetPath`: use exact page `_Name` and control `_Name` values from metadata

---

## Metadata Reference Path

Rules are referenced in metadata as:

```json
"OnLoaded": "/AppName/Rules/Entity/EntityDetail_OnLoaded.js"
"IsVisible": "/AppName/Rules/Entity/IsEditVisible.js"
"Items":     "/AppName/Rules/Entity/GetStatusItems.js"
"Target.QueryOptions": "/AppName/Rules/Entity/GetFilterQuery.js"
"UpdateLinks": "/AppName/Rules/Entity/UpdateEquipmentLink.js"
"StatusTextColor": "/AppName/Rules/Entity/StatusColor.js"
"Footer.AttributeLabel": "/AppName/Rules/Entity/EntityCount.js"
```

The path starts from the app root (e.g. `/AppName/`) and the filename must match the exported function name.
