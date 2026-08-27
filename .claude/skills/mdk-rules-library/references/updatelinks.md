# MDK UpdateLinks — Navigation Property Associations

*Part of the mdk-rules-library skill.*

## What UpdateLinks Does

`UpdateLinks` sets a navigation property (OData association) on an entity during
`UpdateEntity`. Used when a form lets the user pick a related entity (e.g. select
a category, assign to a person) and that relationship is stored as an OData link,
not a foreign key property.

## Rule Pattern

```javascript
/**
 * Returns a link specifier array for the UpdateEntity action's UpdateLinks property.
 * Called at runtime; return [] to clear the link.
 * @param {IClientAPI} ClientAPI
 */
export default function UpdateCategoryLink(ClientAPI) {
  const container = ClientAPI.getPageProxy().getControl('SectionedTable0');
  const picker    = container.getControl('CategoryPicker');
  const links     = [];

  if (picker.getValue().length > 0) {
    const selectedId  = picker.getValue()[0].ReturnValue;
    const queryOption = `$filter=CategoryId eq '${selectedId}'`;

    const link = ClientAPI.createLinkSpecifierProxy(
      'Category',         // ← navigation property name on the entity
      'Categories',       // ← target entity set
      queryOption,        // ← OData filter to identify the target record
      ''                  // ← readLink (empty = use query)
    );
    links.push(link.getSpecifier());
  }
  return links;
}
```

## Wire in UpdateEntity Action

```json
{
  "_Type": "Action.Type.ODataService.UpdateEntity",
  "_Name": "Products_UpdateEntity",
  "ActionResult": { "_Name": "updateProduct" },
  "Properties": { "Name": "#Control:Name/#Value" },
  "Target": {
    "EntitySet": "Products", "ReadLink": "{@odata.readLink}",
    "Service": "/AppName/Services/SampleService.service"
  },
  "UpdateLinks": "/AppName/Rules/Products/UpdateCategoryLink.js",
  "OnSuccess": "/AppName/Actions/Products/Products_UpdateSuccess.action",
  "OnFailure": "/AppName/Actions/Products/Products_UpdateFailed.action"
}
```

## Rules

1. `createLinkSpecifierProxy(navProp, entitySet, queryOptions, readLink)` — all 4 args required
2. `navProp` = the navigation property name on the entity being updated
3. `queryOptions` must uniquely identify one target record — use primary key in filter
4. Return `[]` to clear/remove an existing link
5. `UpdateLinks` on `CreateEntity` works the same way for setting links on creation
