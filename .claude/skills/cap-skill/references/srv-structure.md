# CAP srv/ Boilerplate — File by File

---

## ⚠ CDS-native mandates (enforce BEFORE writing any handler file)

### 1. No direct Express — ever

| Banned pattern | CDS-native replacement |
| --- | --- |
| `cds.on('bootstrap', app => app.post('/path', ...))` | `srv.on('actionName', async req => {...})` |
| `srv.on('bootstrap', ...)` | Same — use `srv.on(event, entity, handler)` |
| `res.json()` / `res.status()` / `res.send()` / `res.setHeader()` | `req.error(code, msg)` / `req.reject()` / `return results` |
| `multer` for file upload | `fileContent: LargeString` action parameter (base64) |
| `requireRole(req, res)` accepting Express `res` | `req.user.is('Role')` + `req.error(403, msg)` |
| `console.log(...)` | `cds.log('module-name').info(...)` |

`cds.on('bootstrap', ...)` is a last-resort escape hatch for cases where CAP truly cannot handle the operation. It must never be the first choice for file upload, file download, or any standard action.

### 2. File upload — CDS action with LargeString (base64)

Define an **unbound action** in the CDS service. The UI5 app encodes the file as base64 (via `FileReader`) and sends it as a plain string parameter. No multipart/form-data, no multer, no raw Express route.

```cds
// srv/<domain>-service.cds
service MyService @(requires: 'authenticated-user') {
  @restrict: [{ grant: 'INVOKE', to: 'MyRole' }]
  action uploadFile(
    fileContent : LargeString,   // base64-encoded binary (xlsx, csv, pdf, …)
    fileName    : String,
    // … other params
  ) returns array of ProcessResult;
}
```

```js
// srv/<domain>-service.js — handler (no Express, no multer)
srv.on('uploadFile', async (req) => {
  const { fileContent, fileName } = req.data;
  if (!fileContent) return req.error(400, 'Please select a file.');

  // Decode base64 → Buffer
  const buffer = Buffer.from(fileContent, 'base64');
  // … process buffer with xlsx, csv-parse, etc.
  return results;
});
```

### 3. File download — CDS function returning LargeString (base64)

Define an **unbound function** (read-only, maps to GET). Return the binary content base64-encoded. The UI5 controller decodes it and triggers a `<a download>` programmatically.

```cds
// srv/<domain>-service.cds
service MyService @(requires: 'authenticated-user') {
  @restrict: [{ grant: 'INVOKE', to: 'MyRole' }]
  function downloadTemplate(
    templateType : String    // e.g. 'GR' | 'GI'
  ) returns LargeString;    // base64-encoded .xlsx
}
```

```js
// handler
srv.on('downloadTemplate', (req) => {
  if (!req.user.is('MyRole')) return req.error(403, 'Not authorised.');
  const buffer = generateExcelBuffer(req.data.templateType);
  return buffer.toString('base64');
});
```

### 4. Error handling — always req.error / req.reject

```js
// ✅ Correct — surfaces as OData error response, auth/lifecycle intact
req.error(400, 'Quantity must be greater than zero.');
req.reject(403, 'Not authorised to Plant.');

// ❌ Wrong — bypasses CAP lifecycle
res.status(400).json({ error: 'Quantity must be greater than zero.' });
throw new Error('Not authorised.');
```

### 5. Role check — pure CAP, no Express res

```js
// ✅ auth/roleCheck.js — accepts only req, never res
const requireMyRole = (req) => {
  if (!req.user || !req.user.is('MyRole')) {
    req.error(403, 'Not authorised. Role MyRole required.');
    return false;
  }
  return true;
};
```

### 6. Post-build grep verification (run every build)

```bash
grep -rn "bootstrap"                                     srv/  # → 0 hits required
grep -rn "res\.json\|res\.status\|app\.post\|app\.get"  srv/  # → 0 hits required
grep -rn "console\.log"                                  srv/  # → 0 hits required
grep -rn "req\.error\|req\.reject"                       srv/  # → must have hits
```

---

## `service.js` — handler registration hub

```js
'use strict';
const cds                   = require('@sap/cds');
const { validateOrder }     = require('./validators/orderValidator');
const { isAdminOrEditor }   = require('./auth/roleCheck');
const { fetchFromS4 }       = require('./operations/onPrem');
const { MSG }               = require('./util/constants');
const log                   = require('./util/logger')('service');

module.exports = cds.service.impl(async function (srv) {

  // ── Orders ──────────────────────────────────────────────────────
  srv.before('CREATE', 'Orders', (req) => {
    log.debug('before CREATE Orders');
    validateOrder(req);
  });

  srv.before('UPDATE', 'Orders', (req) => {
    isAdminOrEditor(req);
    if (!req.user.is('Admin') && req.data.status !== undefined) {
      req.error(403, MSG.STATUS_ADMIN_ONLY);
    }
  });

  srv.on('READ', 'Orders', async (req) => {
    return fetchFromS4('Orders', req);
  });

  srv.after('READ', 'Orders', (results, req) => {
    if (!req.user.is('Admin')) {
      results.forEach(o => { delete o.internalNotes; });
    }
  });

});
```

---

## `operations/onPrem.js` — on-premise via Cloud Connector

