// Builder Configuration Service - Configures builders based on GeneratorOptions
// Port of BuilderConfigurationService.cs

import { ChatRequestBuilder } from "../builders/chat-request-builder.js";
import { CompletionsBuilder } from "../builders/completions-builder.js";
import { EmbeddingBuilder } from "../builders/embedding-builder.js";
import { BedrockInvokeBuilder } from "../builders/bedrock-invoke-builder.js";
import type {
  GeneratorOptions,
  ProfileConfiguration,
  ChatCompletionsRequest,
} from "../models/types.js";

// Default models
const DEFAULT_CHAT_MODEL = "gpt-4o-2024-05-13";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-ada-002-2";

/**
 * Configures request builders based on GeneratorOptions.
 * Translates CLI/API options into the fluent builder API calls.
 *
 * Port of BuilderConfigurationService.cs (275 lines).
 */
export class BuilderConfigService {
  // ============================================================
  // Public configuration methods
  // ============================================================

  /**
   * Applies common options shared across all builder types to a ChatRequestBuilder.
   * Handles profile/template/complexity first, then applies individual overrides.
   */
  applyCommonOptions(builder: ChatRequestBuilder, options: GeneratorOptions): void {
    // 1. Apply profile if specified
    if (options.profile) {
      const loadedProfile = (options as GeneratorOptionsInternal)._loadedProfile;
      builder.fromProfile(options.profile, loadedProfile);
    }

    // 2. Apply complexity preset (unless profile already set)
    if (!options.profile) {
      this.applyComplexity(builder, options.complexity);
    }

    // 3. Apply individual overrides (these take precedence over profile/complexity)
    if (options.turns !== undefined) {
      builder.turns(options.turns);
    }

    if (options.topic) {
      builder.topic(options.topic);
    }

    if (options.language) {
      builder.language(options.language);
    }

    if (options.domain) {
      builder.domain(options.domain);
    }

    if (options.tools !== undefined && options.tools > 0) {
      builder.withTools(options.tools);
    }

    if (options.model && options.model !== DEFAULT_CHAT_MODEL) {
      builder.model(options.model);
    }

    if (options.temperature !== undefined) {
      builder.temperature(options.temperature);
    }

    if (options.maxTokens !== undefined) {
      builder.maxTokens(options.maxTokens);
    }

    if (options.stream) {
      builder.streaming(true);
    }

    // Metadata: skip for invoke endpoint by default
    builder.skipMetadataFlag(this.shouldSkipMetadata(options));

    // Special mode flags
    if (options.toscaCompatible) {
      builder.toscaCompatibleFlag(true);
    }

    if (options.toolsOnly) {
      builder.toolsOnly();
    }

    if (options.imagesOnly) {
      builder.setImagesOnly(true);
    }

    if (options.strict) {
      builder.setStrict(true);
    }

    if (options.hubFormat) {
      builder.setHubFormat(true);
    }
  }

  /**
   * Configure and return a ChatRequestBuilder based on the provided options.
   */
  configureChatBuilder(options: GeneratorOptions): ChatRequestBuilder {
    const builder = new ChatRequestBuilder();
    this.applyCommonOptions(builder, options);
    return builder;
  }

  /**
   * Configure and return a CompletionsBuilder based on the provided options.
   * Handles prompt or topic/language auto-generation.
   */
  configureCompletionsBuilder(options: GeneratorOptions): CompletionsBuilder {
    const builder = new CompletionsBuilder();

    // Set model
    if (options.model) {
      builder.model(options.model);
    }

    // Set prompt directly if provided, otherwise configure topic/language for auto-generation
    if (options.prompt) {
      builder.prompt(options.prompt);
    } else {
      if (options.topic) {
        builder.topic(options.topic);
      }
      if (options.language) {
        builder.language(options.language);
      }
    }

    // Optional parameters
    if (options.temperature !== undefined) {
      builder.temperature(options.temperature);
    }

    if (options.maxTokens !== undefined) {
      builder.maxTokens(options.maxTokens);
    }

    if (options.stream) {
      builder.streaming(true);
    }

    builder.skipMetadataFlag(this.shouldSkipMetadata(options));

    return builder;
  }

