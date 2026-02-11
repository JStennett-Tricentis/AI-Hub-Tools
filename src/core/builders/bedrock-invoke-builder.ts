// Bedrock Invoke Request Builder - Converts chat format to AWS Bedrock Anthropic format
// Port of BedrockInvokeBuilder.cs

import type {
  BedrockInvokeRequest,
  BedrockTool,
  ChatCompletionsRequest,
  ChatMessage,
} from "../models/types.js";
import { ChatRequestBuilder } from "./chat-request-builder.js";
import { toJson } from "../utils.js";

/**
 * Builder for constructing AWS Bedrock Anthropic-compatible invoke requests.
 *
 * Converts standard OpenAI-compatible chat request format into the Bedrock
 * Anthropic Messages API format. Supports conversion from existing
 * ChatCompletionsRequest objects or using an internal ChatRequestBuilder
 * for fluent construction.
 */
export class BedrockInvokeBuilder {
  private request: BedrockInvokeRequest;
  private chatBuilder: ChatRequestBuilder;

  constructor() {
    this.request = {
      messages: [],
      max_tokens: 1024,
    };
    this.chatBuilder = new ChatRequestBuilder();
  }

  // ============================================================
  // Conversion methods
  // ============================================================

  /**
   * Convert an existing ChatCompletionsRequest to Bedrock Anthropic format.
   *
   * - Extracts system messages into the top-level `system` field
   * - Copies non-system messages into the `messages` array
   * - Copies temperature and max_tokens parameters
   * - Converts tool definitions to Bedrock tool format
   * - Sets anthropic_version for Anthropic models
   */
  fromChatRequest(chatRequest: ChatCompletionsRequest): this {
    // Extract system message content
    const systemMessages = chatRequest.messages.filter(
      (m: ChatMessage) => m.role === "system"
    );
    if (systemMessages.length > 0) {
      const systemContent = systemMessages
        .map((m: ChatMessage) => {
          if (typeof m.content === "string") {
            return m.content;
          }
          return "";
        })
        .filter((s: string) => s.length > 0)
        .join("\n\n");

      if (systemContent) {
        this.request.system = systemContent;
      }
    }

    // Copy non-system messages
    this.request.messages = chatRequest.messages.filter(
      (m: ChatMessage) => m.role !== "system"
    );

    // Copy temperature
    if (chatRequest.temperature !== undefined) {
      this.request.temperature = chatRequest.temperature;
    }

    // Copy max_tokens
    if (chatRequest.max_tokens !== undefined) {
      this.request.max_tokens = chatRequest.max_tokens;
    }

    // Convert tools to Bedrock format
    if (chatRequest.tools && chatRequest.tools.length > 0) {
      this.request.tools = chatRequest.tools.map((tool): BedrockTool => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      }));
    }

    // Set anthropic_version for Anthropic models
    if (BedrockInvokeBuilder.isAnthropicModel(chatRequest.model)) {
      this.request.anthropic_version = "bedrock-2023-05-31";
    }

    return this;
  }

  /**
   * Use an internal ChatRequestBuilder to construct the request.
   * The provided configure function receives the builder for fluent configuration,
   * then the result is converted to Bedrock format.
   */
  useRequestBuilder(configure: (builder: ChatRequestBuilder) => void): this {
    configure(this.chatBuilder);
    const chatRequest = this.chatBuilder.generate();
    return this.fromChatRequest(chatRequest);
  }

  // ============================================================
  // Generation
  // ============================================================

  /**
   * Return the constructed Bedrock invoke request.
   */
  generate(): BedrockInvokeRequest {
    return this.request;
  }

  /**
   * Serialize the generated request to JSON.
   */
  toJson(indented = true): string {
    return toJson(this.request, indented);
  }

  // ============================================================
  // Static helpers
  // ============================================================

  /**
   * Check if a model identifier corresponds to an Anthropic model.
   * Matches models containing "anthropic" or "claude" (case-insensitive).
   */
  static isAnthropicModel(model: string): boolean {
    const lower = model.toLowerCase();
    return lower.includes("anthropic") || lower.includes("claude");
  }
}
