*Part of the `rap-integration` skill.*

# RAP consumption — OData **V2** development patterns

Load this when the fetched `metadata.xml` declares **OData V2** (`m:DataServiceVersion="2.0"`).
Everything here is the V2 counterpart of `odata-v4-patterns.md` — read only one of the two, chosen by
the version the metadata declares. `SKILL.md` has the side-by-side decision table.

> Placeholder convention: `SERVICE_NAME`, `EntitySetName`, `PropertyName` are stand-ins — substitute
> the real names from the fetched metadata. No live service names appear here.

---

## 1. Reading a V2 `metadata.xml`

Top-level signal — the version lives on `<edmx:DataServices>`:

```xml
<edmx:DataServices m:DataServiceVersion="2.0">
```

### EntitySet CRUD capability attributes

`sap:*` attributes on `<EntitySet>` tell you which operations the backend allows. A pure reporting
service is fully read-only:

```xml
<EntitySet Name="ReportEntity"
    sap:creatable="false" sap:updatable="false" sap:deletable="false"
    sap:requires-filter="true"    <!-- GET returns 0 rows unless required filters are applied -->
    sap:addressable="true"/>
```

If every set is `creatable/updatable/deletable="false"`, do **not** author any CRUD calls — the app is
display-only.

### Property-level SAP attributes (govern filter / sort eligibility)

```xml
<Property Name="Amount" Type="Edm.Decimal" Precision="23" Scale="3"
    sap:filterable="false"            <!-- exclude from $filter — backend rejects it -->
    sap:sortable="true"
    sap:aggregation-role="measure"    <!-- analytical: "dimension" | "measure" -->
    sap:unit="CurrencyCode"/>

<Property Name="CompanyCode" Type="Edm.String" MaxLength="4"
    sap:filterable="true"
    sap:required-in-filter="true"    <!-- must appear in every GET's $filter -->
    sap:sortable="true"
    sap:aggregation-role="dimension"/>
```

- `sap:required-in-filter="true"` → the field **must** be part of `$filter` or the backend errors.
- `sap:filterable="false"` → never add a Filter for it.
- `sap:sortable="false"` → never add a Sorter for it.
- `sap:aggregation-role="dimension|measure"` + `sap:semantics="aggregate"` on the EntityType →
  analytical service (use an AnalyticalTable / `considerAnalyticalParameters: true` in the manifest).

### Value lists (inline in metadata)

```xml
<Property Name="BusinessPartner" ...>
  <Annotation Term="Common.ValueList">
    <Record>
      <PropertyValue Property="CollectionPath" String="BusinessPartnerVH"/>
      <PropertyValue Property="Parameters">
        <Collection>
          <Record Type="Common.ValueListParameterInOut">
            <PropertyValue Property="LocalDataProperty" PropertyPath="BusinessPartner"/>
            <PropertyValue Property="ValueListProperty" String="BusinessPartner"/>
          </Record>
          <Record Type="Common.ValueListParameterDisplayOnly">
            <PropertyValue Property="ValueListProperty" String="BusinessPartnerName"/>
          </Record>
        </Collection>
      </PropertyValue>
    </Record>
  </Annotation>
</Property>
```

SmartControls (SmartFilterBar / SmartTable) wire these value helps automatically.

### Function imports (V2 equivalent of Actions)

V2 has no bound actions — server-side operations are **function imports** in the entity container:

```xml
<FunctionImport Name="ApproveRequest" ReturnType="schema.RequestType" m:HttpMethod="POST">
  <Parameter Name="RequestId" Type="Edm.String" Mode="In"/>
  <Parameter Name="Comment"   Type="Edm.String" Mode="In"/>
</FunctionImport>
```

---

## 2. manifest.json — data sources + model settings (V2)

```json
"dataSources": {
  "mainService": {
    "uri": "/sap/opu/odata/sap/SERVICE_NAME/",
    "type": "OData",
    "settings": {
      "annotations": ["backendVAN", "localAnnotations"],
      "localUri": "localService/mainService/metadata.xml",
      "odataVersion": "2.0"
    }
  },
  "backendVAN": {
    "uri": "/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/Annotations(TechnicalName='SERVICE_VAN',Version='0001')/$value/",
    "type": "ODataAnnotation",
    "settings": { "localUri": "localService/mainService/SERVICE_VAN.xml" }
  },
  "localAnnotations": {
    "uri": "annotations/annotation.xml",
    "type": "ODataAnnotation"
  }
},
"models": {
  "": {
    "dataSource": "mainService",
    "preload": true,
    "settings": {
      "defaultBindingMode": "TwoWay",
      "defaultCountMode": "Inline",
      "refreshAfterChange": false,
      "metadataUrlParams": { "sap-value-list": "none" }
    }
  }
}
```

Two annotation sources are common on V2: a **backend VAN** file fetched from the gateway
`CATALOGSERVICE` (backend-authored `UI.LineItem` / `UI.SelectionFields` / `UI.HeaderInfo`) and a
**local `annotation.xml`** that overrides/extends it (later in the array → wins on conflict).

Settings explained:
- `defaultCountMode: "Inline"` → appends `$inlinecount=allpages` to every collection GET; no extra HEAD call.
- `metadataUrlParams: {"sap-value-list": "none"}` → defers value-list metadata to on-demand fetch; shrinks the initial `$metadata` payload on large S/4 services.
- `refreshAfterChange: false` → prevents an auto full-list reload after every CUD; the caller controls refresh.
- `preload: true` → `$metadata` is fetched before the first route activates.

The Component base class for a V2 Smart Template app is
`sap/suite/ui/generic/template/lib/AppComponent`:

