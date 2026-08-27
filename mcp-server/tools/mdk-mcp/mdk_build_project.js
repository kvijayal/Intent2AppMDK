// MDK build tool — runs mdkcli build to produce the deployment zip bundle.
import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";
import { exists } from "../../lib/fs-utils.js";
import { jsonText, errText } from "../_util.js";

const exec = promisify(execCb);

export default {
  name: "mdk_build_project",
  description:
    "Build an MDK project into a deployable zip bundle using mdkcli. Output lands in .build/ under the project root. Always run mdk_validate_project first — never build a project with validation errors.",
  inputSchema: {
    type: "object",
    properties: {
      projectDir: { type: "string", description: "Absolute path to the MDK project root." }
    },
    required: ["projectDir"]
  },
  async handler({ projectDir } = {}) {
    if (!projectDir) return errText("projectDir is required");
    if (!(await exists(projectDir))) return errText(`Project directory not found: ${projectDir}`);

    try {
      const { stdout, stderr } = await exec(
        `npx @sap/mdk-tools build --target zip --project "${projectDir}"`,
        { cwd: projectDir, timeout: 180000, maxBuffer: 8 * 1024 * 1024 }
      );
      const output = (stdout + stderr).trim();
      const failed = /error/i.test(output) && !/warning/i.test(output);
      return jsonText({
        projectDir,
        pass: !failed,
        output,
        bundle: `${projectDir}/.build/`,
        next: failed
          ? "Build failed. Run mdk_validate_project to identify schema errors."
          : "Build succeeded. Run mdk_deploy_project to push to SAP Mobile Services."
      });
    } catch (e) {
      return jsonText({
        projectDir,
        pass: false,
        output: ((e.stdout || "") + (e.stderr || "") + "\n" + (e.message || "")).trim(),
        hint: "Build failed. Ensure mdk_validate_project passes with 0 errors first."
      });
    }
  }
};
