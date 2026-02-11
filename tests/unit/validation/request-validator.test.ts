import { describe, it, expect } from "vitest";
import {
  validateRequest,
  autoAdjustRequest,
} from "../../../src/core/validation/request-validator.js";
import type {
  ModelConfiguration,
  ChatCompletionsRequest,
} from "../../../src/core/models/types.js";
import { ModelType, EndpointType } from "../../../src/core/models/types.js";

function createTestModel(overrides: Partial<ModelConfiguration["capabilities"]> = {}): ModelConfiguration {
  return {
    modelId: "test-model",
    provider: "test",
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
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
      ...overrides,
    },
    endpoints: {
      type: EndpointType.OpenAICompatible,
      pathTemplate: "/v1/chat/completions",
    },
  };
}

function createTestRequest(overrides: Partial<ChatCompletionsRequest> = {}): ChatCompletionsRequest {
  return {
    model: "test-model",
    messages: [{ role: "user", content: "Hello" }],
    ...overrides,
  };
}

describe("validateRequest", () => {
  it("should return valid with no warnings for compatible request", () => {
    const model = createTestModel();
    const request = createTestRequest();
    const result = validateRequest(model, request);

    expect(result.isValid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("should warn about tools on non-tool model", () => {
    const model = createTestModel({ supportsTools: false });
    const request = createTestRequest({
      tools: [{ type: "function", function: { name: "test", description: "test", parameters: {} } }],
    });
    const result = validateRequest(model, request);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("does not support tools");
  });

  it("should warn about streaming on non-streaming model", () => {
    const model = createTestModel({ supportsStreaming: false });
    const request = createTestRequest({ stream: true });
    const result = validateRequest(model, request);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("does not support streaming");
  });

  it("should warn about max_tokens exceeding limit", () => {
    const model = createTestModel({ maxOutputTokens: 1000 });
    const request = createTestRequest({ max_tokens: 5000 });
    const result = validateRequest(model, request);

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("exceeds");
  });

  it("should handle undefined model gracefully", () => {
    const request = createTestRequest();
    const result = validateRequest(undefined, request);

    expect(result.isValid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("not registered");
  });
});

describe("autoAdjustRequest", () => {
  it("should remove tools when model doesn't support them", () => {
    const model = createTestModel({ supportsTools: false });
    const request = createTestRequest({
      tools: [{ type: "function", function: { name: "test", description: "test", parameters: {} } }],
      tool_choice: "auto",
    });

    const adjusted = autoAdjustRequest(model, request);
    expect(adjusted.tools).toBeUndefined();
    expect(adjusted.tool_choice).toBeUndefined();
  });

  it("should remove streaming when model doesn't support it", () => {
    const model = createTestModel({ supportsStreaming: false });
    const request = createTestRequest({ stream: true });

    const adjusted = autoAdjustRequest(model, request);
    expect(adjusted.stream).toBeUndefined();
  });

  it("should cap max_tokens to model maximum", () => {
    const model = createTestModel({ maxOutputTokens: 1000 });
    const request = createTestRequest({ max_tokens: 5000 });

    const adjusted = autoAdjustRequest(model, request);
    expect(adjusted.max_tokens).toBe(1000);
  });

  it("should remove penalties when model doesn't support them", () => {
    const model = createTestModel({ supportsPenalties: false });
    const request = createTestRequest({
      presence_penalty: 0.5,
      frequency_penalty: 0.3,
    });

    const adjusted = autoAdjustRequest(model, request);
    expect(adjusted.presence_penalty).toBeUndefined();
    expect(adjusted.frequency_penalty).toBeUndefined();
  });

  it("should remove logprobs when model doesn't support them", () => {
    const model = createTestModel({ supportsLogprobs: false });
    const request = createTestRequest({
      logprobs: true,
      top_logprobs: 5,
    });

    const adjusted = autoAdjustRequest(model, request);
    expect(adjusted.logprobs).toBeUndefined();
    expect(adjusted.top_logprobs).toBeUndefined();
  });

  it("should leave compatible requests unchanged", () => {
    const model = createTestModel();
    const request = createTestRequest({
      temperature: 0.7,
      max_tokens: 1000,
    });

    const adjusted = autoAdjustRequest(model, request);
    expect(adjusted.temperature).toBe(0.7);
    expect(adjusted.max_tokens).toBe(1000);
  });
});
