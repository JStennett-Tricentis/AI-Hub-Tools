import {
  ChatCompletionsRequest,
  EndpointConfiguration,
  EndpointType,
  ModelCapabilities,
  ModelConfiguration,
  ModelType,
} from "./types.js";

// Path templates for different endpoint types
const CHAT_COMPLETIONS_PATH =
  "/api/v1/hub-service/openai/deployments/{model}/chat/completions";
const COMPLETIONS_PATH =
  "/api/v1/hub-service/openai/deployments/{model}/completions";
const EMBEDDINGS_PATH =
  "/api/v1/hub-service/openai/deployments/{model}/embeddings";
const MODEL_INVOKE_PATH = "/api/v1/hub-service/model/{model}/invoke";
const MODEL_INVOKE_STREAM_PATH = "/api/v1/hub-service/model/{model}/invoke-with-response-stream";

// ============================================================
// Capability Presets
// ============================================================

function allTrueCapabilities(
  maxContextTokens: number,
  maxOutputTokens: number,
): ModelCapabilities {
  return {
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    supportsSystemMessage: true,
    supportsParallelToolCalls: true,
    supportsTemperature: true,
    supportsTopP: true,
    supportsPenalties: true,
    supportsLogprobs: true,
    maxContextTokens,
    maxOutputTokens,
  };
}

function allFalseCapabilities(
  maxContextTokens: number,
  maxOutputTokens: number,
): ModelCapabilities {
  return {
    supportsTools: false,
    supportsStreaming: false,
    supportsVision: false,
    supportsSystemMessage: false,
    supportsParallelToolCalls: false,
    supportsTemperature: true,
    supportsTopP: true,
    supportsPenalties: false,
    supportsLogprobs: false,
    maxContextTokens,
    maxOutputTokens,
  };
}

function anthropicCapabilities(
  maxContextTokens: number,
  maxOutputTokens: number,
): ModelCapabilities {
  return {
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    supportsSystemMessage: true,
    supportsParallelToolCalls: false,
    supportsTemperature: true,
    supportsTopP: true,
    supportsPenalties: false,
    supportsLogprobs: false,
    maxContextTokens,
    maxOutputTokens,
  };
}

// ============================================================
// Endpoint Presets
// ============================================================

const openAIChatEndpoint: EndpointConfiguration = {
  type: EndpointType.OpenAICompatible,
  pathTemplate: CHAT_COMPLETIONS_PATH,
};

const modelInvokeEndpoint: EndpointConfiguration = {
  type: EndpointType.ModelInvoke,
  pathTemplate: MODEL_INVOKE_PATH,
};

const modelInvokeStreamEndpoint: EndpointConfiguration = {
  type: EndpointType.ModelInvoke,
  pathTemplate: MODEL_INVOKE_STREAM_PATH,
};

const completionsEndpoint: EndpointConfiguration = {
  type: EndpointType.OpenAICompatible,
  pathTemplate: COMPLETIONS_PATH,
};

const embeddingsEndpoint: EndpointConfiguration = {
  type: EndpointType.OpenAICompatible,
  pathTemplate: EMBEDDINGS_PATH,
};

// ============================================================
// Model Definitions
// ============================================================

