// Replicated from SAP/open-ux-tools — fiori-mcp-server (Apache-2.0)
// Upstream tool: "download_odata_service_metadata" — fetch EDMX, save metadata.xml.
// Self-contained: uses global fetch (no external MCP dependency).
import path from "node:path";
import { writeText } from "../../lib/fs-utils.js";
import { okText, errText } from "../_util.js";

export default {
  name: "fiori_download_odata_metadata",
  description:
    "Download the EDMX ($metadata) of an OData service and save it as a local metadata.xml — the input for offline mock generation (feed it to gen_mock_from_edmx). Pass the service root or a full $metadata URL. (Replicates the Fiori MCP server's download_odata_service_metadata — no external MCP dependency.)",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "OData service URL or full $metadata URL." },
      outFile: { type: "string", description: "Where to save the EDMX (default: <cwd>/metadata.xml)." },
      headers: { type: "object", description: "Optional request headers (e.g. { Authorization: 'Bearer ...' }).", additionalProperties: { type: "string" } }
    },
    required: ["url"]
  },
  async handler({ url, outFile, headers = {} } = {}) {
    if (!url) return errText("url is required");
    const metaUrl = /\$metadata/i.test(url) ? url : url.replace(/\/?$/, "/") + "$metadata";

    let xml;
    try {
      const res = await fetch(metaUrl, { headers, signal: AbortSignal.timeout(30000) });
      if (!res.ok) return errText(`HTTP ${res.status} fetching ${metaUrl}`);
      xml = await res.text();
    } catch (e) {
      return errText(`Failed to fetch ${metaUrl}: ${e.message}`);
    }
    if (!/<edmx:Edmx|<Edmx/i.test(xml)) {
      return errText(`Response from ${metaUrl} is not EDMX. First 200 chars: ${xml.slice(0, 200)}`);
    }

    const dest = path.resolve(outFile || path.join(process.cwd(), "metadata.xml"));
    await writeText(dest, xml);

    const entitySets = [...xml.matchAll(/<EntitySet\s+Name="([^"]+)"/g)].map((m) => m[1]);
    const odataVersion = /Version="4/.test(xml) ? "4.0" : (/Version="2/.test(xml) ? "2.0" : "unknown");

    return okText(JSON.stringify({
      saved: dest,
      source: metaUrl,
      odataVersion,
      warning: odataVersion === "2.0" ? "This is OData V2 — Intent2App targets OData V4 only. Confirm with the developer before consuming." : undefined,
      entitySetCount: entitySets.length,
      entitySets: entitySets.slice(0, 50),
      next: "Run gen_mock_from_edmx on this file to create an offline mock, or configure_service to wire the real backend."
    }, null, 2));
  }
};
