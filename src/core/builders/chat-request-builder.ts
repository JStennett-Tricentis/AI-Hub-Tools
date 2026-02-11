// Chat Completions Request Builder - Fluent builder for OpenAI-compatible chat requests
// Port of RequestBuilder.cs

import { randomUUID } from "crypto";
import type {
  ChatCompletionsRequest,
  ChatMessage,
  ToolCall,
  ProfileConfiguration,
  ProfileDefaults,
} from "../models/types.js";
import {
  getRandomTopic,
  getRandomLanguage,
  getRandomDomain,
} from "../data/data-sources.js";
import {
  generateSystemPrompt,
  generateInitialUserMessage,
  generateFollowUpMessage,
  generateAssistantResponse,
} from "../data/content-generator.js";
import {
  getRandomTools,
  getRandomToolNames,
} from "../data/tool-definitions.js";
import { generateToolArguments } from "../data/template-manager.js";
import { ModelRegistry } from "../models/model-registry.js";
import { toJson } from "../utils.js";

const GENERATOR_VERSION = "1.0.0";

/**
 * Hardcoded profile defaults used as fallback when no ProfileConfiguration is provided.
 */
const BUILTIN_PROFILES: Record<string, ProfileDefaults> = {
  simple: {
    turns: 1,
    includeTools: false,
    includeSystemPrompt: false,
  },
  medium: {
    turns: 3,
    includeTools: false,
    includeSystemPrompt: true,
    temperature: 0.7,
  },
  complex: {
    turns: 6,
    includeTools: true,
    toolCount: 3,
    includeSystemPrompt: true,
    temperature: 0.8,
  },
  stress: {
    turns: 20,
    includeTools: true,
    toolCount: 5,
    includeSystemPrompt: true,
    temperature: 0.9,
  },
  "tools-heavy": {
    turns: 4,
    includeTools: true,
    toolCount: 5,
    includeSystemPrompt: true,
    parallelToolCalls: true,
  },
  streaming: {
    turns: 3,
    includeTools: false,
    includeSystemPrompt: true,
    stream: true,
  },
};

/**
 * Fluent builder for constructing OpenAI-compatible chat completions requests.
 *
 * Supports complexity presets (simple, medium, complex, stress), profile-based
 * configuration, and fine-grained control over every aspect of the generated
 * request payload.
 */
export class ChatRequestBuilder {
  private request: ChatCompletionsRequest;
  private _topic?: string;
  private _language?: string;
  private _domain?: string;
  private _turnCount = 3;
  private _includeTools = false;
  private _toolCount = 3;
  private _includeSystemPrompt = true;
  private _skipMetadata = true;
  private _toscaCompatible = false;
  private _imagesOnly = false;
  private _strict = false;
  private _hubFormat = false;

  constructor() {
    this.request = {
      model: "gpt-4o-2024-05-13",
      messages: [],
    };
  }

  // ============================================================
  // Complexity presets
  // ============================================================

  /**
   * Configure for a simple request: single turn, no tools, no system prompt.
   */
  simple(): this {
    this._turnCount = 1;
    this._includeTools = false;
    this._includeSystemPrompt = false;
    return this;
  }

  /**
   * Configure for a medium complexity request with optional turn count.
   */
  medium(turns = 3): this {
    this._turnCount = turns;
    this._includeTools = false;
    this._includeSystemPrompt = true;
    return this;
  }

  /**
   * Configure for a complex request with tools and multiple turns.
   */
  complex(turns = 6): this {
    this._turnCount = turns;
    this._includeTools = true;
    this._toolCount = 3;
    this._includeSystemPrompt = true;
    return this;
  }

  /**
   * Configure for a stress test request with many turns and tools.
   */
  stressTest(turns = 20): this {
    this._turnCount = turns;
    this._includeTools = true;
    this._toolCount = 5;
    this._includeSystemPrompt = true;
    return this;
  }

  // ============================================================
  // Configuration methods
  // ============================================================

  /**
   * Load a named profile with optional ProfileConfiguration.
   * If no configuration is provided, falls back to built-in profile defaults.
   */
  fromProfile(name: string, profile?: ProfileConfiguration): this {
    if (profile?.defaults) {
      this.applyProfileDefaults(profile.defaults);
    } else if (BUILTIN_PROFILES[name]) {
      this.applyProfileDefaults(BUILTIN_PROFILES[name]);
    }

    return this;
  }