function createModels(): Map<string, ModelConfiguration> {
  const models = new Map<string, ModelConfiguration>();

  const register = (config: ModelConfiguration): void => {
    models.set(config.modelId, config);
  };

  // ----------------------------------------------------------
  // Chat Models - Azure OpenAI
  // ----------------------------------------------------------

  register({
    modelId: "gpt-4.1-mini-2025-04-14",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: true,
      supportsSystemMessage: true,
      supportsParallelToolCalls: true,
      supportsTemperature: true,
      supportsTopP: true,
      supportsPenalties: true,
      supportsLogprobs: true,
      maxContextTokens: 128_000,
      maxOutputTokens: 16_384,
    },
    endpoints: openAIChatEndpoint,
  });

  register({
    modelId: "gpt-4-1106-Preview",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsSystemMessage: true,
      supportsParallelToolCalls: true,
      supportsTemperature: true,
      supportsTopP: true,
      supportsPenalties: true,
      supportsLogprobs: true,
      maxContextTokens: 128_000,
      maxOutputTokens: 4_096,
    },
    endpoints: openAIChatEndpoint,
  });

  register({
    modelId: "gpt-4o-2024-05-13",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: true,
      supportsSystemMessage: true,
      supportsParallelToolCalls: true,
      supportsTemperature: true,
      supportsTopP: true,
      supportsPenalties: true,
      supportsLogprobs: true,
      maxContextTokens: 128_000,
      maxOutputTokens: 4_096,
    },
    endpoints: openAIChatEndpoint,
  });

  register({
    modelId: "gpt-4o-2024-08-06",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: allTrueCapabilities(128_000, 16_384),
    endpoints: openAIChatEndpoint,
  });

  register({
    modelId: "gpt-4o-2024-08-06-autonomous-testing",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: allTrueCapabilities(128_000, 16_384),
    endpoints: openAIChatEndpoint,
  });

  register({
    modelId: "gpt-4o-mini-2024-07-18",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: allTrueCapabilities(128_000, 16_384),
    endpoints: openAIChatEndpoint,
  });

  register({
    modelId: "gpt-5-2025-08-07",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: allTrueCapabilities(128_000, 16_384),
    endpoints: openAIChatEndpoint,
  });

  register({
    modelId: "gpt-5-mini-2025-08-07",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: allTrueCapabilities(128_000, 16_384),
    endpoints: openAIChatEndpoint,
  });

  register({
    modelId: "gpt-4.1-2025-04-14",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: allTrueCapabilities(128_000, 16_384),
    endpoints: openAIChatEndpoint,
  });

  // ----------------------------------------------------------
  // Chat Models - Custom Platform (OpenAICompatible)
  // ----------------------------------------------------------

  register({
    modelId: "custom-gpt-4.1-mini",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: allTrueCapabilities(128_000, 16_384),
    endpoints: openAIChatEndpoint,
  });

  register({
    modelId: "o4-mini",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: allTrueCapabilities(128_000, 16_384),
    endpoints: openAIChatEndpoint,
  });

  register({
    modelId: "o1",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: {
      supportsTools: false,
      supportsStreaming: false,
      supportsVision: true,
      supportsSystemMessage: false,
      supportsParallelToolCalls: false,
      supportsTemperature: true,
      supportsTopP: true,
      supportsPenalties: false,
      supportsLogprobs: false,
      maxContextTokens: 200_000,
      maxOutputTokens: 100_000,
    },
    endpoints: openAIChatEndpoint,
  });

  // ----------------------------------------------------------
  // Chat Models - SAP Platform
  // ----------------------------------------------------------

  register({
    modelId: "sap-gpt-4o-mini-2024-07-18",
    provider: "OpenAI",
    type: ModelType.Chat,
    capabilities: allTrueCapabilities(128_000, 16_384),
    endpoints: openAIChatEndpoint,
  });

  register({
    modelId: "sap-claude-3-7-sonnet-20250219",
    provider: "Anthropic",
    type: ModelType.Chat,
    capabilities: anthropicCapabilities(200_000, 8_192),
    endpoints: modelInvokeEndpoint,
  });

  // ----------------------------------------------------------
  // Chat Models - Anthropic
  // ----------------------------------------------------------

  register({
    modelId: "custom-us.anthropic.claude-3-7-sonnet-20250219-v1:0",
    provider: "Anthropic",
    type: ModelType.Chat,
    capabilities: anthropicCapabilities(200_000, 8_192),
    endpoints: modelInvokeEndpoint,
  });

  register({
    modelId: "us.anthropic.claude-sonnet-4-20250514-v1:0",
    provider: "Anthropic",
    type: ModelType.Chat,
    capabilities: anthropicCapabilities(200_000, 8_192),
    endpoints: modelInvokeEndpoint,
  });

  register({
    modelId: "eu.anthropic.claude-sonnet-4-20250514-v1:0",
    provider: "Anthropic",
    type: ModelType.Chat,
    capabilities: anthropicCapabilities(200_000, 8_192),
    endpoints: modelInvokeEndpoint,
  });

  // ----------------------------------------------------------
  // Completion Models
  // ----------------------------------------------------------

  register({
    modelId: "gpt-35-turbo-0613",
    provider: "OpenAI",
    type: ModelType.Completion,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsSystemMessage: true,
      supportsParallelToolCalls: true,
      supportsTemperature: true,
      supportsTopP: true,
      supportsPenalties: true,
      supportsLogprobs: false,
      maxContextTokens: 4_096,
      maxOutputTokens: 4_096,
    },
    endpoints: completionsEndpoint,
  });

  register({
    modelId: "gpt-35-turbo-0301",
    provider: "OpenAI",
    type: ModelType.Completion,
    capabilities: {
      supportsTools: false,
      supportsStreaming: true,
      supportsVision: false,
      supportsSystemMessage: true,
      supportsParallelToolCalls: false,
      supportsTemperature: true,
      supportsTopP: true,
      supportsPenalties: true,
      supportsLogprobs: false,
      maxContextTokens: 4_096,
      maxOutputTokens: 4_096,
    },
    endpoints: completionsEndpoint,
  });

  register({
    modelId: "gpt-35-turbo-0125",
    provider: "OpenAI",
    type: ModelType.Completion,
    capabilities: {
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: false,
      supportsSystemMessage: true,
      supportsParallelToolCalls: true,
      supportsTemperature: true,
      supportsTopP: true,
      supportsPenalties: true,
      supportsLogprobs: false,
      maxContextTokens: 16_385,
      maxOutputTokens: 4_096,
    },
    endpoints: completionsEndpoint,
  });

  // ----------------------------------------------------------
  // Embedding Models
  // ----------------------------------------------------------

  register({
    modelId: "text-embedding-ada-002-2",
    provider: "OpenAI",
    type: ModelType.Embedding,
    capabilities: allFalseCapabilities(8_191, 0),
    endpoints: embeddingsEndpoint,
  });

  register({
    modelId: "text-embedding-3-small",
    provider: "OpenAI",
    type: ModelType.Embedding,
    capabilities: allFalseCapabilities(8_191, 0),
    endpoints: embeddingsEndpoint,
  });

  return models;
}

