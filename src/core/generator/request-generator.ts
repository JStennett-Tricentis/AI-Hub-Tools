// Request Generator - Pure logic orchestrator for request generation
// Port of RequestGeneratorService.cs (164 lines)

import type {
  GeneratorOptions,
  GeneratorResult,
  ChatCompletionsRequest,
  ProfileConfiguration,
} from "../models/types.js";
import { BuilderConfigService } from "./builder-config.js";
import { toJson } from "../utils.js";

/**
 * Internal extended options type that includes pre-loaded profile and template.
 * These fields are set by the CLI/API layer before calling into the generator.
 */
interface GeneratorOptionsInternal extends GeneratorOptions {
  _loadedProfile?: ProfileConfiguration;
  _loadedTemplate?: ChatCompletionsRequest;
}

/**
 * Pure logic orchestrator for request generation. Contains no I/O operations;
 * all file loading (templates, profiles) must happen before calling generate().
 *
 * Port of RequestGeneratorService.cs (164 lines).
 */
export class RequestGenerator {
  private readonly builderConfig: BuilderConfigService;

  constructor(builderConfig: BuilderConfigService) {
    this.builderConfig = builderConfig;
  }

  /**
   * Generate a request payload based on the provided options.
   *
   * Generation priority:
   * 1. If template is set -> generate from pre-loaded template
   * 2. If useEmbeddings -> generate embedding request
   * 3. If useCompletions -> generate completions request
   * 4. If endpoint is "invoke" -> generate Bedrock invoke request
   * 5. Default -> generate chat completions request
   */
  generate(options: GeneratorOptions): GeneratorResult {
    const internal = options as GeneratorOptionsInternal;

    // 1. Template-based generation
    if (options.template && internal._loadedTemplate) {
      return this.generateFromTemplate(options, internal._loadedTemplate);
    }

    // 2. Embedding request
    if (options.useEmbeddings) {
      return this.generateEmbeddingRequest(options);
    }

    // 3. Completions request
    if (options.useCompletions) {
      return this.generateCompletionsRequest(options);
    }

    // 4. Bedrock invoke request (both streaming and non-streaming)
    if (options.endpoint === "invoke" || options.endpoint === "invoke-stream") {
      return this.generateBedrockInvokeRequest(options);
    }

    // 5. Default: chat completions request
    return this.generateChatRequest(options);
  }

  // ============================================================
  // Private generation methods
  // ============================================================

  /**
   * Generate from a pre-loaded template. Applies model override if specified,
   * then serializes the template directly.
   */
  private generateFromTemplate(
    options: GeneratorOptions,
    template: ChatCompletionsRequest,
  ): GeneratorResult {
    // Apply model override if the user specified a different model
    if (options.model && options.model !== "gpt-4o-2024-05-13") {
      template.model = options.model;
    }

    // Apply optional overrides
    if (options.temperature !== undefined) {
      template.temperature = options.temperature;
    }

    if (options.maxTokens !== undefined) {
      template.max_tokens = options.maxTokens;
    }

    if (options.stream) {
      template.stream = true;
    }

    const json = toJson(template, !options.compact);

    return {
      json,
      endpointType: "chat",
    };
  }

  /**
   * Generate a chat completions request using the ChatRequestBuilder.
   */
  private generateChatRequest(options: GeneratorOptions): GeneratorResult {
    const builder = this.builderConfig.configureChatBuilder(options);
    builder.generate();
    const json = builder.toJson(!options.compact);

    return {
      json,
      endpointType: "chat",
    };
  }

  /**
   * Generate a legacy completions request using the CompletionsBuilder.
   */
  private generateCompletionsRequest(options: GeneratorOptions): GeneratorResult {
    const builder = this.builderConfig.configureCompletionsBuilder(options);
    builder.generate();
    const json = builder.toJson(!options.compact);

    return {
      json,
      endpointType: "completions",
    };
  }

  /**
   * Generate an embedding request using the EmbeddingBuilder.
   */
  private generateEmbeddingRequest(options: GeneratorOptions): GeneratorResult {
    const builder = this.builderConfig.configureEmbeddingBuilder(options);
    builder.generate();
    const json = builder.toJson(!options.compact);

    return {
      json,
      endpointType: "embeddings",
    };
  }

  /**
   * Generate a Bedrock invoke request using the BedrockInvokeBuilder.
   * The builder internally uses a ChatRequestBuilder for the chat structure,
   * then converts to Bedrock Anthropic format.
   */
  private generateBedrockInvokeRequest(options: GeneratorOptions): GeneratorResult {
    const builder = this.builderConfig.configureBedrockInvokeBuilder(options);
    builder.generate();
    const json = builder.toJson(!options.compact);

    return {
      json,
      endpointType: options.endpoint === "invoke-stream" ? "invoke-stream" : "invoke",
    };
  }
}
