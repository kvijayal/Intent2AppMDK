// MDK project validation tool — runs mdkcli validate and returns structured results.
import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";
import { exists } from "../../lib/fs-utils.js";
import { jsonText, errText, okText } from "../_util.js";

const exec = promisify(execCb);

export default {
  name: "mdk_validate_project",
  description:
    "Validate an MDK project's metadata JSON files against the project schema version using mdkcli. Returns a structured pass/fail report with errors and warnings. Always run before mdk_build_project or mdk_deploy_project.",
  inputSchema: {
    type: "object",
    properties: {
      projectDir: { type: "string", description: "Absolute path to the MDK project root (folder containing .project.json)." }
    },
    required: ["projectDir"]
  },
  async handler({ projectDir } = {}) {
    if (!projectDir) return errText("projectDir is required");
    if (!(await exists(projectDir))) return errText(`Project directory not found: ${projectDir}`);

    const projectJson = `${projectDir}/.project.json`;
    if (!(await exists(projectJson))) return errText(`.project.json not found in ${projectDir}. Is this an MDK project root?`);

    try {
      const { stdout, stderr } = await exec(
        `npx @sap/mdk-tools validate --project "${projectDir}"`,
        { cwd: projectDir, timeout: 120000, maxBuffer: 8 * 1024 * 1024 }
      );
      const output = (stdout + stderr).trim();
      const hasErrors = /error/i.test(output);
      const hasWarnings = /warning/i.test(output);
      return jsonText({
        projectDir,
        pass: !hasErrors,
        errors: hasErrors,
        warnings: hasWarnings,
        output,
        next: hasErrors
          ? "Fix all errors before running mdk_build_project."
          : "Validation passed. Run mdk_build_project to produce the deployment bundle."
      });
    } catch (e) {
      const output = ((e.stdout || "") + (e.stderr || "") + "\n" + (e.message || "")).trim();
      const notInstalled = output.includes("not found") || output.includes("Cannot find");
      return jsonText({
        projectDir,
        pass: false,
        errors: true,
        output,
        hint: notInstalled
          ? "mdkcli not installed. Run: npm install -g @sap/mdk-tools"
          : "Validation failed. Fix the errors shown above."
      });
    }
  }
};
