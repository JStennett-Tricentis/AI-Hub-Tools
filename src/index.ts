#!/usr/bin/env node

import { createProgram, parseOptions } from "./cli/argument-parser.js";
import { listModels, showModelInfo, listEndpoints } from "./cli/cli-handler.js";
import { RequestGenerator } from "./core/generator/request-generator.js";
import { BuilderConfigService } from "./core/generator/builder-config.js";
import { FileOutputService } from "./cli/file-output.js";
import { copyToClipboard } from "./cli/clipboard.js";
import { addScreenshotsToJson } from "./cli/screenshot-injector.js";
import { loadTemplate } from "./loaders/template-loader.js";
import { loadProfile } from "./loaders/profile-loader.js";

async function main(): Promise<number> {
  const program = createProgram();
  program.parse(process.argv);

  const opts = program.opts();

  // Handle info commands
  if (opts.listModels) {
    listModels();
    return 0;
  }

  if (opts.modelInfo) {
    showModelInfo(opts.modelInfo);
    return 0;
  }

  if (opts.listEndpoints) {
    listEndpoints();
    return 0;
  }

  try {
    const options = parseOptions(program);

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

    // Generate request
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

    // Handle output
    const fileOutput = new FileOutputService();

    if (options.output) {
      const savedPath = await fileOutput.saveToFile(
        result.json,
        options.output,
        result.endpointType,
        options.noTimestamp
      );
      process.stderr.write(`Saved to: ${savedPath}\n`);
    }

    if (options.copy) {
      await copyToClipboard(result.json);
      process.stderr.write("Copied to clipboard\n");
    }

    // If no file output and no copy, print to stdout
    if (!options.output && !options.copy) {
      process.stdout.write(result.json + "\n");
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    return 1;
  }
}

main().then((code) => {
  process.exitCode = code;
});
