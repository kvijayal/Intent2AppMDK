// Replicated from https://github.com/UI5/mcp-server (Apache-2.0)
import { okText, errText } from "../_util.js";

const CDN = {
  SAPUI5:  "https://ui5.sap.com/version.json",
  OpenUI5: "https://sdk.openui5.org/version.json"
};

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

export default {
  name: "ui5_get_version_info",
  description:
    "Get version information for UI5 (SAPUI5 or OpenUI5) from the CDN — lists all maintained versions, which are LTS, which is the latest, and the recommended minimum for new projects.",
  inputSchema: {
    type: "object",
    properties: {
      frameworkName: {
        type: "string",
        enum: ["SAPUI5", "OpenUI5"],
        description: "Which UI5 distribution to query. Default: SAPUI5",
        default: "SAPUI5"
      }
    }
  },
  async handler({ frameworkName = "SAPUI5" } = {}) {
    const url = CDN[frameworkName];
    if (!url) return errText(`Unknown frameworkName '${frameworkName}'. Use SAPUI5 or OpenUI5.`);

    let raw;
    try {
      raw = await fetchJson(url);
    } catch (e) {
      return errText(`Could not reach ${url}: ${e.message}. Check network connectivity.`);
    }

    // version.json shape: { latest, lts, versions: [{version, support, lts, eom}] }
    const versions = (raw.versions || []).map(v => ({
      version:  v.version,
      support:  v.support || "Unknown",
      lts:      !!v.lts,
      eom:      !!v.eom
    }));

    const summary = {
      framework:         frameworkName,
      latest:            raw.latest    || versions[0]?.version || "unknown",
      latestLTS:         raw.lts       || versions.find(v => v.lts)?.version || "unknown",
      recommendedForNew: raw.lts       || versions.find(v => v.lts)?.version || raw.latest || "unknown",
      maintained:        versions.filter(v => !v.eom),
      all:               versions
    };

    return okText(JSON.stringify(summary, null, 2));
  }
};