```js
'use strict';
const cds = require('@sap/cds');
const log = require('../util/logger')('operations/onPrem');

let _s4;
const getS4 = async () => {
  _s4 = _s4 || await cds.connect.to('S4HANA');
  return _s4;
};

const fetchFromS4 = async (entity, req) => {
  log.info(`Fetching ${entity} from S4HANA`);
  const s4 = await getS4();
  return s4.run(req.query);
};

const sendToS4 = async (entity, payload) => {
  log.info(`Sending ${entity} to S4HANA`);
  const s4 = await getS4();
  return s4.run(INSERT.into(entity).entries(payload));
};

module.exports = { fetchFromS4, sendToS4 };
```

---

## `operations/remoteApi.js` — remote OData / REST

```js
'use strict';
const cds = require('@sap/cds');
const log = require('../util/logger')('operations/remoteApi');

let _api;
const getApi = async () => {
  _api = _api || await cds.connect.to('ExternalAPI');
  return _api;
};

const callRemote = async (query) => {
  log.info('Calling remote API');
  const api = await getApi();
  return api.run(query);
};

module.exports = { callRemote };
```

---

## `validators/orderValidator.js`

```js
'use strict';
const { MSG, HTTP } = require('../util/constants');

const validateOrder = (req) => {
  const { quantity, customerName } = req.data;
  if (!quantity || quantity <= 0) {
    req.error(HTTP.BAD_REQUEST, MSG.QUANTITY_REQUIRED);
  }
  if (!customerName || customerName.trim() === '') {
    req.error(HTTP.BAD_REQUEST, MSG.CUSTOMER_REQUIRED);
  }
};

module.exports = { validateOrder };
```

---

## `validators/commonValidator.js`

```js
'use strict';
const { HTTP, MSG } = require('../util/constants');

const requireFields = (req, fields) => {
  fields.forEach(f => {
    if (req.data[f] === undefined || req.data[f] === null) {
      req.error(HTTP.BAD_REQUEST, `${f} is required.`);
    }
  });
};

module.exports = { requireFields };
```

---

## `auth/roleCheck.js`

```js
'use strict';
const { HTTP, MSG } = require('../util/constants');

const isAdmin = (req) => {
  if (!req.user.is('Admin')) req.error(HTTP.FORBIDDEN, MSG.ADMIN_ONLY);
};

const isAdminOrEditor = (req) => {
  if (!req.user.is('Admin') && !req.user.is('Editor')) {
    req.error(HTTP.FORBIDDEN, MSG.EDITOR_ONLY);
  }
};

const isApprover = (req) => {
  if (!req.user.is('Approver') && !req.user.is('Admin')) {
    req.error(HTTP.FORBIDDEN, MSG.APPROVER_ONLY);
  }
};

module.exports = { isAdmin, isAdminOrEditor, isApprover };
```

---

## `util/constants.js`

```js
'use strict';

const HTTP = {
  OK:            200,
  BAD_REQUEST:   400,
  UNAUTHORIZED:  401,
  FORBIDDEN:     403,
  NOT_FOUND:     404,
  CONFLICT:      409,
  SERVER_ERROR:  500,
};

const ORDER_STATUS = {
  PENDING:   'P',
  APPROVED:  'A',
  REJECTED:  'R',
  CANCELLED: 'C',
};

const SYSTEMS = {
  S4:    'S4HANA',
  ARIBA: 'AribaNetwork',
};

const MSG = {
  // Validation
  QUANTITY_REQUIRED:  'Quantity must be greater than zero.',
  CUSTOMER_REQUIRED:  'Customer name is required.',
  // Authorization
  ADMIN_ONLY:         'This action requires Admin role.',
  EDITOR_ONLY:        'This action requires Editor or Admin role.',
  APPROVER_ONLY:      'This action requires Approver or Admin role.',
  STATUS_ADMIN_ONLY:  'Only Admins can change the order status.',
  // Operations
  S4_UNAVAILABLE:     'SAP S/4HANA system is currently unavailable.',
};

module.exports = { HTTP, ORDER_STATUS, SYSTEMS, MSG };
```

---

## `util/logger.js`

```js
'use strict';
const cds = require('@sap/cds');

// Usage: const log = require('./util/logger')('module-name');
// Then:  log.info(...) / log.debug(...) / log.error(...)
module.exports = (module) => cds.log(module);
```

---

## `util/errors.js`

```js
'use strict';
const { HTTP, MSG } = require('./constants');

// Shorthand for req.error keyed to a MSG constant
const rejectWith = (req, httpCode, msgKey) => {
  req.error(httpCode, MSG[msgKey] || msgKey);
};

// Wrap an async operation and surface errors as req.error
const safely = async (req, fn) => {
  try {
    return await fn();
  } catch (err) {
    req.error(HTTP.SERVER_ERROR, err.message || MSG.S4_UNAVAILABLE);
  }
};

module.exports = { rejectWith, safely };
```

---

## `util/formatter.js`

```js
'use strict';

// OData date string → JS Date
const toDate = (odataDate) => odataDate ? new Date(odataDate) : null;

// JS Date → OData date string (YYYY-MM-DD)
const toODataDate = (date) => date ? date.toISOString().split('T')[0] : null;

// Strip undefined/null fields from an object before sending to remote
const compact = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null));

// Map an array with a transform, skip nulls
const mapCompact = (arr, fn) => arr.map(fn).filter(Boolean);

module.exports = { toDate, toODataDate, compact, mapCompact };
```
