# UI5 tests — OPA5 (integration) + QUnit (unit)

*Part of the sap-unit-testing skill.*

OPA5 drives the running app through **page objects** and **journeys**; QUnit tests pure logic (formatters, the criticality mapping) in isolation. TypeScript, run via the mock config so data is deterministic. This file is the complete OPA5 + QUnit reference for Intent2App — page objects, journeys, `autoWait`, matchers, and QUnit unit test patterns are all covered below.

## Folder layout (project1)

```text
webapp/test/
├── testsuite.qunit.ts / .html
├── unit/
│   ├── unitTests.qunit.ts / .html
│   └── controller/View1Page.controller.ts      ← QUnit unit test
└── integration/
    ├── opaTests.qunit.ts / .html               ← test runner
    ├── NavigationJourney.ts                     ← a journey
    └── pages/
        ├── AppPage.ts                           ← page object
        └── View1Page.ts                         ← page object
```

Run: `npm run unit-test` (QUnit) and `npm run int-test` (OPA5) — both use `--config ./ui5-mock.yaml`.

## OPA5 test runner (opaTests.qunit.ts)

Requires the journeys; QUnit autostart is deferred until they load.

```typescript
/* global QUnit */
sap.ui.require(["integration/NavigationJourney"], function () {
  QUnit.config.autostart = false;
  QUnit.start();
});
```

## Page object — the waitFor skeleton

A page object extends `Opa5` and exposes **actions** (do something) and **assertions** (check something). Each is a `waitFor` keyed by control `id` + `viewName`, with `success`/`errorMessage`. `viewName` scopes the lookup to one view.

```typescript
import Opa5 from "sap/ui/test/Opa5";
import Press from "sap/ui/test/actions/Press";
import EnterText from "sap/ui/test/actions/EnterText";

const sViewName = "View1";

export default class View1Page extends Opa5 {

  // ── Actions ──────────────────────────────────────────────
  iPressFirstRow() {
    return this.waitFor({
      controlType: "sap.m.ColumnListItem",
      matchers: function (item: any) { return item.getBindingContext() != null; },
      actions: new Press(),
      errorMessage: "No table rows to press"
    });
  }

  iEnterFilter(sValue: string) {
    return this.waitFor({
      id: "statusFilter",
      viewName: sViewName,
      actions: new EnterText({ text: sValue }),
      errorMessage: "Filter field not found"
    });
  }

  // ── Assertions ───────────────────────────────────────────
  iShouldSeeThePageView() {
    return this.waitFor({
      id: "page",
      viewName: sViewName,
      success: function () { Opa5.assert.ok(true, `The ${sViewName} view is displayed`); },
      errorMessage: `Did not find the ${sViewName} view`
    });
  }
}
```

The companion `AppPage` asserts the root `App` control (`id: "app"`, `viewName: "App"`) and owns `iStartMyUIComponent` / `iTeardownMyApp`.

## A journey — list → filter → Object Page → action → status updates

A journey wires page objects into a user story. `Opa5.extendConfig` sets `viewNamespace` and **`autoWait: true`** (OPA5 waits for the UI to be idle before each step — no manual sleeps). Start the component, act, assert, then tear down.

```typescript
/* global QUnit */
import opaTest from "sap/ui/test/opaQunit";
import Opa5 from "sap/ui/test/Opa5";
import AppPage from "./pages/AppPage";
import ListPage from "./pages/View1Page";
import ObjectPage from "./pages/ObjectPage";

QUnit.module("Purchase Order Journey");

const onTheApp = new AppPage();
const onTheList = new ListPage();
const onTheObject = new ObjectPage();

Opa5.extendConfig({ viewNamespace: "project1.view.", autoWait: true });

opaTest("List → filter → Object Page → approve updates status", function () {
  // Arrange — start against the mock server
  onTheApp.iStartMyUIComponent({ componentConfig: { name: "project1" } });

  // Assert the app + list loaded
  onTheApp.iShouldSeeTheApp();
  onTheList.iShouldSeeThePageView();

  // Act — filter, then open the first row
  onTheList.iEnterFilter("SUBMITTED");
  onTheList.iPressFirstRow();

  // Assert — Object Page shows, status badge present
  onTheObject.iShouldSeeTheObjectPage();
  onTheObject.iShouldSeeStatus("SUBMITTED");

  // Act — invoke the approve action
  onTheObject.iPressApprove();

  // Assert — status/criticality updated to APPROVED (Positive/green)
  onTheObject.iShouldSeeStatus("APPROVED");

  // Cleanup
  onTheApp.iTeardownMyApp();
});
```

Notes:

- `iStartMyUIComponent` / `iTeardownMyApp` come from `Opa5` (via `AppPage`); each `opaTest` is self-contained.
- With `autoWait: true` you assert outcomes directly — OPA5 polls until they hold or the test times out.
- The action button comes from a `UI.DataFieldForAction` annotation; OPA5 just presses it — the app still routes the call through Fiori Elements (tests don't call OData actions directly either).
- For role-gated visibility, add an assertion that the action is absent for a Viewer-configured start.

## QUnit unit test — formatter / criticality mapping

Test pure logic in isolation; keep controllers thin so they're trivially testable. The criticality formatter maps a status string to the SAP enum (0 Neutral, 1 Negative, 2 Critical, 3 Positive) — assert each branch.

```typescript
/* global QUnit */
import formatter from "project1/model/formatter";

QUnit.module("formatter.criticality");

QUnit.test("maps each status to its criticality", (assert: Assert) => {
  assert.strictEqual(formatter.criticality("APPROVED"),  3, "APPROVED → Positive");
  assert.strictEqual(formatter.criticality("COMPLETED"), 3, "COMPLETED → Positive");
  assert.strictEqual(formatter.criticality("SUBMITTED"), 2, "SUBMITTED → Critical");
  assert.strictEqual(formatter.criticality("REJECTED"),  1, "REJECTED → Negative");
  assert.strictEqual(formatter.criticality("DRAFT"),     0, "DRAFT → Neutral");
  assert.strictEqual(formatter.criticality("UNKNOWN"),   0, "fallback → Neutral");
});
```

Controller smoke test (project1 pattern):

```typescript
/* global QUnit */
import Controller from "project1/controller/View1.controller";

QUnit.module("View1 Controller");
QUnit.test("instantiates and runs onInit", (assert: Assert) => {
  const oController = new Controller("View1");
  oController.onInit();
  assert.ok(oController, "controller created");
});
```

The unit runner (`unitTests.qunit.ts`) waits for Core to be ready, then starts QUnit:

```typescript
QUnit.config.autostart = false;
void Promise.all([
  import("sap/ui/core/Core"),
  import("unit/controller/View1Page.controller")
]).then(([{ default: Core }]) => Core.ready()).then(() => QUnit.start());
```

## What to cover

Every primary journey (list loads → filter → navigate to Object Page → invoke action → status/criticality updates → role-gated action visibility) via OPA5; controllers + formatters + the criticality mapping via QUnit. Tests run on the mock config (deterministic), never a live backend.

## Checklist

Page objects expose `waitFor`-based actions + assertions with `id`/`viewName` · journeys set `viewNamespace` + `autoWait: true` · start/teardown per `opaTest` · actions pressed via `Press`/`EnterText` (no direct OData calls) · criticality formatter asserts all branches (0/1/2/3 + fallback) · run via `int-test`/`unit-test` on mock.