```js
sap.ui.define(["sap/suite/ui/generic/template/lib/AppComponent"], function (Component) {
    "use strict";
    return Component.extend("com.namespace.appid.Component", { metadata: { manifest: "json" } });
});
```

---

## 3. Read calls

The framework (SmartFilterBar + SmartTable, or a ListBinding on a control) issues GETs automatically —
manual reads are rare. When you do need one:

```js
var oModel = this.getView().getModel();   // default model = OData V2 model

// Basic read
oModel.read("/EntitySetName", {
    success: function (oData) {
        var aItems = oData.results;   // array
        var nTotal = oData.__count;   // present when $inlinecount=allpages used
    },
    error: function (oError) {
        // oError.statusCode, oError.message, oError.responseText
    }
});

// Read with filters, sorters, url params
oModel.read("/EntitySetName", {
    filters: [
        new sap.ui.model.Filter("CompanyCode", sap.ui.model.FilterOperator.EQ, "1000"),
        new sap.ui.model.Filter("PostingDate", sap.ui.model.FilterOperator.GE, oFromDate)
    ],
    sorters: [new sap.ui.model.Sorter("PostingDate", true)],   // true = descending
    urlParameters: {
        "$top": "100", "$skip": "0",
        "$inlinecount": "allpages",
        "$select": "CompanyCode,PostingDate,Amount"
    },
    success: function (oData) { /* oData.results, oData.__count */ },
    error:   function (oError) {}
});
```

Read synchronously from a bound control's context (data already in the model cache):

```js
var oContext = oEvent.getSource().getBindingContext();
var oData    = oContext.getObject();   // plain JS object, no network call
```

---

## 4. Filter syntax

Filters use `sap.ui.model.Filter`; the model serializes them to the V2 `$filter` grammar:

```js
new Filter("Status", FilterOperator.EQ, "A")              // → Status eq 'A'
new Filter("Amount", FilterOperator.GT, 1000)             // → Amount gt 1000m
new Filter("PostingDate", FilterOperator.GE, new Date())  // → PostingDate ge datetime'...'
new Filter("Name", FilterOperator.Contains, "SAP")        // → substringof('SAP',Name) eq true

// AND composite (default)
new Filter({ filters: [filterA, filterB], and: true })    // → (A) and (B)
// OR composite
new Filter({ filters: [filterA, filterB], and: false })   // → (A) or (B)
```

Rules:
- `sap:required-in-filter="true"` fields must always be present in `$filter`.
- `sap:filterable="false"` fields must never be filtered — the backend rejects the request.
- **V2 uses `substringof('x',Field)`**, not V4's `contains(Field,'x')` — the Filter API handles this.

---

## 5. Sort syntax

```js
new Sorter("PostingDate", true)     // → $orderby=PostingDate desc
new Sorter("CompanyCode", false)    // → $orderby=CompanyCode asc

// Multiple sorters — pass as an array to the binding
[new Sorter("CompanyCode", false), new Sorter("PostingDate", true)]
// → $orderby=CompanyCode asc,PostingDate desc
```

`sap:sortable="false"` → never add a Sorter for that property.

---

## 6. CRUD (only when the EntitySet is not read-only)

Check the EntitySet capability attributes first (`sap:creatable/updatable/deletable`).

CREATE:
```js
oModel.create("/EntitySet", { Field1: "value", Field2: 42 }, {
    success: function (oCreatedData) { oModel.refresh(); },
    error:   function (oError) {
        var sMsg = JSON.parse(oError.responseText).error.message.value;
    }
});
```

UPDATE (MERGE by default):
```js
oModel.update("/EntitySet('KEY')", { FieldToChange: "newValue" }, {
    merge: true,    // HTTP MERGE — sends only changed fields. false = PUT (full replacement)
    success: function () { oModel.refresh(); },
    error:   function (oError) {}
});
```

DELETE:
```js
oModel.remove("/EntitySet('KEY')", {
    success: function () { oModel.refresh(); },
    error:   function (oError) {}
});
```

Two-way binding batch write (changes accumulate in the model's pending-changes map):
```js
oModel.submitChanges({
    success: function (oData) { /* oData.__batchResponses */ },
    error:   function (oError) {}
});
oModel.resetChanges();       // discard pending changes
oModel.hasPendingChanges();  // → boolean
```

Function imports (the V2 way to run a server-side action):
```js
oModel.callFunction("/FunctionImportName", {
    method: "POST",          // "GET" for read-side functions
    urlParameters: { Param1: "value", Param2: 42 },
    success: function (oData) { /* return value */ },
    error:   function (oError) {}
});
```

---

## 7. Response shape

```js
// Collection GET
{ "d": { "__count": "150", "results": [ { "CompanyCode": "1000", "Amount": "1500.00" }, ... ] } }
// Access: oData.results[0].CompanyCode

// Single entity GET, or a CREATE response
{ "d": { "CompanyCode": "1000", "Amount": "1500.00" } }
// Access: oData.CompanyCode
```

Dates arrive as OData V2 ticks — `"/Date(1704067200000)/"` — and the V2 model deserializes them to
JavaScript `Date` objects automatically.

---

## 8. `xs-app.json` route (CSRF)

```json
{
  "source": "^/sap/(.*)$",
  "target": "/sap/$1",
  "destination": "backend_dest",
  "authenticationType": "xsuaa",
  "csrfProtection": false
}
```

`csrfProtection: false` — the OData V2 model fetches `X-CSRF-Token` itself (a HEAD request before any
mutating call) and injects it. Letting the approuter also handle CSRF double-handles the token and
causes 403s on writes.

Mock / proxy / destination and deploy-time `mta.yaml` wiring: the `cap-integration` skill remains the
authority — this file does not duplicate it.