  /**
   * Set the number of conversation turns.
   */
  turns(n: number): this {
    this._turnCount = n;
    return this;
  }

  /**
   * Set the conversation topic for content generation.
   */
  topic(t: string): this {
    this._topic = t;
    return this;
  }

  /**
   * Set the language for content generation.
   */
  language(l: string): this {
    this._language = l;
    return this;
  }

  /**
   * Set the domain context for content generation.
   */
  domain(d: string): this {
    this._domain = d;
    return this;
  }

  /**
   * Enable tool usage with the specified number of tool definitions.
   */
  withTools(count = 3): this {
    this._includeTools = true;
    this._toolCount = count;
    return this;
  }

  /**
   * Set the model identifier.
   */
  model(m: string): this {
    this.request.model = m;
    return this;
  }

  /**
   * Set the temperature parameter.
   */
  temperature(t: number): this {
    this.request.temperature = t;
    return this;
  }

  /**
   * Set the max_tokens parameter.
   */
  maxTokens(n: number): this {
    this.request.max_tokens = n;
    return this;
  }

  /**
   * Enable or disable streaming.
   */
  streaming(enabled = true): this {
    this.request.stream = enabled;
    return this;
  }

  /**
   * Control whether metadata is skipped in the output.
   */
  skipMetadataFlag(skip = true): this {
    this._skipMetadata = skip;
    return this;
  }

  /**
   * Enable Tosca-compatible output mode.
   */
  toscaCompatibleFlag(c = true): this {
    this._toscaCompatible = c;
    return this;
  }

  /**
   * Configure for tools-only mode (tools with minimal conversation).
   */
  toolsOnly(): this {
    this._includeTools = true;
    this._turnCount = 1;
    this._includeSystemPrompt = true;
    return this;
  }

  /**
   * Enable images-only mode.
   */
  setImagesOnly(v = true): this {
    this._imagesOnly = v;
    return this;
  }

  /**
   * Enable strict mode.
   */
  setStrict(v = true): this {
    this._strict = v;
    return this;
  }

  /**
   * Enable hub format mode.
   */
  setHubFormat(v = true): this {
    this._hubFormat = v;
    return this;
  }

  // ============================================================
  // Generation
  // ============================================================

  /**
   * Generate the complete chat completions request.
   */
  generate(): ChatCompletionsRequest {
    this.generateFromBuilder();
    this.validateRequest();

    if (!this._skipMetadata) {
      this.addMetadata();
    }

    return this.request;
  }

  /**
   * Serialize the generated request to JSON.
   */
  toJson(indented = true): string {
    return toJson(this.request, indented);
  }

  // ============================================================
  // Private methods
  // ============================================================

