import path from "node:path";
import { resolveStarter, STARTERS, OUTPUT_DIR, BASE_NAMESPACE } from "../../lib/starters.js";
import { copyDir, exists } from "../../lib/fs-utils.js";
import { rewriteNamespace } from "../../lib/namespace.js";
import { okText, errText } from "../_util.js";

export default {
  name: "scaffold_app",
  description:
    "Scaffold a runnable SAP app by copying a bundled reference starter into output/<appName> and rewriting its namespace in all four canonical places (Component, manifest, index.html, ui5.yaml). appType: cap-fe-lrop | cap-fe-alp | cap-fe-op | cap-fpm | freestyle-ui5 | external-fe.",
  inputSchema: {
    type: "object",
    properties: {
      appType: { type: "string", enum: Object.keys(STARTERS), description: "Which starter/floorplan to use." },
      namespace: { type: "string", description: "Lowercase dotted namespace, e.g. com.acme.purchaseorders." },
      appName: { type: "string", description: "Folder name under output/. Defaults to the last namespace segment." },
      targetDir: { type: "string", description: "Absolute target dir (overrides output/<appName>)." }
    },
    required: ["appType", "namespace"]
  },
  async handler({ appType, namespace, appName, targetDir }) {
    const starter = resolveStarter(appType);
    if (!starter) return errText(`Unknown appType "${appType}". Valid: ${Object.keys(STARTERS).join(", ")}`);
    if (!(await exists(starter.path)))
      return errText(`Reference starter not found at ${starter.path}. Populate reference-apps/ first.`);
    if (!namespace || !/^[a-z][a-z0-9_.-]*$/.test(namespace))
      return errText(`namespace must be lowercase dotted (e.g. com.acme.myapp). Got "${namespace}".`);

    const dest = targetDir || path.join(OUTPUT_DIR, appName || namespace.split(".").pop());
    if (await exists(dest)) return errText(`Target already exists: ${dest}. Choose another appName/targetDir.`);

    const copied = await copyDir(starter.path, dest);
    const changed = await rewriteNamespace(dest, BASE_NAMESPACE, namespace);

    return okText(
      `Scaffolded: ${starter.note}\n` +
        `  from : reference-apps/${starter.dir}\n` +
        `  to   : ${dest}\n` +
        `  namespace: ${namespace}\n` +
        `  files copied: ${copied.length}; namespace rewritten in ${changed.length} file(s)\n\n` +
        `Next: add_cds_entity / gen_mock_from_edmx (external) → generate_annotations → configure_service → validate_namespace → run_checks.`
    );
  }
};
