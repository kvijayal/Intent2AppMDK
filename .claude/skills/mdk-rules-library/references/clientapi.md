# MDK clientAPI Reference

*Part of the mdk-rules-library skill.*

## Rules

1. Rules are ES6 modules — always `export default function Name(clientAPI) {}`
2. Single `clientAPI` parameter — MDK passes exactly one argument
3. Always return a value or Promise — void rules cause unpredictable behavior
4. Use `.then().catch()` for async — `async/await` is not supported in MDK NativeScript runtime
5. Always log errors in `.catch()` — `console.error('context:', err)` — never swallow silently
6. ListPicker Items rule must return `[{ ReturnValue: 'key', DisplayValue: 'label' }]`
7. Color rules return hex strings (`'#107E3E'`) — not CSS color names
8. `getControl('_Name')` — `_Name` must exactly match the control's `_Name` in the page metadata

## Base clientAPI Methods

```javascript
// OData reads (async — return Promise)
clientAPI.read(service, entitySet, [], queryOptions)   // → Promise<IDataSet>
clientAPI.count(service, entitySet, queryOptions)      // → Promise<number>
clientAPI.createLinkSpecifierProxy(navProp, entitySet, queryOptions, readLink)

// Current binding
clientAPI.binding                                      // current entity object
clientAPI.getBindingObject()                           // same as .binding

// Page & navigation
clientAPI.getPageProxy()                               // → IPageProxy
clientAPI.executeAction('/App/Actions/Name.action')   // run an action
clientAPI.setActionBinding(obj)                        // set binding for next page

// Cross-page control access
clientAPI.evaluateTargetPath('#Page:PageName/#Control:ControlName')
clientAPI.evaluateTargetPath('#Page:PageName/#Control:ControlName/#Value')

// Action results (in OnSuccess/OnFailure rules)
clientAPI.getActionResult('actionResultName')          // → IActionResult

// Formatting
clientAPI.formatNumber(value, locale, options)
clientAPI.formatCurrency(value, currencyCode, locale)
clientAPI.formatDate(date, locale)
clientAPI.formatDatetime(date, locale, timezone)
clientAPI.localizeText('i18n_key')
clientAPI.localizeText('i18n_key', [param1, param2])
clientAPI.getLanguage()

// App
clientAPI.getAppName()
clientAPI.getAppClientData()

// NativeScript modules
clientAPI.nativescript.platformModule       // iOS/Android detection
clientAPI.nativescript.appSettingsModule    // key-value store
clientAPI.nativescript.connectivityModule   // network status
clientAPI.nativescript.fileSystemModule     // file I/O
```

## IPageProxy Methods (OnLoaded context)

```javascript
pageProxy.setCaption(text)
pageProxy.setActionBarItemVisible(index, visible)   // index 0 = first right item
pageProxy.getControl('SectionedTable0')             // → ISectionedTable
pageProxy.binding                                   // current entity
pageProxy.context.clientData                        // page-level state
```

## IFormCellProxy Methods (OnValueChange)

```javascript
controlProxy.getValue()                     // → current value
controlProxy.getTargetSpecifier()           // → ITargetSpecifier
controlProxy.setTargetSpecifier(specifier)  // update ListPicker query dynamically
```

## ISectionedTable Methods

```javascript
const table = pageProxy.getControl('SectionedTable0');
table.getSections()                         // → array of sections
table.getControl('ControlName')             // get named control
table.redraw()                              // force refresh
```

## Common Rule Patterns

```javascript
// OData read with error handling
export default function GetProduct(clientAPI) {
  const svc = '/AppName/Services/SampleService.service';
  return clientAPI.read(svc, 'Products', [], `$filter=Id eq '${clientAPI.binding.Id}'`)
    .then(result => result.length > 0 ? result.getItem(0) : null)
    .catch(err => { console.error('GetProduct error:', err); return null; });
}

// ListPicker items from OData (async)
export default function GetCategoryItems(clientAPI) {
  const svc = '/AppName/Services/SampleService.service';
  return clientAPI.read(svc, 'Categories', [], '$orderby=Name asc')
    .then(result => {
      const items = [];
      for (let i = 0; i < result.length; i++) {
        const item = result.getItem(i);
        items.push({ ReturnValue: item.CategoryId, DisplayValue: item.Name });
      }
      return items;
    })
    .catch(() => []);
}

// Dynamic ListPicker based on another control's value
export default function UpdateCategoryItems(controlProxy) {
  const type = controlProxy.getValue()[0]?.ReturnValue || 'All';
  const listPicker = controlProxy.getPageProxy().getControl('SectionedTable0').getControl('CategoryPicker');
  const specifier = listPicker.getTargetSpecifier();
  specifier.setEntitySet('Categories');
  specifier.setService('/AppName/Services/SampleService.service');
  specifier.setQueryOptions(type !== 'All' ? `$filter=Type eq '${type}'` : '');
  listPicker.setTargetSpecifier(specifier);
}
```

## Anti-Patterns

```javascript
// ❌ async/await — not supported in MDK NativeScript runtime
export default async function MyRule(clientAPI) { ... }

// ❌ require() for NativeScript — use clientAPI.nativescript.*
const platform = require('@nativescript/core').Device;

// ❌ throw in a rule — causes silent crash; use console.error + return safe default
throw new Error('something failed');

// ❌ ListPicker rule returning plain strings — must be [{ReturnValue, DisplayValue}]
return ['Open', 'Closed'];

// ❌ Missing return — void rule causes unpredictable behavior
export default function MyRule(clientAPI) {
  clientAPI.getPageProxy().setCaption('test');
  // missing return → undefined
}
```
