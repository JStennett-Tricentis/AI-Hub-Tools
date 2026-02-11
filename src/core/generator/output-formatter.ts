import { ModelRegistry } from "../models/model-registry.js";
import type { GeneratorOptions, ModelConfiguration } from "../models/types.js";

export interface GenerationSummary {
  requestConfig: {
    endpoint: string;
    model: string;
    profile?: string;
    template?: string;
    complexity: string;
    turns?: number;
    tools?: number;
    stream: boolean;
    screenshots?: number;
    toscaCompatible: boolean;
    imagesOnly: boolean;
    strict: boolean;
    hubFormat: boolean;
  };
  modelInfo?: {
    provider: string;
    type: string;
    supportsTools: boolean;
    supportsStreaming: boolean;
    supportsVision: boolean;
    supportsSystemMessage: boolean;
    maxContextTokens: number;
    maxOutputTokens: number;
  };
  validation: {
    isCompatible: boolean;
    warnings: string[];
    predictions: string[];
  };
}

export function formatGenerationSummary(options: GeneratorOptions, jsonSize: number): GenerationSummary {
  const model = ModelRegistry.getModel(options.model);

  const endpoint = options.useEmbeddings
    ? "embeddings"
    : options.useCompletions
      ? "completions"
      : options.endpoint === "invoke"
        ? "invoke"
        : options.endpoint === "invoke-stream"
          ? "invoke-stream"
          : "chat";

  const summary: GenerationSummary = {
    requestConfig: {
      endpoint,
      model: options.model,
      profile: options.profile,
      template: options.template,
      complexity: options.complexity,
      turns: options.turns,
      tools: options.tools,
      stream: options.stream,
      screenshots: options.screenshots,
      toscaCompatible: options.toscaCompatible,
      imagesOnly: options.imagesOnly,
      strict: options.strict,
      hubFormat: options.hubFormat,
    },
    validation: {
      isCompatible: true,
      warnings: [],
      predictions: [],
    },
  };

  if (model) {
    summary.modelInfo = {
      provider: model.provider,
      type: model.type,
      supportsTools: model.capabilities.supportsTools,
      supportsStreaming: model.capabilities.supportsStreaming,
      supportsVision: model.capabilities.supportsVision,
      supportsSystemMessage: model.capabilities.supportsSystemMessage,
      maxContextTokens: model.capabilities.maxContextTokens,
      maxOutputTokens: model.capabilities.maxOutputTokens,
    };

    // Validation predictions
    analyzeCompatibility(options, model, summary);
  } else {
    summary.validation.warnings.push(
      `Model '${options.model}' is not registered. Using default settings.`
    );
  }

  // Size prediction
  const sizeKb = (jsonSize / 1024).toFixed(1);
  summary.validation.predictions.push(`Request size: ${sizeKb} KB`);

  return summary;
}

function analyzeCompatibility(
  options: GeneratorOptions,
  model: ModelConfiguration,
  summary: GenerationSummary
): void {
  const { capabilities } = model;
  const { warnings, predictions } = summary.validation;

  // Tools compatibility
  if (options.tools && options.tools > 0 && !capabilities.supportsTools) {
    warnings.push(`Model '${options.model}' does not support tools. Tools will be removed.`);
    summary.validation.isCompatible = false;
  }

  // Streaming compatibility
  if (options.stream && !capabilities.supportsStreaming) {
    warnings.push(`Model '${options.model}' does not support streaming. Stream will be disabled.`);
  }

  // Vision/images compatibility
  if (options.imagesOnly && !capabilities.supportsVision) {
    warnings.push(`Model '${options.model}' does not support vision. Images-only mode will fail.`);
    summary.validation.isCompatible = false;
  }

  // Max tokens check
  if (options.maxTokens && options.maxTokens > capabilities.maxOutputTokens) {
    warnings.push(
      `Requested max_tokens (${options.maxTokens}) exceeds model limit (${capabilities.maxOutputTokens}). Will be capped.`
    );
  }

  // Predictions
  if (options.tools && options.tools > 0 && capabilities.supportsTools) {
    predictions.push("Request will include tool definitions and tool call exchanges");
  }

  if (options.toscaCompatible) {
    predictions.push("Tool arguments will be double-wrapped for Tosca compatibility");
  }

  if (options.screenshots && options.screenshots > 0) {
    const estimatedSize = options.screenshots * (options.screenshotSizeKb * 1.37); // base64 overhead
    predictions.push(`Screenshots will add ~${(estimatedSize / 1024).toFixed(1)} MB to request`);
  }
}

export function printSummary(summary: GenerationSummary): void {
  console.error("\n=== REQUEST GENERATION SUMMARY ===\n");

  console.error("Request Configuration:");
  console.error(`  Endpoint: ${summary.requestConfig.endpoint}`);
  console.error(`  Model: ${summary.requestConfig.model}`);
  if (summary.requestConfig.profile) console.error(`  Profile: ${summary.requestConfig.profile}`);
  if (summary.requestConfig.template) console.error(`  Template: ${summary.requestConfig.template}`);
  console.error(`  Complexity: ${summary.requestConfig.complexity}`);
  if (summary.requestConfig.turns) console.error(`  Turns: ${summary.requestConfig.turns}`);
  if (summary.requestConfig.tools) console.error(`  Tools: ${summary.requestConfig.tools}`);
  console.error(`  Stream: ${summary.requestConfig.stream}`);

  if (summary.modelInfo) {
    console.error("\nModel Information:");
    console.error(`  Provider: ${summary.modelInfo.provider}`);
    console.error(`  Type: ${summary.modelInfo.type}`);
    console.error(`  Tools: ${summary.modelInfo.supportsTools ? "supported" : "not supported"}`);
    console.error(`  Streaming: ${summary.modelInfo.supportsStreaming ? "supported" : "not supported"}`);
    console.error(`  Vision: ${summary.modelInfo.supportsVision ? "supported" : "not supported"}`);
    console.error(`  Context: ${summary.modelInfo.maxContextTokens.toLocaleString()} tokens`);
    console.error(`  Max Output: ${summary.modelInfo.maxOutputTokens.toLocaleString()} tokens`);
  }

  if (summary.validation.warnings.length > 0) {
    console.error("\nWarnings:");
    for (const warning of summary.validation.warnings) {
      console.error(`  [WARNING] ${warning}`);
    }
  }

  if (summary.validation.predictions.length > 0) {
    console.error("\nPredictions:");
    for (const prediction of summary.validation.predictions) {
      console.error(`  ${prediction}`);
    }
  }

  console.error("");
}