// ============================================================
// ModelRegistry
// ============================================================

/**
 * Static registry of all supported AI Hub models and their configurations.
 * Provides lookup, filtering, validation, and endpoint resolution for the
 * 21 models currently deployed across Azure OpenAI, Custom, SAP, and
 * Anthropic platforms.
 */
export class ModelRegistry {
  private static readonly registry: Map<string, ModelConfiguration> =
    createModels();

  private constructor() {
    // Prevent instantiation - use static methods only
  }

  /**
   * Retrieve a model configuration by its unique model ID.
   * Returns undefined if the model is not registered.
   */
  static getModel(modelId: string): ModelConfiguration | undefined {
    return ModelRegistry.registry.get(modelId);
  }

  /**
   * Check whether a model ID exists in the registry.
   */
  static isModelRegistered(modelId: string): boolean {
    return ModelRegistry.registry.has(modelId);
  }

  /**
   * Return all registered chat models.
   */
  static getChatModels(): ModelConfiguration[] {
    return Array.from(ModelRegistry.registry.values()).filter(
      (m) => m.type === ModelType.Chat,
    );
  }

  /**
   * Return all registered completion models.
   */
  static getCompletionModels(): ModelConfiguration[] {
    return Array.from(ModelRegistry.registry.values()).filter(
      (m) => m.type === ModelType.Completion,
    );
  }

  /**
   * Return all registered embedding models.
   */
  static getEmbeddingModels(): ModelConfiguration[] {
    return Array.from(ModelRegistry.registry.values()).filter(
      (m) => m.type === ModelType.Embedding,
    );
  }

