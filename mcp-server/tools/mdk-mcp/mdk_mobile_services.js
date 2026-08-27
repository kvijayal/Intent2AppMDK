// Single tool for all SAP Mobile Services operations.
// Replaces mdk_list_mobile_apps + mdk_fetch_mobile_metadata + mdk_create_mobile_app.
// Uses Node built-in fetch via mcp-server/lib/mobile-services.js — no curl, no bash.
// Replicated from SAP/mdk-mcp-server mobile-services-client.ts (Apache-2.0)
import path from "node:path";
import { exists, writeText } from "../../lib/fs-utils.js";
import { jsonText, errText, okText } from "../_util.js";
import {
  getAuthContext, apiGet, apiPost,
  listApplications, getDestinations,
  fetchMetadataViaConduit
} from "../../lib/mobile-services.js";

async function pollUntilStarted(adminAPI, cfToken, appId, maxMs = 180000) {
  const t = Date.now();
  while (Date.now() - t < maxMs) {
    try {
      const app = await apiGet(adminAPI, cfToken, `/app/${appId}`);
      const s = app.state || app.status || app.applicationState || "";
      if (/^start/i.test(s)) return { started: true };
      if (/^fail/i.test(s))  return { started: false, error: `State: ${s}` };
    } catch { /**/ }
    await new Promise(r => setTimeout(r, 10000));
  }
  return { started: false, error: "Timeout (3 min) waiting for Started state" };
}

