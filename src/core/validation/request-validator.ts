// Request Validator - Validates and auto-adjusts requests against model capabilities
// Port of ModelRegistry.ValidateRequest validation logic

import type { ModelConfiguration, ChatCompletionsRequest } from "../models/types.js";

/**
 * Validates a ChatCompletionsRequest against a model's capabilities.
 * Returns an object with `isValid` (always true -- requests are never outright rejected)
 * and a list of `warnings` describing any capability mismatches.
 *
 * If model is undefined, validation is skipped with a warning.
 */
export function validateRequest(
  model: ModelConfiguration | undefined,
  request: ChatCompletionsRequest,
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!model) {
    warnings.push(
      `Model "${request.model}" is not registered. Validation skipped.`,
    );
    return { isValid: true, warnings };
  }

  const caps = model.capabilities;
  const modelId = model.modelId;

  // Tool usage
  if (request.tools && request.tools.length > 0 && !caps.supportsTools) {
    warnings.push(
      `Model "${modelId}" does not support tools, but the request includes ${request.tools.length} tool definition(s).`,
    );
  }

  // Parallel tool calls
  if (request.parallel_tool_calls === true && !caps.supportsParallelToolCalls) {
    warnings.push(
      `Model "${modelId}" does not support parallel tool calls, but parallel_tool_calls=true was requested.`,
    );
  }

  // Streaming
  if (request.stream === true && !caps.supportsStreaming) {
    warnings.push(
      `Model "${modelId}" does not support streaming, but stream=true was requested.`,
    );
  }

  // Penalties
  if (!caps.supportsPenalties) {
    if (
      (request.presence_penalty !== undefined && request.presence_penalty !== 0) ||
      (request.frequency_penalty !== undefined && request.frequency_penalty !== 0)
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
 * Auto-adjusts a ChatCompletionsRequest to remove or cap features that the
 * target model does not support. Mutates and returns the request.
 *
 * Adjustments:
 * - Removes tools, tool_choice, parallel_tool_calls if tools unsupported
 * - Removes parallel_tool_calls if parallel tool calls unsupported
 * - Removes stream if streaming unsupported
 * - Removes presence_penalty and frequency_penalty if penalties unsupported
 * - Removes logprobs and top_logprobs if logprobs unsupported
 * - Caps max_tokens to model's maxOutputTokens
 */
export function autoAdjustRequest(
  model: ModelConfiguration,
  request: ChatCompletionsRequest,
): ChatCompletionsRequest {
  const caps = model.capabilities;

  // Remove tools if model does not support them
  if (!caps.supportsTools && request.tools) {
    request.tools = undefined;
    request.tool_choice = undefined;
    request.parallel_tool_calls = undefined;
  }

  // Remove parallel_tool_calls if model does not support it
  if (!caps.supportsParallelToolCalls && request.parallel_tool_calls !== undefined) {
    request.parallel_tool_calls = undefined;
  }

  // Remove streaming if model does not support it
  if (!caps.supportsStreaming && request.stream) {
    request.stream = undefined;
  }

  // Remove penalties if model does not support them
  if (!caps.supportsPenalties) {
    request.presence_penalty = undefined;
    request.frequency_penalty = undefined;
  }

  // Remove logprobs if model does not support them
  if (!caps.supportsLogprobs) {
    request.logprobs = undefined;
    request.top_logprobs = undefined;
  }

  // Cap max_tokens to model maximum
  if (
    request.max_tokens !== undefined &&
    caps.maxOutputTokens > 0 &&
    request.max_tokens > caps.maxOutputTokens
  ) {
    request.max_tokens = caps.maxOutputTokens;
  }

  return request;
}
