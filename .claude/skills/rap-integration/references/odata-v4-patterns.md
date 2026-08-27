*Part of the `rap-integration` skill.*

# RAP consumption — OData **V4** development patterns

Load this when the fetched `metadata.xml` declares **OData V4** (`Version="4.0"` on `<edmx:Edmx>`).
Everything here is the V4 counterpart of `odata-v2-patterns.md` — read only one of the two, chosen by
the version the metadata declares. `SKILL.md` has the side-by-side decision table.

> Placeholder convention: `EntitySet`, `EntityType`, `namespace`, `PropertyName` are stand-ins —
> substitute the real names from the fetched metadata. `namespace.ActionName` is the action's
> fully-qualified name (e.g. `com.sap.gateway.srvd.<service>.v0001.<Action>`). No live service names
> appear here.

---

## 1. Reading a V4 `metadata.xml`

Top-level signal — the version lives on the root element:

```xml
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
```

There are **no `sap:*` property attributes** in V4 — every capability is a vocabulary annotation.

### Filter / sort restrictions (vocabulary-based)

```xml
<Annotation Term="Capabilities.FilterRestrictions">
  <Record>
    <PropertyValue Property="RequiredProperties">
      <Collection><PropertyPath>CompanyCode</PropertyPath></Collection>
    </PropertyValue>
    <PropertyValue Property="NonFilterableProperties">
      <Collection>
        <PropertyPath>__EntityControl</PropertyPath>
        <PropertyPath>__OperationControl</PropertyPath>
      </Collection>
    </PropertyValue>
  </Record>
</Annotation>
<Annotation Term="Capabilities.SortRestrictions">
  <Record>
    <PropertyValue Property="NonSortableProperties">
      <Collection>
        <PropertyPath>__EntityControl</PropertyPath>
        <PropertyPath>__OperationControl</PropertyPath>
      </Collection>
    </PropertyValue>
  </Record>
</Annotation>
```

`Capabilities.InsertRestrictions` / `UpdateRestrictions` / `DeleteRestrictions` (often `Path`-bound to
`__EntityControl/...`) tell you whether CRUD is available and under what per-row condition.

### Per-row CRUD gate — `__EntityControl`

RAP frequently emits a computed control complex type that says, per row, whether it may be
edited/deleted:

```xml
<ComplexType Name="EntityControlType">
  <Property Name="Deletable" Type="Edm.Boolean"/>
  <Property Name="Updatable" Type="Edm.Boolean"/>
</ComplexType>
<Property Name="__EntityControl" Type="schema.EntityControlType" Nullable="false">
  <Annotation Term="Core.Computed" Bool="true"/>
  <Annotation Term="UI.Hidden" Bool="true"/>
</Property>
```

### Per-row action availability gate — `__OperationControl`

```xml
<ComplexType Name="OperationControlType">
  <Property Name="Process"       Type="Edm.Boolean"/>
  <Property Name="Submit"        Type="Edm.Boolean"/>
  <Property Name="TestRun"       Type="Edm.Boolean"/>
  <Property Name="DownloadError" Type="Edm.Boolean"/>
</ComplexType>
<Property Name="__OperationControl" Type="schema.OperationControlType" Nullable="false">
  <Annotation Term="Core.Computed" Bool="true"/>
  <Annotation Term="UI.Hidden" Bool="true"/>
</Property>
```

Both `__EntityControl` and `__OperationControl` are **non-filterable and non-sortable** — never target
them in a Filter or Sorter.

### Bound Action — collection-level (operates on the whole entity set)

```xml
<Action Name="Upload" IsBound="true" EntitySetPath="_it">
  <Parameter Name="_it"      Type="Collection(schema.EntityType)"/>
  <Parameter Name="filename" Type="Edm.String" MaxLength="256"/>
  <Parameter Name="content"  Type="Edm.Binary"/>
  <ReturnType Type="schema.UploadResultType"/>
</Action>
```

### Bound Action — instance-level (operates on a single row)

```xml
<Action Name="Process" IsBound="true">
  <Parameter Name="_it"      Type="schema.EntityType" Nullable="false"/>
  <Parameter Name="UploadId" Type="Edm.String" MaxLength="10"/>
  <ReturnType Type="schema.EntityType"/>
  <Annotation Term="Core.OperationAvailable" Path="_it/__OperationControl/Process"/>
</Action>
```

### Bound Function — read-side, no side effects (uses GET)

```xml
<Function Name="DownloadError" IsBound="true">
  <Parameter Name="_it"      Type="schema.EntityType" Nullable="false"/>
  <Parameter Name="UploadId" Type="Edm.String" MaxLength="10"/>
  <ReturnType Type="Collection(schema.ResultType)"/>
  <Annotation Term="Core.OperationAvailable" Path="_it/__OperationControl/DownloadError"/>
</Function>
```

### SAP Messages (standard property for backend messages)

```xml
<Property Name="SAP__Messages" Type="Collection(SAP__Message)" Nullable="false">
  <Annotation Term="Core.Computed" Bool="true"/>
</Property>
```

