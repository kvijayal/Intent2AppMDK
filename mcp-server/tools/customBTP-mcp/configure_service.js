import path from "node:path";
import { exists, readText, writeText, walk } from "../../lib/fs-utils.js";
import { okText, errText } from "../_util.js";

function snippets({ serviceName, url, proxyPath, destinationName, backendUrl }) {
  const dest = destinationName || "<DESTINATION_NAME>";
  const host = backendUrl || "https://<your-backend-host>";
  return `# Service configuration — ${serviceName}

This app is wired for BOTH offline mock and the real backend. Flip with the npm scripts:

    npm run start:mock     # offline, generated mock data (sap-fe-mockserver)
    npm run start:proxy    # real service via the proxy/destination below

OData service path used by the app: ${url}

## 1. ui5.yaml / ui5-local.yaml — fiori-tools-proxy backend (real backend)

    server:
      customMiddleware:
        - name: fiori-tools-proxy
          afterMiddleware: compression
          configuration:
            backend:
              - path: ${proxyPath}
                url: ${host}          # VS Code: a reachable URL
                # destination: ${dest}   # BAS: use a BTP destination instead of url

## 2. Approuter xs-app.json — route to the destination (deploy)

    {
      "source": "${proxyPath}(.*)",
      "target": "$1",
      "destination": "${dest}",
      "authenticationType": "xsuaa",
      "csrfProtection": true
    }

## 3. mta.yaml — destination & html5 wiring (deploy)

    resources:
      - name: app-destination-service
        type: org.cloudfoundry.managed-service
        parameters:
          service: destination
          service-plan: lite
      # Bind app-destination-service + xsuaa to the approuter module.

Clean Core note: the backend service must be a RELEASED/public OData service. Do not point the
destination at a modified or non-released core service.
`;
}

export default {
  name: "configure_service",
  description:
    "Wire a Fiori app to its OData service for BOTH local mock and the real backend. Patches manifest.json dataSources and writes service-config.snippets.md with the ui5.yaml/ui5-local.yaml proxy backend block, the approuter xs-app.json route, and the mta.yaml destination resource to merge for deployment.",
  inputSchema: {
    type: "object",
    properties: {
      appDir: { type: "string" },
      source: { type: "string", enum: ["cap", "edmx", "destination"], default: "edmx" },
      serviceName: { type: "string", default: "mainService" },
      serviceUrl: { type: "string", description: "Service path, e.g. /odata/v4/po or /sap/opu/odata4/sap/.../srvd/.../0001/." },
      destinationName: { type: "string", description: "BTP destination name for the real backend (BAS/CF)." },
      backendUrl: { type: "string", description: "Backend host URL for the local VS Code proxy." }
    },
    required: ["appDir", "source"]
  },
  async handler({ appDir, source, serviceName = "mainService", serviceUrl, destinationName, backendUrl }) {
    if (!(await exists(appDir))) return errText(`appDir not found: ${appDir}`);
    const url = serviceUrl || (source === "cap" ? `/odata/v4/${serviceName}` : "/odata/v4/service");
    const proxyPath = "/" + url.replace(/^\//, "").split("/")[0];

    const files = await walk(appDir);
    const manifestPath = files.find((f) => f.endsWith("manifest.json"));
    let manifestNote = "manifest.json not found — add the dataSource manually.";
    if (manifestPath) {
      try {
        const j = JSON.parse(await readText(manifestPath));
        j["sap.app"] = j["sap.app"] || {};
        j["sap.app"].dataSources = j["sap.app"].dataSources || {};
        j["sap.app"].dataSources[serviceName] = {
          uri: url.endsWith("/") ? url : url + "/",
          type: "OData",
          settings: {
            odataVersion: "4.0",
            ...(source !== "cap" ? { localUri: `localService/${serviceName}/metadata.xml` } : {})
          }
        };
        await writeText(manifestPath, JSON.stringify(j, null, 2) + "\n");
        manifestNote = `Patched ${path.relative(appDir, manifestPath)} → dataSources.${serviceName}.`;
      } catch (e) {
        manifestNote = `Could not patch manifest automatically: ${e.message}`;
      }
    }

    await writeText(path.join(appDir, "service-config.snippets.md"), snippets({ serviceName, url, proxyPath, destinationName, backendUrl }));

    return okText(
      `${manifestNote}\n` +
        `Wrote service-config.snippets.md (proxy + approuter + mta).\n` +
        `Local run: npm run start:mock (offline) or start:proxy (real backend via ${destinationName ? `destination "${destinationName}"` : backendUrl || "the proxy URL"}).`
    );
  }
};