  /**
   * Build the messages array from builder configuration.
   */
  private generateFromBuilder(): void {
    const topic = this._topic ?? getRandomTopic();
    const language = this._language ?? getRandomLanguage();
    const domain = this._domain ?? getRandomDomain();
    const messages: ChatMessage[] = [];

    // Add system prompt if enabled
    if (this._includeSystemPrompt) {
      messages.push({
        role: "system",
        content: generateSystemPrompt(topic, domain),
      });
    }

    // Add tool definitions if enabled (and not already set by template)
    if (this._includeTools && !this.request.tools) {
      this.request.tools = getRandomTools(this._toolCount);
      this.request.tool_choice = "auto";
    }

    // Generate conversation turns
    for (let i = 0; i < this._turnCount; i++) {
      // User message
      messages.push({
        role: "user",
        content: i === 0
          ? generateInitialUserMessage(topic, language, domain)
          : generateFollowUpMessage(topic),
      });

      // Assistant response (skip for the last turn - that is what the model generates)
      if (i < this._turnCount - 1) {
        // Every other assistant turn includes tool calls if tools are enabled
        if (this._includeTools && i % 2 === 0) {
          const toolCalls = this.generateToolCalls(language);
          messages.push({
            role: "assistant",
            content: null,
            tool_calls: toolCalls,
          });

          // Add tool response messages for each tool call
          for (const toolCall of toolCalls) {
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                result: `Response from ${toolCall.function.name}`,
                status: "success",
              }),
            });
          }
        } else {
          messages.push({
            role: "assistant",
            content: generateAssistantResponse(topic, language),
          });
        }
      }
    }

    this.request.messages = messages;
  }

  /**
   * Generate an array of tool calls with random tool names and generated arguments.
   */
  private generateToolCalls(language: string): ToolCall[] {
    const callCount = Math.min(
      Math.floor(Math.random() * 2) + 1,
      this._toolCount
    );
    const toolCalls: ToolCall[] = [];

    for (let i = 0; i < callCount; i++) {
      const toolName = this.request.tools?.[i]?.function.name ?? getRandomToolNames(1)[0];
      toolCalls.push({
        id: `call_${randomUUID().replace(/-/g, "")}`,
        type: "function",
        function: {
          name: toolName,
          arguments: generateToolArguments(toolName, language, this._toscaCompatible),
        },
      });
    }

    return toolCalls;
  }

  /**
   * Validate the request against model capabilities from ModelRegistry.
   * Auto-adjusts incompatible settings.
   */
  private validateRequest(): void {
    const modelConfig = ModelRegistry.getModel(this.request.model);
    if (!modelConfig) {
      return;
    }

    const capabilities = modelConfig.capabilities;

    // Remove tools if model does not support them
    if (!capabilities.supportsTools && this.request.tools) {
      this.request.tools = undefined;
      this.request.tool_choice = undefined;
      this.request.parallel_tool_calls = undefined;
    }

    // Remove streaming if model does not support it
    if (!capabilities.supportsStreaming && this.request.stream) {
      this.request.stream = undefined;
    }

    // Remove system message if model does not support it
    if (!capabilities.supportsSystemMessage && this.request.messages.length > 0) {
      this.request.messages = this.request.messages.filter(
        (m) => m.role !== "system"
      );
    }

    // Remove temperature if model does not support it
    if (!capabilities.supportsTemperature && this.request.temperature !== undefined) {
      this.request.temperature = undefined;
    }

    // Remove parallel_tool_calls if model does not support it
    if (!capabilities.supportsParallelToolCalls && this.request.parallel_tool_calls !== undefined) {
      this.request.parallel_tool_calls = undefined;
    }

    // Remove penalties if model does not support them
    if (!capabilities.supportsPenalties) {
      this.request.presence_penalty = undefined;
      this.request.frequency_penalty = undefined;
    }

    // Remove logprobs if model does not support them
    if (!capabilities.supportsLogprobs) {
      this.request.logprobs = undefined;
      this.request.top_logprobs = undefined;
    }

    // Clamp max_tokens to model maximum
    if (
      this.request.max_tokens !== undefined &&
      this.request.max_tokens > capabilities.maxOutputTokens
    ) {
      this.request.max_tokens = capabilities.maxOutputTokens;
    }
  }

  /**
   * Add generation metadata to the request.
   */
  private addMetadata(): void {
    this.request._metadata = {
      generated_at: new Date().toISOString(),
      generator_version: GENERATOR_VERSION,
      turn_count: this._turnCount,
      has_tools: this._includeTools,
      model: this.request.model,
      images_only: this._imagesOnly,
      strict: this._strict,
      hub_format: this._hubFormat,
    };
  }

  /**
   * Apply profile defaults to builder configuration.
   */
  private applyProfileDefaults(defaults: ProfileDefaults): void {
    if (defaults.turns !== undefined) {
      this._turnCount = defaults.turns;
    }
    if (defaults.includeTools !== undefined) {
      this._includeTools = defaults.includeTools;
    }
    if (defaults.toolCount !== undefined) {
      this._toolCount = defaults.toolCount;
    }
    if (defaults.includeSystemPrompt !== undefined) {
      this._includeSystemPrompt = defaults.includeSystemPrompt;
    }
    if (defaults.topic !== undefined) {
      this._topic = defaults.topic;
    }
    if (defaults.temperature !== undefined) {
      this.request.temperature = defaults.temperature;
    }
    if (defaults.maxTokens !== undefined) {
      this.request.max_tokens = defaults.maxTokens;
    }
    if (defaults.parallelToolCalls !== undefined) {
      this.request.parallel_tool_calls = defaults.parallelToolCalls;
    }
    if (defaults.stream !== undefined) {
      this.request.stream = defaults.stream;
    }
  }
}
