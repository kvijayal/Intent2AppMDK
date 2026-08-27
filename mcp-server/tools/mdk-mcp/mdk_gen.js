// Exact replica of SAP/mdk-mcp-server "mdk-gen" tool (Apache-2.0)
// Returns LLM prompts for pages/actions/i18n, or searches rule examples via vector embeddings.
import path from "node:path";
import fs from "node:fs";
import {
  getServiceDataWithFallback, getTemplatesPath
} from "../../lib/mdk-utils.js";

export default {
  name: "mdk-gen",
  description:
    "Generates MDK artifacts including pages, actions, i18n files, and rule references. " +
    "Returns prompts for LLM processing (pages, actions, i18n) or searches for rule examples.",
  inputSchema: {
    type: "object",
    properties: {
      folderRootPath: { type: "string", description: "The path of the current project root folder (not required for rule artifact type)." },
      artifactType: {
        type: "string", enum: ["page", "action", "i18n", "rule"],
        description: "page: Generate MDK page files. action: Generate MDK action files. i18n: Generate i18n files. rule: Search for rule examples."
      },
      pageType: { type: "string", enum: ["databinding", "layout"], description: "Required when artifactType is 'page'." },
      controlType: {
        type: "string",
        enum: ["ObjectTable","FormCell","KeyValue","ObjectHeader","ContactTable","SimplePropertyCollection","ObjectCard","DataTable","KPIHeader","ProfileHeader","ObjectCollection","Timeline","TimelinePreview","Calendar"],
        description: "Required when pageType is 'databinding'."
      },
      oDataEntitySets: { type: "string", description: "OData entity sets (comma-separated). Required for page/action." },
      layoutType: {
        type: "string",
        enum: ["Section","BottomNavigation","FlexibleColumnLayout","SideDrawerNavigation","Tabs","Extension"],
        description: "Required when pageType is 'layout'."
      },
      actionType: {
        type: "string",
        enum: ["CreateODataEntity","UpdateODataEntity","DeleteODataEntity","CreateODataMedia","InitializeOfflineOData","DownloadOfflineOData","UploadOfflineOData","CancelDownloadOfflineOData","CancelUploadOfflineOData","ClearOfflineOData","CloseOfflineOData","CreateODataRelatedEntity","CreateODataRelatedMedia","CreateODataService","DeleteODataMedia","DownloadMediaOData","LogMessage","Message","Navigation","OpenODataService","ProgressBanner","PushNotificationRegister","PushNotificationUnregister","ReadODataService","RemoveDefiningRequest","SendRequest","SetLevel","SetState","ToastMessage","UndoPendingChanges","UploadLog","UploadODataMedia","UploadStreamOData","ChatCompletion","PopoverMenu","CheckRequiredFields","ChangeSet","OpenDocument","Banner","Filter"],
        description: "Required when artifactType is 'action'."
      },
      query: { type: "string", description: "Search query for rule reference (required when artifactType is 'rule')." }
    },
    required: ["artifactType"]
  },

  async handler({ folderRootPath, artifactType, pageType, controlType, oDataEntitySets, layoutType, actionType, query } = {}) {
    try {
      const templatesPath = getTemplatesPath();

      switch (artifactType) {
        case "i18n": {
          let existingContent = "";
          if (folderRootPath) {
            const i18nPath = path.join(folderRootPath, "i18n", "i18n.properties");
            if (fs.existsSync(i18nPath)) existingContent = fs.readFileSync(i18nPath, "utf-8");
          }
          const systemPrompt = `Imagine you are a helpful assistant from SAP company who can generate i18n files and translate the values in i18n files to a special language.

Restrictions:
- An i18n file is a file that contains the translated texts
- The i18n file stores translations as key-value pairs
- A resource bundle key-value pair consists of a key and a value separated by an equal sign
- For each language, there's one resource bundle

Instructions:
- The key is consistent across resource bundles—it always stays the same—the value changes to each language
- The keys are in CamelCase. The value is the actual text that should be displayed

Requirements:
- All i18n files end in .properties
- Their names begin with an i18n, followed by an underscore, and the language's acronym, like i18n_en.properties
- All strings for translation have to be annotated to provide more context for translation
- An annotation consists of an 'X/Y text type classification, an optional length restriction, and a freetext explanation how the string is used on the UI
- The annotation need not to be translated
- Please show your whole output in Markdown fenced code block starting with ###i18n_{language code}.properties

Restrictions:
- Don't generate comments in the i18n file
- Don't remove _ from keys
- Don't generate X/Y text type classification, Customer list on dashboard= in the i18n file`;
          const enhancedUserPrompt = `In my project, the default i18n file is ${existingContent}`;
          return { content: [{ type: "text", text: systemPrompt + enhancedUserPrompt }] };
        }

        case "page": {
          if (!folderRootPath) return { content: [{ type: "text", text: "Error: folderRootPath is required for page artifact type." }] };
          const mdkApp = folderRootPath.split("/").pop();

          if (pageType === "databinding") {
            if (!controlType) return { content: [{ type: "text", text: "Error: controlType is required for databinding pages." }] };

            const serviceResult = getServiceDataWithFallback(folderRootPath, oDataEntitySets);
            if (!serviceResult) {
              return { content: [{ type: "text", text: `Error: Unable to read service metadata. Please make sure either .service.metadata file exists in project root ${folderRootPath}, or .project.json file exists and corresponding .XML file in Services folder.` }] };
            }

            const templateFile = path.join(templatesPath, "Page", "DataBinding", `${controlType}.md`);
            if (!fs.existsSync(templateFile)) {
              return { content: [{ type: "text", text: `Error: Template not found for controlType: ${controlType}. Ensure res/templates/Page/DataBinding/${controlType}.md exists.` }] };
            }
            const mdkExample = fs.readFileSync(templateFile, "utf-8");

            let systemPrompt = `Imagine you are a helpful assistant from SAP company who can generate a page file for Mobile Development Kit.

Instruction:
- The page file name extension is ".page", please show all file name in ####{file_name}.
- Please use the actual appName and Service file path in your output result.
- Do not generate any comments in JSON file.
- When the Section type is FormCell,if the data property type is Edm.String or String, generate Control.Type.FormCell.SimpleProperty, if the data property type is Edm.Boolean or Boolean, generate Control.Type.FormCell.Switch, if the data property type is Edm.DateTime or Date, generate Control.Type.FormCell.DatePicker.
- When the Section type is FormCell,if the data property is key, don't generate formcell control.
- When the Section type is FormCell, also generate the corresponding actions and javascript files.
- Include file extension in file reference.
- Don't include .json in generated file name.`;

            if (oDataEntitySets) {
              systemPrompt += `\n- Focus on the following OData entity sets: ${oDataEntitySets}`;
              systemPrompt += `\n- Generate pages only for these specified entity sets.`;
            }

            let enhancedUserPrompt = `In my project, the appName is ${mdkApp}, the Service file path is ${serviceResult.servicePath}, the Service data definition is \n\`\`\`${serviceResult.serviceData}\`\`\`\nthe example is \n\`\`\`${mdkExample}\`\`\``;
            if (oDataEntitySets) enhancedUserPrompt += `\n\nPlease generate pages specifically for these entity sets: ${oDataEntitySets}`;

            return { content: [{ type: "text", text: systemPrompt + enhancedUserPrompt }] };
          }

          if (pageType === "layout") {
            if (!layoutType) return { content: [{ type: "text", text: "Error: layoutType is required for layout pages." }] };
            const templateFile = path.join(templatesPath, "Page", "Layout", `${layoutType}.md`);
            if (!fs.existsSync(templateFile)) {
              return { content: [{ type: "text", text: `Error: Template not found for layoutType: ${layoutType}. Ensure res/templates/Page/Layout/${layoutType}.md exists.` }] };
            }
            const mdkExample = fs.readFileSync(templateFile, "utf-8");
            const systemPrompt = `Imagine you are a helpful assistant from SAP company who can generate a page file for Mobile Development Kit.`;
            return { content: [{ type: "text", text: systemPrompt + mdkExample }] };
          }

          return { content: [{ type: "text", text: `Unknown page type: ${pageType}` }] };
        }

        case "action": {
          if (!folderRootPath) return { content: [{ type: "text", text: "Error: folderRootPath is required for action artifact type." }] };
          if (!actionType) return { content: [{ type: "text", text: "Error: actionType is required for action artifact type." }] };

          const mdkApp = folderRootPath.split("/").pop();
          const serviceResult = getServiceDataWithFallback(folderRootPath, oDataEntitySets);
          if (!serviceResult) {
            return { content: [{ type: "text", text: `Error: Unable to read service metadata. Please make sure either .service.metadata file exists in project root ${folderRootPath}, or .project.json file exists and corresponding .XML file in Services folder.` }] };
          }

          const templateFile = path.join(templatesPath, "Action", `${actionType}.md`);
          if (!fs.existsSync(templateFile)) {
            return { content: [{ type: "text", text: `Error: Template not found for actionType: ${actionType}. Ensure res/templates/Action/${actionType}.md exists.` }] };
          }
          const mdkExample = fs.readFileSync(templateFile, "utf-8");

          let systemPrompt = `Imagine you are a helpful assistant from SAP company who can generate an action file for Mobile Development Kit.

Instruction:
- Please use the actual appName and Service file path in your output result.
- Do not generate any comments in JSON file.`;
          if (oDataEntitySets) {
            systemPrompt += `\n- Focus on the following OData entity sets: ${oDataEntitySets}`;
            systemPrompt += `\n- Generate actions only for these specified entity sets.`;
          }

          let enhancedUserPrompt = `In my project, the appName is ${mdkApp}, the Service file path is ${serviceResult.servicePath}, the Service data definition is \n\`\`\`${serviceResult.serviceData}\`\`\`\nthe example is \n\`\`\`${mdkExample}\`\`\``;
          if (oDataEntitySets) enhancedUserPrompt += `\n\nPlease generate actions specifically for these entity sets: ${oDataEntitySets}`;

          return { content: [{ type: "text", text: systemPrompt + enhancedUserPrompt }] };
        }

        case "rule": {
          if (!query) return { content: [{ type: "text", text: "Error: query is required for rule artifact type." }] };

          // Search rule templates by keyword (simplified — real server uses vector search)
          const ruleDir = path.join(templatesPath, "Rule");
          if (!fs.existsSync(ruleDir)) {
            return { content: [{ type: "text", text: `No relevant rule files found for prompt: "${query}". Ensure res/templates/Rule/ folder exists with rule templates.` }] };
          }

          const ruleFiles = fs.readdirSync(ruleDir).filter(f => f.endsWith(".js") || f.endsWith(".md"));
          const q = query.toLowerCase();
          const scored = ruleFiles.map(f => ({
            file: f,
            score: q.split(" ").filter(w => f.toLowerCase().includes(w)).length
          })).filter(r => r.score > 0).sort((a, b) => b.score - a.score);

          if (scored.length === 0) {
            return { content: [{ type: "text", text: `No relevant rule files found for prompt: "${query}". Try using different keywords or more specific descriptions.` }] };
          }

          const best = scored[0];
          const filePath = path.join(ruleDir, best.file);
          const fileContent = fs.readFileSync(filePath, "utf-8");

          let result = `# Most Relevant Rule File for: "${query}"\n\n`;
          result += `**File:** ${best.file}\n`;
          result += `**Path:** \`res/templates/Rule/${best.file}\`\n\n`;
          result += `\`\`\`javascript\n${fileContent}\n\`\`\`\n`;
          return { content: [{ type: "text", text: result }] };
        }

        default:
          return { content: [{ type: "text", text: `Unknown artifact type: ${artifactType}` }] };
      }
    } catch (error) {
      console.error("MDK artifact generation failed:", error);
      return { content: [{ type: "text", text: error instanceof Error ? error.toString() : String(error) }] };
    }
  }
};
