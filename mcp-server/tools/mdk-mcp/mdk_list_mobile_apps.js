// Lists SAP Mobile Services applications and their OData destinations.
// Uses Node built-in fetch — no curl, no bash subprocess.
// Replicated from SAP/mdk-mcp-server mobile-services-client.ts (Apache-2.0)
import { jsonText, errText, okText } from "../_util.js";
import {
  getAuthContext, listApplications, getDestinations
} from "../../lib/mobile-services.js";

export default {
  name: "mdk_list_mobile_apps",
  description:
    "Lists SAP Mobile Services applications and their OData destinations from the " +
    "current CF org/space. Call without appId to list all apps (fast — names only). " +
    "Call with appId to get destinations for that specific app. " +
    "Requires CF login. Uses Node built-in fetch — no bash commands.",
  inputSchema: {
    type: "object",
    properties: {
      landscapeType: {
        type: "string",
        enum: ["Standard", "Preview"],
        default: "Standard",
        description: "Standard = production BTP. Preview = trial/test."
      },
      appId: {
        type: "string",
        description: "Optional: get destinations for a specific app only. Omit to list all apps."
      }
    }
  },

  async handler({ landscapeType = "Standard", appId } = {}) {
    const auth = await getAuthContext(landscapeType);
    if (auth.error) return errText(auth.error);
    const { config, cfToken, adminAPI } = auth;

    try {
      if (appId) {
        // Fetch destinations for ONE specific app only
        const destinations = await getDestinations(adminAPI, cfToken, appId);
        if (!destinations.length) {
          return okText(
            `No OData destinations found in app "${appId}".\n\n` +
            `Configure one: BTP Cockpit → Mobile Services → your app → Mobile Connectivity → New.`
          );
        }
        return jsonText({
          org: config.OrganizationFields.Name,
          space: config.SpaceFields.Name,
          appId,
          destinations: destinations.map(d => ({
            name:            d.endPointName,
            endpointAddress: d.endPointAddress || d.cloudDestinationName || "(cloud destination)",
            ssoMethod:       d.ssoMethod || "OAuth2SAMLBearerAssertion"
          })),
          nextStep:
            `Call mdk_fetch_mobile_metadata with:\n` +
            `  appId: "${appId}"\n` +
            `  destination: "${destinations[0]?.endPointName}"`
        });
      }

      // List all apps — names only (no per-app destination calls)
      const apps = await listApplications(adminAPI, cfToken);
      if (!apps.length) {
        return okText(
          `No Mobile Services apps found in:\n` +
          `  Org:   ${config.OrganizationFields.Name}\n` +
          `  Space: ${config.SpaceFields.Name}\n\n` +
          `Create one: VS Code → Cmd+Shift+P → "MDK: Open Mobile App Editor" → "+"\n` +
          `Or use mdk_create_mobile_app tool.`
        );
      }

      return jsonText({
        org:      config.OrganizationFields.Name,
        space:    config.SpaceFields.Name,
        landscape: landscapeType,
        appCount: apps.length,
        apps: apps.map(a => ({
          appId:       a.name,
          displayName: a.displayName || a.name
        })),
        note: "Call again with appId to see destinations for a specific app.",
        nextStep: apps.length === 1
          ? `One app found. Call mdk_list_mobile_apps { "appId": "${apps[0].name}" } to see its destinations.`
          : `${apps.length} apps found. Pick one and call mdk_list_mobile_apps with that appId.`
      });

    } catch (e) {
      const status = e.status;
      if (status === 401 || status === 403) {
        await (await import("../../lib/mobile-services.js")).refreshCFToken();
        return errText("CF token expired — refreshed. Please retry.");
      }
      if (e.message?.includes("ENOTFOUND") || e.message?.includes("ECONNREFUSED")) {
        return errText(
          `Cannot reach Mobile Services API: ${adminAPI}\n\n` +
          `Check: correct CF region, Mobile Services enabled, network/VPN access.`
        );
      }
      return errText(`Mobile Services error: ${e.message}\nAdmin API: ${adminAPI}`);
    }
  }
};
