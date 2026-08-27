// Exact replica of SAP/mdk-mcp-server "mdk-manage" tool (Apache-2.0)
import path from "node:path";
import fs from "node:fs";
import {
  getMdkToolsPath, getMdkBinary,
  isCFLoggedIn, getCFAuthErrorMessage,
  getMobileServiceAppName, readServiceMetadata,
  isCapProject, runCommand
} from "../../lib/mdk-utils.js";

export default {
  name: "mdk-manage",
  description:
    "Comprehensive MDK project management tool that handles build, deploy, validate, migrate, show QR code, and mobile app editor operations.",
  inputSchema: {
    type: "object",
    properties: {
      folderRootPath: { type: "string", description: "The path of the current project root folder." },
      operation: {
        type: "string",
        enum: ["build","deploy","validate","migrate","show-qrcode","open-mobile-app-editor"],
        description: "build: Build. deploy: Deploy to Mobile Services. validate: Validate. migrate: Migrate to latest. show-qrcode: Show QR code. open-mobile-app-editor: Instructions to open Mobile App Editor."
      },
      externals: {
        type: "array", items: { type: "string" }, default: [],
        description: "Optional external package names for deploy (e.g. ['@nativescript/geolocation'])."
      }
    },
    required: ["folderRootPath", "operation"]
  },

  async handler({ folderRootPath, operation, externals = [] } = {}) {
    try {
      const mdkToolsPath = await getMdkToolsPath();
      const mdkBinary = getMdkBinary(mdkToolsPath);

      switch (operation) {
        case "build": {
          if (!mdkBinary) return { content: [{ type: "text", text: "Error: MDK tools not found. Please ensure @sap/mdk-tools is installed: npm install -g @sap/mdk-tools" }] };
          const buildScript = `${mdkBinary} build --target zip --project "${folderRootPath}"`;
          const buildResult = runCommand(buildScript);
          return { content: [{ type: "text", text: `MDK Build completed successfully.\n\n${buildResult}` }] };
        }

        case "deploy": {
          if (!isCFLoggedIn()) return { content: [{ type: "text", text: getCFAuthErrorMessage() }] };

          // Auto-read mdk.bundlerExternals from .vscode/settings.json (same as real server)
          let resolvedExternals = [...(externals || [])];
          if (resolvedExternals.length === 0) {
            const vsSettingsPath = path.join(folderRootPath, ".vscode", "settings.json");
            if (fs.existsSync(vsSettingsPath)) {
              try {
                const settings = JSON.parse(fs.readFileSync(vsSettingsPath, "utf-8").replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, ""));
                if (settings["mdk.bundlerExternals"] && Array.isArray(settings["mdk.bundlerExternals"])) {
                  resolvedExternals = settings["mdk.bundlerExternals"];
                  console.error(`[MDK MCP Server] Using ${resolvedExternals.length} externals from .vscode/settings.json`);
                }
              } catch (e) {
                console.error(`[MDK MCP Server] Failed to read externals from settings.json: ${e.message}`);
              }
            }
          }

          // Get mobile service app name
          const mobileServiceAppName = getMobileServiceAppName(folderRootPath);
          if (!mobileServiceAppName) {
            return { content: [{ type: "text", text: `Error: Unable to read mobile service app name. Please make sure either .service.metadata file exists in project root ${folderRootPath}, or .project.json file exists.` }] };
          }

          if (!mdkBinary) return { content: [{ type: "text", text: "Error: MDK tools not found. Please ensure @sap/mdk-tools is installed: npm install -g @sap/mdk-tools" }] };

          // Check if CAP project for --create and --destination flags
          const { isCap } = isCapProject(path.dirname(folderRootPath));
          let destinationString = "";
          if (isCap) {
            try {
              const meta = readServiceMetadata(folderRootPath);
              if (meta?.mobile?.destinations?.[0]?.name) {
                destinationString = `--destination ${meta.mobile.destinations[0].name}`;
                if (meta.mobile.destinations[0].url) {
                  destinationString += ` --destinationUrl ${meta.mobile.destinations[0].url}`;
                  if (meta.mobile.destinations[0].relativeUrl) {
                    destinationString += meta.mobile.destinations[0].relativeUrl;
                  }
                }
              }
            } catch { /**/ }
          }

          const externalsString = resolvedExternals.length > 0 ? `--externals "${resolvedExternals.join(",")}"` : "";
          const deployParts = [
            `${mdkBinary} deploy`,
            `--target mobile`,
            `--name ${mobileServiceAppName}`,
            `--showqr`,
            `--project "${folderRootPath}"`,
            externalsString,
          ];
          if (isCap) {
            deployParts.push("--create");
            if (destinationString) deployParts.push(destinationString);
          }
          const deployScript = deployParts.filter(Boolean).join(" ");

          const deployResult = runCommand(deployScript);
          const filtered = deployResult.replace(/SAP Mobile Start/gi, "SAP Mobile Services Client").replace(/Mobile Start/gi, "SAP Mobile Services Client");
          return { content: [{ type: "text", text: `MDK Deploy completed successfully.\n\n${filtered}` }] };
        }

        case "validate": {
          if (mdkBinary) {
            const validationCommand = `${mdkBinary} validate --project "${folderRootPath}"`;
            return {
              content: [{
                type: "text",
                text: `# MDK Project Validation\n\nFor large projects, validation may take several minutes and can exceed the MCP timeout limit.\n\n**Please run the following command directly in your terminal:**\n\n\`\`\`bash\n${validationCommand}\n\`\`\`\n\n**Or navigate to your project and run:**\n\n\`\`\`bash\ncd "${folderRootPath}"\n${mdkBinary} validate --project .\n\`\`\`\n\nThis will validate your MDK project and display any errors or warnings.`
              }]
            };
          }
          return { content: [{ type: "text", text: "Error: MDK tools not found. Please ensure @sap/mdk-tools is installed." }] };
        }

        case "migrate": {
          if (!mdkBinary) return { content: [{ type: "text", text: "Error: MDK tools not found. Please ensure @sap/mdk-tools is installed." }] };
          const migrationScript = `${mdkBinary} migrate --project "${folderRootPath}"`;
          const migrateResult = runCommand(migrationScript);
          return { content: [{ type: "text", text: `MDK Migration completed successfully.\n\n${migrateResult}` }] };
        }

        case "show-qrcode": {
          const qrCodePath = path.join(folderRootPath, ".build", "qrcode.png");
          if (!fs.existsSync(qrCodePath)) {
            return { content: [{ type: "text", text: `QR code not found at ${qrCodePath}. Please deploy the project first to generate a QR code.` }] };
          }
          return { content: [{ type: "text", text: `You can find the **qrcode.png** file in the **\`.build\`** folder in your VS Code Explorer sidebar and click on it to view it.\n\nScan the QR code with the **SAP Mobile Services Client** app to onboard the MDK application.` }] };
        }

        case "open-mobile-app-editor": {
          return {
            content: [{
              type: "text",
              text: `Instructions to open Mobile App Editor:\n\n1. Execute "cf login --sso" in a terminal window.\n2. Press "Command+Shift+P" and then select "MDK: Open Mobile App Editor" command.\n3. Create/Select a new/existing mobile app.\n4. Select a destination.\n5. Click "Add App to Project" button.`
            }]
          };
        }

        default:
          return { content: [{ type: "text", text: `Unknown operation: ${operation}. Supported: build, deploy, validate, migrate, show-qrcode, open-mobile-app-editor` }] };
      }
    } catch (error) {
      console.error("MDK project manager operation failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (/cloud foundry token|please login cf|cf login|not logged in/i.test(errorMessage)) {
        return { content: [{ type: "text", text: getCFAuthErrorMessage() }] };
      }
      return { content: [{ type: "text", text: `Operation failed: ${errorMessage}` }] };
    }
  }
};
