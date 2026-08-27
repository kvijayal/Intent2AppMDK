*Part of the fiori-freestyle skill.*

# Value Help — SelectDialog Pattern (TypeScript)

Use this reference whenever a freestyle UI5 field needs a search-help / value-help dialog.
A value help is **not built** until all three layers below are present and connected.

---

## Layer 1 — View XML

Add `showValueHelp="true"` and `valueHelpRequest` to the `MultiInput` or `Input`:

```xml
<!-- MultiInput (multi-select, tokens) -->
<MultiInput
    id="plantInput"
    showValueHelp="true"
    valueHelpRequest=".onPlantValueHelp"
    tokenUpdate=".onTokenUpdate"
    submit=".onAddItem"
    placeholder="{i18n>plantPlaceholder}" />

<!-- Input (single-select) -->
<Input
    id="materialInput"
    showValueHelp="true"
    valueHelpRequest=".onMaterialValueHelp"
    value="{viewModel>/material}" />
```

---

## Layer 2 — Controller (TypeScript)

### Imports

```typescript
import SelectDialog    from "sap/m/SelectDialog";
import StandardListItem from "sap/m/StandardListItem";
import Token           from "sap/m/Token";
import MultiInput      from "sap/m/MultiInput";
import Filter          from "sap/ui/model/Filter";
import FilterOperator  from "sap/ui/model/FilterOperator";
import JSONModel       from "sap/ui/model/json/JSONModel";
import Event           from "sap/ui/base/Event";
import Log             from "sap/base/Log";
```

### Private fields

```typescript
private _plantDialog: SelectDialog | null = null;
private _allPlants: Array<{ plant: string; description: string }> = [];
```

### Open handler — fetch, lazy-create, bind, open

```typescript
public async onPlantValueHelp(): Promise<void> {
    // 1. Fetch value list from the CAP lookup function
    try {
        const companyCode: string = this._viewModel.getProperty("/companyCode");
        const resp = await fetch(
            `/odata/v4/my-service/getPlants(companyCode='${encodeURIComponent(companyCode)}')`,
            { headers: { Accept: "application/json" } }
        );
        if (resp.ok) {
            const json = await resp.json() as { value: typeof this._allPlants };
            this._allPlants = json.value ?? [];
        } else {
            this._allPlants = [];
        }
    } catch (err) {
        Log.error("getPlants failed", String(err), "my.app.controller.Main");
        this._allPlants = [];
    }

    // 2. Lazy-create the SelectDialog once
    if (!this._plantDialog) {
        this._plantDialog = new SelectDialog({
            title: this._getText("selectPlantsTitle"),
            multiSelect: true,
            rememberSelections: false,
            confirm: (oEvt: Event) => this._onPlantConfirm(oEvt),
            search:  (oEvt: Event) => this._onPlantSearch(oEvt)
        });
        this.getView()!.addDependent(this._plantDialog);
    }

    // 3. Bind fresh data and open
    this._plantDialog.setModel(new JSONModel(this._allPlants));
    this._plantDialog.bindAggregation("items", {
        path: "/",
        templateShareable: false,
        template: new StandardListItem({
            title: "{plant}",
            description: "{description}",
            type: "Active"
        })
    });
    this._plantDialog.open();
}
```

### Confirm handler — add tokens (MultiInput) or set value (Input)

```typescript
// MultiInput — add selected items as tokens
private _onPlantConfirm(oEvt: Event): void {
    const selected = oEvt.getParameter("selectedItems") as StandardListItem[];
    const oInput   = this.byId("plantInput") as MultiInput;
    selected?.forEach(item => {
        const key = item.getTitle();
        if (!oInput.getTokens().some(t => t.getKey() === key)) {
            oInput.addToken(new Token({ key, text: `${key} – ${item.getDescription()}` }));
        }
    });
    this._syncItems();   // write token keys into viewModel array
}

// Input — single value
private _onMaterialConfirm(oEvt: Event): void {
    const selected = oEvt.getParameter("selectedItem") as StandardListItem | undefined;
    if (selected) {
        this._viewModel.setProperty("/material", selected.getTitle());
    }
}
```

### Search handler — filter binding

```typescript
private _onPlantSearch(oEvt: Event): void {
    const q   = ((oEvt.getParameter("value") as string) ?? "").toLowerCase();
    const src = oEvt.getSource() as SelectDialog;
    src.getBinding("items")?.filter(
        q ? [new Filter({
            filters: [
                new Filter("plant",       FilterOperator.Contains, q),
                new Filter("description", FilterOperator.Contains, q)
            ],
            and: false
        })] : []
    );
}
```

---

## Layer 3 — CAP backend

See `cap-skill/references/cap-service.md` → **"Lookup / Value Help Function"** for the CDS
type definition, function declaration, and `srv.on` handler with mock data.

Quick summary:

```cds
// In srv/service.cds
type PlantResult { plant: String(4); description: String(50); }

service MyService @(requires: 'authenticated-user') {
  function getPlants(companyCode: String(4)) returns array of PlantResult;
}
```

```javascript
// In srv/service.js
srv.on('getPlants', (req) => {
  return [
    { plant: '1000', description: 'Plant Hamburg' },
    { plant: '1100', description: 'Plant Munich'  },
  ];
});
```

---

## i18n keys

```properties
selectPlantsTitle=Select Plant(s)
plantPlaceholder=Enter plant code and press Enter
```

---

## Coverage gate

A value help for a field is **Built** only when ALL of the following are true:

| Layer | Verified by |
|---|---|
| View: `showValueHelp="true"` + `valueHelpRequest=".onXxx"` | Grep for `valueHelpRequest` in the view XML |
| Controller: matching `onXxx()` method that opens a `SelectDialog` | Grep for `SelectDialog` in the controller |
| Controller: `confirm` handler that adds a token / sets a value | Code review of the confirm handler body |
| CAP: function defined in `.cds` and registered with `srv.on` | Grep for the function name in `srv/` |

Never mark a value help requirement `Built` when only the input field and manual text entry are present.

---

## Common mistakes

| Mistake | Fix |
|---|---|
| `SelectDialog` created inside `if (!this._plantDialog)` block but `bindAggregation` also inside → stale data on re-open | Move `bindAggregation` OUTSIDE the lazy-create block so it always rebinds |
| `templateShareable: true` causes items to disappear on second open | Always use `templateShareable: false` |
| `search` event uses `oEvt.getParameter("query")` | The parameter is `"value"`, not `"query"` |
| Binding path is `/value` (OData wrapper) | Flatten to `json.value` before setting `JSONModel`; bind to `/` |
| `addDependent` called every open (inside the `if` block) → duplicate events | `addDependent` must be called only once, inside the lazy-create block |
