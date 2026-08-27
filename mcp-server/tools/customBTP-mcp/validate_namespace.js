import { validateNamespace } from "../../lib/namespace.js";
import { exists } from "../../lib/fs-utils.js";
import { jsonText, errText } from "../_util.js";

export default {
  name: "validate_namespace",
  description:
    "Check the UI5 namespace is identical across Component, manifest.json (sap.app.id), index.html (resource-roots) and ui5.yaml (metadata.name), and that ui5.yaml metadata.name is lowercase. The #1 cause of 'failed to load Component.js'. Run after scaffolding or editing any of these files.",
  inputSchema: {
    type: "object",
    properties: { appDir: { type: "string", description: "Path to the app folder to check." } },
    required: ["appDir"]
  },
  async handler({ appDir }) {
    if (!(await exists(appDir))) return errText(`appDir not found: ${appDir}`);
    return jsonText(await validateNamespace(appDir));
  }
};