  /**
   * Configure and return an EmbeddingBuilder based on the provided options.
   *
   * If the model is still the default chat model, switches to the default
   * embedding model automatically.
   */
  configureEmbeddingBuilder(options: GeneratorOptions): EmbeddingBuilder {
    const builder = new EmbeddingBuilder();

    // Switch from default chat model to default embedding model
    const effectiveModel =
      options.model === DEFAULT_CHAT_MODEL ? DEFAULT_EMBEDDING_MODEL : options.model;
    builder.model(effectiveModel);

    // Apply complexity preset for text count
    this.applyEmbeddingComplexity(builder, options.complexity);

    // Input text(s) - comma-separated values become an array
    if (options.input) {
      const inputs = options.input.split(",").map((s) => s.trim()).filter(Boolean);
      builder.input(inputs);
    }

    // Override text count
    if (options.textCount !== undefined) {
      builder.textCount(options.textCount);
    }

    // Topic and domain for auto-generation
    if (options.topic) {
      builder.topic(options.topic);
    }

    if (options.domain) {
      builder.domain(options.domain);
    }

    // Encoding format
    if (options.encodingFormat) {
      builder.encodingFormat(options.encodingFormat);
    }

    // Dimensions
    if (options.dimensions !== undefined) {
      builder.dimensions(options.dimensions);
    }

    builder.skipMetadataFlag(this.shouldSkipMetadata(options));

    return builder;
  }

  /**
   * Configure and return a BedrockInvokeBuilder based on the provided options.
   * Uses a ChatRequestBuilder internally to build the chat request, then converts
   * it to Bedrock Anthropic format.
   */
  configureBedrockInvokeBuilder(options: GeneratorOptions): BedrockInvokeBuilder {
    const builder = new BedrockInvokeBuilder();

    builder.useRequestBuilder((chatBuilder) => {
      // Apply common options but always skip metadata for invoke
      const invokeOptions = { ...options };
      invokeOptions.endpoint = "invoke";
      this.applyCommonOptions(chatBuilder, invokeOptions);
    });

    return builder;
  }

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Returns true if metadata should be skipped.
   * Always skip metadata for "invoke" endpoint.
   */
  private shouldSkipMetadata(options: GeneratorOptions): boolean {
    if (options.endpoint === "invoke" || options.endpoint === "invoke-stream") {
      return true;
    }
    return true; // Default: skip metadata (user can override via profile)
  }

  /**
   * Apply complexity preset to a ChatRequestBuilder.
   */
  private applyComplexity(builder: ChatRequestBuilder, complexity: string): void {
    switch (complexity.toLowerCase()) {
      case "simple":
        builder.simple();
        break;
      case "complex":
        builder.complex();
        break;
      case "stress":
        builder.stressTest();
        break;
      case "medium":
      default:
        builder.medium();
        break;
    }
  }

  /**
   * Apply complexity preset to an EmbeddingBuilder for controlling text count.
   */
  private applyEmbeddingComplexity(builder: EmbeddingBuilder, complexity: string): void {
    switch (complexity.toLowerCase()) {
      case "simple":
        builder.simple();
        break;
      case "complex":
        builder.complex();
        break;
      case "stress":
        builder.stressTest();
        break;
      case "medium":
      default:
        builder.medium();
        break;
    }
  }
}

/**
 * Internal extended options type that includes pre-loaded profile and template.
 * These fields are set by the CLI/API layer before calling into the generator.
 */
interface GeneratorOptionsInternal extends GeneratorOptions {
  _loadedProfile?: ProfileConfiguration;
  _loadedTemplate?: ChatCompletionsRequest;
}