export default {
  name: "mdk_mobile_services",
  description:
    "All SAP Mobile Services operations in one tool. " +
    "operation list: list apps (names only, fast). " +
    "operation destinations: get destinations for a specific appId. " +
    "operation fetch-metadata: fetch OData EDMX via conduit and save .service.metadata. " +
    "operation create-app: create a new Mobile Services app (mirrors VS Code '+' button). " +
    "Requires CF login. Uses Node built-in fetch — no bash commands.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "destinations", "fetch-metadata", "create-app"],
        description:
          "list: show all apps (call first). " +
          "destinations: show destinations for one appId (call after list). " +
          "fetch-metadata: download EDMX and save .service.metadata (needs appId + destination + folderRootPath). " +
          "create-app: create a new Mobile Services app (needs appName + appId)."
      },
      appId:           { type: "string",  description: "Mobile Services App ID." },
      destination:     { type: "string",  description: "Destination name (for fetch-metadata)." },
      folderRootPath:  { type: "string",  description: "MDK project root path (for fetch-metadata)." },
      pathSuffix:      { type: "string",  default: "", description: "Optional path suffix before /$metadata." },
      appName:         { type: "string",  description: "Display name for new app (for create-app)." },
      addEspmSample:   { type: "boolean", default: true, description: "Add ESPM sample OData service (for create-app). Default: true." },
      landscapeType:   { type: "string",  enum: ["Standard","Preview"], default: "Standard" }
    },
    required: ["operation"]
  },

  async handler({ operation, appId, destination, folderRootPath, pathSuffix = "",
                  appName, addEspmSample = true, landscapeType = "Standard" } = {}) {

    const auth = await getAuthContext(landscapeType);
    if (auth.error) return errText(auth.error);
    const { config, cfToken, adminAPI } = auth;

    // ── list ─────────────────────────────────────────────────────────────────
    if (operation === "list") {
      const apps = await listApplications(adminAPI, cfToken);
      if (!apps.length) return okText(
        `No Mobile Services apps found in ${config.OrganizationFields.Name} / ${config.SpaceFields.Name}.\n\n` +
        `Create one: operation "create-app"  OR  VS Code → Cmd+Shift+P → "MDK: Open Mobile App Editor" → "+".`
      );
      return jsonText({
        org: config.OrganizationFields.Name, space: config.SpaceFields.Name,
        appCount: apps.length,
        apps: apps.map(a => ({ appId: a.name, displayName: a.displayName || a.name })),
        next: `Call operation "destinations" with the appId you want to use.`
      });
    }

    // ── destinations ─────────────────────────────────────────────────────────
    if (operation === "destinations") {
      if (!appId) return errText(`appId is required for operation "destinations".`);
      const dests = await getDestinations(adminAPI, cfToken, appId);
      if (!dests.length) return okText(
        `No destinations in "${appId}". Add one in BTP Cockpit → Mobile Services → your app → Mobile Connectivity.`
      );
      return jsonText({
        appId,
        destinations: dests.map(d => ({
          name: d.endPointName,
          address: d.endPointAddress || d.cloudDestinationName || "(cloud destination)"
        })),
        next: `Call operation "fetch-metadata" with appId "${appId}" and your chosen destination.`
      });
    }

    // ── fetch-metadata ────────────────────────────────────────────────────────
    if (operation === "fetch-metadata") {
      if (!appId)          return errText(`appId is required for operation "fetch-metadata".`);
      if (!destination)    return errText(`destination is required. Call "destinations" first.`);
      if (!folderRootPath) return errText(`folderRootPath is required for operation "fetch-metadata".`);
      if (!(await exists(folderRootPath))) return errText(`Not found: ${folderRootPath}`);

      const dests = await getDestinations(adminAPI, cfToken, appId);
      const dest  = dests.find(d => d.endPointName === destination);
      if (!dest) return errText(
        `Destination "${destination}" not found in "${appId}".\nCall "destinations" to see available options.`
      );

      const edmx = await fetchMetadataViaConduit(
        adminAPI, cfToken, appId,
        dest.endPointAddress || dest.cloudDestinationName || destination,
        pathSuffix
      );

      if (!edmx || (!edmx.includes("EntityType") && !edmx.includes("EntitySet")))
        return errText(`Response is not valid OData EDMX. First 200 chars:\n${edmx?.slice(0, 200)}`);

      const entitySets = [...edmx.matchAll(/EntitySet\s+Name="([^"]+)"/g)].map(m => m[1]);
      const meta = {
        mobile: {
          api: adminAPI, app: appId,
          destinations: [{
            name: destination, endPointName: destination,
            endPointAddress: dest.endPointAddress,
            cloudDestinationName: dest.cloudDestinationName,
            ssoMethod: dest.ssoMethod || "OAuth2SAMLBearerAssertion",
            useCloudConnector: dest.useCloudConnector || false,
            metadata: { odataContent: edmx }
          }]
        }
      };
      const metaPath = path.join(folderRootPath, ".service.metadata");
      await writeText(metaPath, JSON.stringify(meta, null, 2));

      return jsonText({
        savedTo: metaPath, appId, destination,
        entitySets, entitySetCount: entitySets.length,
        next: `Call mdk_create with oDataEntitySets: "${entitySets.slice(0, 3).join(",")}" then mdk_manage validate.`
      });
    }

    // ── create-app ────────────────────────────────────────────────────────────
    if (operation === "create-app") {
      if (!appName) return errText(`appName is required for operation "create-app".`);
      if (!appId)   return errText(`appId is required (e.g. "myapp.mdk.demo").`);
      if (!/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(appId))
        return errText(`appId "${appId}" invalid. Use reverse-domain format: e.g. myapp.mdk.demo`);

      const endpoints = addEspmSample ? [{
        endPointName: "com.sap.edm.sampleservice.v4",
        endPointAddress: "https://services.odata.org/v4/northwind/northwind.svc",
        ssoMethod: "NoSSO", useCloudConnector: false
      }] : [];

      try {
        await apiPost(adminAPI, cfToken, "/apps", {
          name: appId, displayName: appName,
          security: { name: "XSUAA" },
          services: [
            { name: "push" }, { name: "settings" }, { name: "clientLog" },
            { name: "connectivity" },
            { name: "proxy", parameters: { endpointConfigurations: endpoints } }
          ]
        });
      } catch (e) {
        if (e.status === 409 || /conflict|already exist/i.test(e.message))
          return errText(`App ID "${appId}" already exists. Use "list" to see existing apps.`);
        return errText(`Failed to create app: ${e.message}`);
      }

      process.stderr.write(`[mdk_mobile_services] Polling for Started state...\n`);
      const { started, error: pollErr } = await pollUntilStarted(adminAPI, cfToken, appId);

      return jsonText({
        created: true, started, appId, appName,
        org: config.OrganizationFields.Name, space: config.SpaceFields.Name,
        destinations: endpoints.map(e => e.endPointName),
        warning: !started ? (pollErr || "Still starting — wait 2-3 min then call 'destinations'.") : undefined,
        next: started
          ? `App is running. Call "destinations" with appId "${appId}" then "fetch-metadata".`
          : `Call "destinations" with appId "${appId}" after the app reaches Started state.`
      });
    }

    return errText(`Unknown operation "${operation}". Valid: list, destinations, fetch-metadata, create-app.`);
  }
};
