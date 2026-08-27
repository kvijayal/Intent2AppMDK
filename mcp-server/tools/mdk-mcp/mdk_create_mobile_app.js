// Creates a new SAP Mobile Services application.
// Uses Node built-in fetch — no curl, no bash subprocess.
// Mirrors VS Code "MDK: Open Mobile App Editor" → "+" button.
import { jsonText, errText } from "../_util.js";
import {
  getAuthContext, apiGet, apiPost, getDestinations
} from "../../lib/mobile-services.js";

async function pollUntilStarted(adminAPI, cfToken, appId, maxWaitMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const app = await apiGet(adminAPI, cfToken, `/app/${appId}`);
      const state = app.state || app.status || app.applicationState;
      if (/^start/i.test(state)) return { started: true, app };
      if (/^fail/i.test(state))  return { started: false, error: `App state: ${state}` };
    } catch { /**/ }
    await new Promise(r => setTimeout(r, 10000));
  }
  return { started: false, error: "Timeout waiting for Started state (3 min)" };
}

export default {
  name: "mdk_create_mobile_app",
  description:
    "Creates a new SAP Mobile Services application — mirrors VS Code 'MDK: Open Mobile App Editor' → '+' button. " +
    "Optionally adds the ESPM sample OData service as a destination. " +
    "Uses Node built-in fetch — no bash commands. Requires CF login.",
  inputSchema: {
    type: "object",
    properties: {
      appName:       { type: "string", description: "Display name (e.g. 'SAP MDK App')." },
      appId:         { type: "string", description: "Unique app ID in reverse-domain format (e.g. 'myapp.mdk.demo')." },
      addEspmSample: { type: "boolean", default: true, description: "Add ESPM sample OData service. Default: true." },
      customDestination: {
        type: "object",
        description: "Optional custom OData destination.",
        properties: {
          name:    { type: "string" },
          address: { type: "string" },
          ssoMethod: { type: "string", default: "OAuth2SAMLBearerAssertion" }
        }
      },
      landscapeType: { type: "string", enum: ["Standard","Preview"], default: "Standard" }
    },
    required: ["appName", "appId"]
  },

  async handler({ appName, appId, addEspmSample = true, customDestination, landscapeType = "Standard" } = {}) {
    if (!appName) return errText("appName is required.");
    if (!appId)   return errText("appId is required (e.g. 'myapp.mdk.demo').");
    if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(appId))
      return errText(`appId "${appId}" invalid. Use reverse-domain format: e.g. myapp.mdk.demo`);

    const auth = await getAuthContext(landscapeType);
    if (auth.error) return errText(auth.error);
    const { config, cfToken, adminAPI } = auth;

    const endpoints = [];
    if (addEspmSample) {
      endpoints.push({
        endPointName:    "com.sap.edm.sampleservice.v4",
        endPointAddress: "https://services.odata.org/v4/northwind/northwind.svc",
        ssoMethod:       "NoSSO",
        useCloudConnector: false
      });
    }
    if (customDestination?.name && customDestination?.address) {
      endpoints.push({
        endPointName:    customDestination.name,
        endPointAddress: customDestination.address,
        ssoMethod:       customDestination.ssoMethod || "OAuth2SAMLBearerAssertion",
        useCloudConnector: false
      });
    }

    const payload = {
      name: appId, displayName: appName,
      security: { name: "XSUAA" },
      services: [
        { name: "push" }, { name: "settings" }, { name: "clientLog" }, { name: "connectivity" },
        { name: "proxy", parameters: { endpointConfigurations: endpoints } }
      ]
    };

    try {
      await apiPost(adminAPI, cfToken, "/apps", payload);
    } catch (e) {
      if (e.status === 409 || /conflict|already exist/i.test(e.message)) {
        return errText(
          `App ID "${appId}" already exists.\n\n` +
          `Use a different appId or call mdk_list_mobile_apps to see existing apps.`
        );
      }
      return errText(`Failed to create app: ${e.message}`);
    }

    process.stderr.write(`[mdk_create_mobile_app] App created. Polling for Started state...\n`);
    const { started, app: startedApp, error: pollError } = await pollUntilStarted(adminAPI, cfToken, appId);

    if (!started) {
      return jsonText({
        created: true, started: false, appId, appName,
        warning: pollError || "App created but may still be starting. Wait 2-3 min then run mdk_list_mobile_apps.",
        nextStep: `mdk_list_mobile_apps { "appId": "${appId}" }`
      });
    }

    return jsonText({
      created: true, started: true, appId, appName,
      org:   config.OrganizationFields.Name,
      space: config.SpaceFields.Name,
      destinations: endpoints.map(e => e.endPointName),
      nextStep: [
        `✓ App "${appName}" (${appId}) is running`,
        `1. mdk_list_mobile_apps { "appId": "${appId}" } — confirm destinations`,
        `2. mdk_fetch_mobile_metadata { "appId": "${appId}", "destination": "${endpoints[0]?.endPointName || '<dest>'}", "folderRootPath": "<path>" }`,
        `3. mdk_create to scaffold pages and actions`
      ].join("\n")
    });
  }
};