---

## 2. manifest.json — data sources + model settings (V4)

```json
"dataSources": {
  "mainService": {
    "uri": "/sap/opu/odata4/sap/<binding>/srvd/sap/<service>/0001/",
    "type": "OData",
    "settings": {
      "annotations": ["localAnnotations"],
      "localUri": "localService/mainService/metadata.xml",
      "odataVersion": "4.0"
    }
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
      "operationMode": "Server",
      "autoExpandSelect": true,
      "earlyRequests": true
    }
  }
}
```

Settings explained:
- `operationMode: "Server"` → all filtering/sorting/paging delegated to the backend via `$filter`, `$orderby`, `$top`, `$skip`; the model never loads the full dataset client-side.
- `autoExpandSelect: true` → the framework builds `$select` and `$expand` from active bindings; properties not rendered are excluded from the payload.
- `earlyRequests: true` → the `$metadata` fetch begins before `init()` completes, saving a round-trip.

The Component base class for a V4 Fiori Elements / FPM app is `sap/fe/core/AppComponent`:

```js
sap.ui.define(["sap/fe/core/AppComponent"], function (AppComponent) {
    "use strict";
    return AppComponent.extend("com.namespace.appid.Component", { metadata: { manifest: "json" } });
});
```

---

## 3. Read calls

The framework (FE templates or `sap.fe.macros` building blocks) handles GETs automatically. For manual
reads:

```js
var oModel = this.getView().getModel();

// List read
var oListBinding = oModel.bindList("/EntitySet", null,
    [new sap.ui.model.Sorter("UploadId", true)],
    [new sap.ui.model.Filter("Status", sap.ui.model.FilterOperator.EQ, "A")],
    { $select: "UploadId,Status,StatusText" }
);
oListBinding.requestContexts(0, 50).then(function (aContexts) {
    var aData = aContexts.map(function (oCtx) { return oCtx.getObject(); });
});

// Single entity read
var oCtxBinding = oModel.bindContext("/EntitySet('KEY')", null, { $select: "UploadId,Status" });
oCtxBinding.requestObject().then(function (oData) { /* oData.UploadId ... */ });

// From a bound control's context (synchronous if already loaded)
var oData = oEvent.getSource().getBindingContext().getObject();
// Or async if not yet in cache:
oContext.requestObject().then(function (oData) { /* ... */ });
```

---

## 4. Filter syntax

Same `sap.ui.model.Filter` API; serialized to the V4 `$filter` grammar:

```js
new Filter("Status", FilterOperator.EQ, "A")               // → Status eq 'A'
new Filter("UploadedDate", FilterOperator.GE, "2024-01-01")// → UploadedDate ge 2024-01-01  (ISO string)
new Filter("FileName", FilterOperator.Contains, "invoice") // → contains(FileName,'invoice')  ← NOT substringof

// AND (default)
new Filter({ filters: [filterA, filterB], and: true })
// OR
new Filter({ filters: [filterA, filterB], and: false })
```

Rules:
- `Capabilities.FilterRestrictions.RequiredProperties` → always include these in every GET.
- `Capabilities.FilterRestrictions.NonFilterableProperties` → never add a Filter (backend rejects it).
- `__EntityControl` / `__OperationControl` are always non-filterable — never filter by them.
- **V4 uses `contains()`**, not V2's `substringof()` — the Filter API handles serialization.

---

## 5. Sort syntax

```js
new Sorter("UploadId", true)    // → $orderby=UploadId desc
new Sorter("Status", false)     // → $orderby=Status asc

[new Sorter("Status", false), new Sorter("UploadId", true)]
// → $orderby=Status asc,UploadId desc
```

`Capabilities.SortRestrictions.NonSortableProperties` → never add a Sorter for these.

---

## 6. CRUD

CREATE via `oListBinding.create()`:
```js
var oListBinding = oModel.bindList("/EntitySet");
var oNewContext  = oListBinding.create({ FieldA: "value", FieldB: 42 }, /*bAtEnd=*/true);

oModel.submitBatch("$auto").then(function () {
    if (!oNewContext.isTransient()) {
        // persisted — oNewContext.getObject() has server-generated fields
    }
}).catch(function (oError) { /* oError.message */ });
```

UPDATE via `setProperty` (V4 sends PATCH — partial update — by default):
```js
oContext.setProperty("Status", "B");
oContext.setProperty("StatusText", "Active");
oModel.submitBatch("$auto");    // PATCH /EntitySet('KEY') { "Status": "B", "StatusText": "Active" }
```

DELETE via `oContext.delete()`:
```js
oContext.delete("$auto")
    .then(function () { /* binding updates automatically */ })
    .catch(function (oError) { /* oError.message */ });
```

CRUD conditioned on `__EntityControl`:
```js
var oData = oContext.getObject();
if (oData.__EntityControl && oData.__EntityControl.Updatable) {
    oContext.setProperty("FieldName", "newValue");
    oModel.submitBatch("$auto");
}
```

---

## 7. Bound Actions & Functions (POST / GET)

