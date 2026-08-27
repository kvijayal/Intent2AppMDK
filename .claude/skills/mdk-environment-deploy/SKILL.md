---
name: mdk-environment-deploy
version: 0.4.0
description: >
  Use when deploying MDK apps across multiple environments (dev/QA/prod), setting up
  separate Mobile Services apps per environment, managing app versions across environments,
  device onboarding with QR code, configuring SAP Mobile Services Client, or automating
  MDK deployment in CI/CD pipelines. Trigger on: "deploy to dev QA prod", "multiple environments",
  "MDK CI/CD", "pipeline MDK", "QR code onboard", "device onboarding", "SAP Mobile Services Client",
  "MDK environment", "prod deployment MDK", "stage MDK", "promote MDK", "version across environments",
  "MDK build pipeline", "automate deploy MDK", "onboard device", "scan QR".
source: Intent2App — multi-env deployment, not covered by @sap/mdk-mcp-server
---

# MDK Multi-Environment Deployment

How to set up dev/QA/prod environments and deploy MDK apps safely across them.

---

## Environment setup — one Mobile Services app per environment

Never share one Mobile Services app across environments. Create separate apps:

```
Mobile Services (CF Space: dev):
  App ID: com.company.myapp.dev     ← developers onboard here
  Destination: WorkOrderService-Dev

Mobile Services (CF Space: qa):
  App ID: com.company.myapp.qa      ← QA testers onboard here
  Destination: WorkOrderService-QA

Mobile Services (CF Space: prod):
  App ID: com.company.myapp         ← field workers onboard here
  Destination: WorkOrderService
```

---

## ApplicationVersion — increment on every deploy

```json
// .project.json
{
  "ApplicationName": "WorkOrderApp",
  "ApplicationVersion": "1.3.0",   ← bump this on every deploy
  "SchemaVersion": "26.6"
}
```

Devices check for updates every 20-25 minutes in foreground.
A higher `ApplicationVersion` triggers automatic bundle download on enrolled devices.

Versioning convention:
```
MAJOR.MINOR.PATCH
  MAJOR → breaking OData schema change (requires OnDidUpdate store reset)
  MINOR → new features / new pages
  PATCH → bug fixes, i18n, style changes
```

---

## Deploy to a specific environment

```bash
# Switch CF space
cf target -s dev    # or qa or prod

# Deploy
npx @sap/mdk-tools deploy --target mobile --showqr --project .
```

Or via MCP:
```
mcp__mdk__mdk-manage {
  "folderRootPath": ".",
  "operation": "deploy"
}
```

---

## Device onboarding via QR code

After successful deploy, `.build/qrcode.png` is generated.

**In VS Code:**
1. Open VS Code Explorer → `.build/qrcode.png`
2. Click the file — it previews in VS Code
3. Scan with SAP Mobile Services Client on the device

**Onboarding steps on device:**
1. Install **SAP Mobile Services Client** from App Store / Google Play
2. Open the app → tap "Scan QR Code"
3. Scan `.build/qrcode.png`
4. Log in with SAP BTP credentials (XSUAA SSO)
5. The MDK app downloads and launches automatically

**Show QR code path:**
```
mcp__mdk__mdk-manage {
  "folderRootPath": ".",
  "operation": "show-qrcode"
}
```

---

## CI/CD pipeline (GitHub Actions example)

```yaml
name: Deploy MDK to QA

on:
  push:
    branches: [qa]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node 22
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install MDK tools
        run: npm install -g @sap/mdk-tools

      - name: CF Login
        run: |
          cf login \
            -a ${{ secrets.CF_API }} \
            -u ${{ secrets.CF_USER }} \
            -p ${{ secrets.CF_PASSWORD }} \
            -o ${{ secrets.CF_ORG }} \
            -s qa

      - name: Validate
        run: npx @sap/mdk-tools validate --project .

      - name: Deploy to QA
        run: npx @sap/mdk-tools deploy --target mobile --project .
```

---

## Promotion flow (dev → QA → prod)

```
1. Develop on local MDK project
2. Deploy to DEV Mobile Services app (cf target -s dev)
   → Developers test on their devices

3. Bump ApplicationVersion (e.g. 1.3.0-rc)
4. Deploy to QA Mobile Services app (cf target -s qa)
   → QA team tests using QR code

5. Bump ApplicationVersion (e.g. 1.3.0)
6. Deploy to PROD Mobile Services app (cf target -s prod)
   → Field workers receive update automatically within 20-25 min
```

---

## Force update — block old versions

In SAP BTP Cockpit → Mobile Services → your app → Application Versioning:
- Enable "Only allow active versions"
- Set minimum required version: `1.3.0`
- Old clients get 403 → prompted to update

Handle 403 in your MDK app:
```javascript
// OnFailure rule for any service action
export default function HandleVersionError(clientAPI) {
  const code = clientAPI.getActionResult('sync')?.error?.responseCode;
  if (code === 403) {
    return clientAPI.executeAction({
      "_Type": "Action.Type.Message",
      "Title": "Update Required",
      "Message": "Please update the app to continue.",
      "OKCaption": "OK"
    });
  }
}
```
