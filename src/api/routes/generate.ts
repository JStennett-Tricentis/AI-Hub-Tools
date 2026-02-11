import { Router } from "express";
import { RequestGenerator } from "../../core/generator/request-generator.js";
import { BuilderConfigService } from "../../core/generator/builder-config.js";
import { formatGenerationSummary } from "../../core/generator/output-formatter.js";
import { addScreenshotsToJson } from "../../cli/screenshot-injector.js";
import { loadTemplate } from "../../loaders/template-loader.js";
import { loadProfile } from "../../loaders/profile-loader.js";
import { createDefaultOptions, type GeneratorOptions } from "../../core/models/types.js";

export const generateRoutes = Router();

generateRoutes.post("/generate", async (req, res) => {
  try {
    const body = req.body as Partial<GeneratorOptions>;
    const options: GeneratorOptions = {
      ...createDefaultOptions(),
      ...body,
    };

    // Pre-load profile if specified
    if (options.profile) {
      const profile = await loadProfile(options.profile);
      if (profile) {
        options._loadedProfile = profile;
      }
    }

    // Pre-load template if specified
    if (options.template) {
      const variables: Record<string, string> = {
        GENERIC_MODEL_ID: options.model,
      };
      const template = await loadTemplate(options.template, variables);
      if (template) {
        options._loadedTemplate = template;
      }
    }

    // Generate
    const builderConfig = new BuilderConfigService();
    const generator = new RequestGenerator(builderConfig);
    let result = generator.generate(options);

    // Add screenshots if requested
    if (options.screenshots && options.screenshots > 0) {
      result = {
        ...result,
        json: addScreenshotsToJson(result.json, options.screenshots, options.screenshotSizeKb),
      };
    }

    // Generate summary
    const summary = formatGenerationSummary(options, result.json.length);

    res.json({
      json: result.json,
      endpointType: result.endpointType,
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
});