Collection-bound action:
```js
var oActionBinding = oModel.bindContext("/EntitySet/namespace.ActionName(...)");
oActionBinding.setParameter("Param1", "value");
oActionBinding.setParameter("Content", sBase64String);   // Edm.Binary accepted as base64 string
oActionBinding.invoke().then(function () {
    var oResult = oActionBinding.getBoundContext().getObject();
}).catch(function (oError) { /* handle */ });
```

Instance-bound action (relative to a row context):
```js
var oActionBinding = oModel.bindContext("namespace.ActionName(...)", oSelectedContext);
oActionBinding.setParameter("UploadId", sId);
oActionBinding.invoke().then(function () {
    var oResult = oActionBinding.getBoundContext().getObject();
});
```

Path concatenation (when the context path is dynamic):
```js
var sPath = oContext.getPath() + "/namespace.TestRun(...)";
var oActionBinding = oModel.bindContext(sPath, oContext);
oActionBinding.setParameter("TestRun", "X");
oActionBinding.invoke().then(function () { oTable.refresh(); });
```

Bound function (GET, returns data — no side effects):
```js
var oFunctionBinding = oModel.bindContext("namespace.DownloadError(...)", oContext);
oFunctionBinding.setParameter("UploadId", sId);
oFunctionBinding.invoke().then(function () {
    // A collection return is under the "value" key
    var aResults = oFunctionBinding.getBoundContext().getObject()["value"];
    var oFirst = aResults[0];   // { content: "base64...", filename: "...", mimetype: "..." }
});
```

Check `OperationAvailable` before invoking:
```js
var oData = oContext.getObject();
if (oData.__OperationControl && oData.__OperationControl.Process) {
    // safe to invoke the Process action
}
```

> Use `invoke()` (the current API) rather than the older `execute()`.

---

## 8. Response shape

```js
// Collection GET, or a collection-returning Action/Function
{ "@odata.context": "$metadata#EntitySet", "@odata.count": 42, "value": [ { "UploadId": "001", ... } ] }
// Access: aContexts[0].getObject()  or  oActionBinding.getBoundContext().getObject()["value"]

// Single entity GET, or a single-returning Action
{ "@odata.context": "$metadata#EntitySet/$entity", "UploadId": "001", "Status": "A",
  "__EntityControl": { "Deletable": true, "Updatable": false }, "SAP__Messages": [] }
```

Dates are **ISO 8601 strings** (`"2024-03-15"` for `Edm.Date`, `"2024-03-15T10:30:00Z"` for
`Edm.DateTimeOffset`). The V4 model does **not** auto-convert them to JS `Date` objects — they stay
strings.

---

## 9. SAP Messages after `invoke()`

```js
oActionBinding.invoke().then(function () {
    var oMsgModel = sap.ui.core.Messaging.getMessageModel();
    var aMessages = oMsgModel.getData();
    var bHasError = aMessages.some(function (m) {
        return m.type === "Error" || (m.message || "").toLowerCase().includes("error");
    });
    if (bHasError) {
        sap.m.MessageBox.error("Operation failed — see message popover");
    } else {
        oTable.refresh();
    }
}).catch(function (oError) {
    sap.m.MessageBox.error(oError.message || "Unexpected error");
});
```

---

## 10. Binary file upload / download (`Edm.Binary` ↔ base64)

RAP ABAP backends accept `Edm.Binary` action parameters as base64-encoded strings.

Upload — read the file and pass the base64 payload:
```js
var oReader = new FileReader();
oReader.onload = function (e) {
    // "data:application/vnd.ms-excel;base64,<actualBase64>"
    var sBase64 = e.target.result.split(",")[1];
    this._upload = { content: sBase64, filename: oFile.name, mimetype: oFile.type };
}.bind(this);
oReader.readAsDataURL(oFile);
// Then: oActionBinding.setParameter("content", this._upload.content)
```

Download — turn a base64 return value into a browser download:
```js
function fnDownloadBase64File(sBase64, sFilename, sMimetype) {
    var sBinary = atob(sBase64);
    var aBytes  = new Uint8Array(sBinary.length);
    for (var i = 0; i < sBinary.length; i++) { aBytes[i] = sBinary.charCodeAt(i); }
    var oBlob = new Blob([aBytes], { type: sMimetype });
    var sUrl  = URL.createObjectURL(oBlob);
    var oLink = document.createElement("a");
    oLink.href = sUrl; oLink.download = sFilename; oLink.click();
    URL.revokeObjectURL(sUrl);
}
```

---

## 11. `xs-app.json` route (CSRF)

```json
{
  "source": "^/sap/(.*)$",
  "target": "/sap/$1",
  "destination": "backend_dest",
  "authenticationType": "xsuaa",
  "csrfProtection": false
}
```

`csrfProtection: false` — the OData V4 model manages `X-CSRF-Token` itself; letting the approuter also
handle CSRF double-handles the token and causes 403s on writes.

Mock / proxy / destination and deploy-time `mta.yaml` wiring: the `cap-integration` skill remains the
authority — this file does not duplicate it.
