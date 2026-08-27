// Fetches OData metadata from a Mobile Services destination and saves .service.metadata.
// Uses Node built-in fetch — no curl, no bash subprocess.
// Replicated from SAP/mdk-mcp-server mobile-services-client.ts fetchMetadata() (Apache-2.0)
import path from "node:path";
import { exists, writeText } from "../../lib/fs-utils.js";
import { jsonText, errText } from "../_util.js";
import {
  getAuthContext, getDestinations, fetchMetadataViaConduit
} from "../../lib/mobile-services.js";

export default {
  name: "mdk_fetch_mobile_metadata",
  description:
    "Fetches OData metadata from a SAP Mobile Services destination using the conduit " +
    "pattern and saves it as .service.metadata in the project root. " +
    "Call mdk_list_mobile_apps first to get appId and destination name. " +
    "Requires CF login. Uses Node built-in fetch — no bash commands.",
  inputSchema: {
    type: "object",
    properties: {
      folderRootPath: { type: "string", description: "MDK project root path." },
      appId:          { type: "string", description: "Mobile Services App ID. Get from mdk_list_mobile_apps." },
      destination:    { type: "string", description: "Destination name. Get from mdk_list_mobile_apps with appId." },
      pathSuffix:     { type: "string", default: "", description: "Optional path suffix before /$metadata." },
      landscapeType:  { type: "string", enum: ["Standard","Preview"], default: "Standard" }
    },
    required: ["folderRootPath", "appId", "destination"]
  },

  async handler({ folderRootPath, appId, destination, pathSuffix = "", landscapeType = "Standard" } = {}) {
    if (!folderRootPath) return errText("folderRootPath is required.");
    if (!appId)          return errText("appId is required. Get from mdk_list_mobile_apps.");
    if (!destination)    return errText("destination is required. Get from mdk_list_mobile_apps with appId.");
    if (!(await exists(folderRootPath))) return errText(`Not found: ${folderRootPath}`);

    const auth = await getAuthContext(landscapeType);
    if (auth.error) return errText(auth.error);
    const { config, cfToken, adminAPI } = auth;

    // Get destination endpoint address
    const destinations = await getDestinations(adminAPI, cfToken, appId).catch(() => []);
    const destConfig = destinations.find(d => d.endPointName === destination);
    if (!destConfig) {
      return errText(
        `Destination "${destination}" not found in app "${appId}".\n\n` +
        `Call mdk_list_mobile_apps { "appId": "${appId}" } to see available destinations.`
      );
    }
    const endpointAddress = destConfig.endPointAddress || destConfig.cloudDestinationName || destination;

    // Fetch EDMX via conduit (no curl — pure fetch)
    const edmx = await fetchMetadataViaConduit(adminAPI, cfToken, appId, endpointAddress, pathSuffix)
      .catch(e => { throw new Error(`Conduit fetch failed: ${e.message}`); });

    if (!edmx || (!edmx.includes("EntityType") && !edmx.includes("EntitySet"))) {
      return errText(
        `Response is not valid OData EDMX.\nFirst 300 chars:\n${edmx?.substring(0, 300)}\n\n` +
        `Fallback: VS Code → Cmd+Shift+P → "MDK: Open Mobile App Editor" → Add App to Project`
      );
    }

    // Extract entity sets
    const entitySets = [...edmx.matchAll(/EntitySet\s+Name="([^"]+)"/g)].map(m => m[1]);

    // Write .service.metadata
    const serviceMetadata = {
      mobile: {
        api: adminAPI,
        app: appId,
        destinations: [{
          name: destination,
          endPointName: destination,
          endPointAddress: endpointAddress,
          cloudDestinationName: destConfig.cloudDestinationName,
          ssoMethod: destConfig.ssoMethod || "OAuth2SAMLBearerAssertion",
          useCloudConnector: destConfig.useCloudConnector || false,
          metadata: { odataContent: edmx }
        }]
      }
    };
    const metaPath = path.join(folderRootPath, ".service.metadata");
    await writeText(metaPath, JSON.stringify(serviceMetadata, null, 2));

    return jsonText({
      success: true,
      appId,
      destination,
      endpointAddress,
      savedTo: metaPath,
      entitySets,
      entitySetCount: entitySets.length,
      nextStep: [
        `✓ .service.metadata saved — ${entitySets.length} entity sets: ${entitySets.join(", ")}`,
        `Call mdk_create with oDataEntitySets: "${entitySets.slice(0, 3).join(",")}"`,
        `Then mdk_manage with operation: "validate"`
      ].join("\n")
    });
  }
};