  /**
   * Return all models that support tool/function calling.
   */
  static getModelsWithToolSupport(): ModelConfiguration[] {
    return Array.from(ModelRegistry.registry.values()).filter(
      (m) => m.capabilities.supportsTools,
    );
  }

  /**
   * Resolve the concrete endpoint path for a given model ID by replacing
   * the `{model}` placeholder in the path template.
   * Throws if the model is not registered.
   */
  static getEndpointPath(modelId: string): string {
    const model = ModelRegistry.registry.get(modelId);
    if (!model) {
      throw new Error(
        `Model "${modelId}" is not registered in the ModelRegistry.`,
      );
    }
    return model.endpoints.pathTemplate.replace("{model}", modelId);
  }

  /**
   * Validate a ChatCompletionsRequest against the capabilities of the
   * target model. Returns an object with `isValid` (always true -- the
   * request is never outright rejected) and a list of `warnings` for any
   * capability mismatches that may cause the upstream provider to error.
   */
  static validateRequest(
    modelId: string,
    request: ChatCompletionsRequest,
  ): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    const model = ModelRegistry.registry.get(modelId);

    if (!model) {
      warnings.push(
        `Model "${modelId}" is not registered. Validation skipped.`,
      );
      return { isValid: true, warnings };
    }

    const caps = model.capabilities;

    // Tool usage
    if (request.tools && request.tools.length > 0 && !caps.supportsTools) {
      warnings.push(
        `Model "${modelId}" does not support tools, but the request includes ${request.tools.length} tool definition(s).`,
      );
    }

    // Streaming
    if (request.stream === true && !caps.supportsStreaming) {
      warnings.push(
        `Model "${modelId}" does not support streaming, but stream=true was requested.`,
      );
    }

    // Parallel tool calls
    if (
      request.parallel_tool_calls === true &&
      !caps.supportsParallelToolCalls
    ) {
      warnings.push(
        `Model "${modelId}" does not support parallel tool calls, but parallel_tool_calls=true was requested.`,
      );
    }

    // System message
    if (!caps.supportsSystemMessage) {
      const hasSystem = request.messages?.some((m) => m.role === "system");
      if (hasSystem) {
        warnings.push(
          `Model "${modelId}" does not support system messages, but the request includes a system message.`,
        );
      }
    }

    // Vision content
    if (!caps.supportsVision) {
      const hasVision = request.messages?.some((m) => {
        if (Array.isArray(m.content)) {
          return m.content.some((part) => part.type === "image_url");
        }
        return false;
      });
      if (hasVision) {
        warnings.push(
          `Model "${modelId}" does not support vision, but the request includes image content.`,
        );
      }
    }

    // Penalties
    if (!caps.supportsPenalties) {
      if (
        (request.presence_penalty !== undefined &&
          request.presence_penalty !== 0) ||
        (request.frequency_penalty !== undefined &&
          request.frequency_penalty !== 0)
      ) {
        warnings.push(
          `Model "${modelId}" does not support penalties, but presence_penalty or frequency_penalty was set.`,
        );
      }
    }

    // Logprobs
    if (!caps.supportsLogprobs) {
      if (request.logprobs === true || request.top_logprobs !== undefined) {
        warnings.push(
          `Model "${modelId}" does not support logprobs, but logprobs or top_logprobs was requested.`,
        );
      }
    }

    // Max tokens exceeding model limit
    if (
      request.max_tokens !== undefined &&
      caps.maxOutputTokens > 0 &&
      request.max_tokens > caps.maxOutputTokens
    ) {
      warnings.push(
        `Requested max_tokens (${request.max_tokens}) exceeds model "${modelId}" limit of ${caps.maxOutputTokens}.`,
      );
    }

    return { isValid: true, warnings };
  }

  /**
   * Return a sorted array of all registered model IDs.
   */
  static getAllModelIds(): string[] {
    return Array.from(ModelRegistry.registry.keys()).sort();
  }
}
