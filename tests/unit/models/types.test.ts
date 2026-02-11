import { describe, it, expect } from "vitest";
import {
  createDefaultOptions,
  ModelType,
  ComplexityLevel,
  EndpointType,
  RequestEndpoint,
} from "../../../src/core/models/types.js";

describe("createDefaultOptions", () => {
  it("should return default options with expected values", () => {
    const opts = createDefaultOptions();
    expect(opts.complexity).toBe("medium");
    expect(opts.model).toBe("gpt-4o-2024-05-13");
    expect(opts.stream).toBe(false);
    expect(opts.compact).toBe(false);
    expect(opts.noTimestamp).toBe(false);
    expect(opts.copy).toBe(false);
    expect(opts.useCompletions).toBe(false);
    expect(opts.useEmbeddings).toBe(false);
    expect(opts.toscaCompatible).toBe(false);
    expect(opts.toolsOnly).toBe(false);
    expect(opts.screenshotSizeKb).toBe(50);
    expect(opts.imagesOnly).toBe(false);
    expect(opts.strict).toBe(false);
    expect(opts.hubFormat).toBe(false);
  });

  it("should return a new object each time", () => {
    const a = createDefaultOptions();
    const b = createDefaultOptions();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("enums", () => {
  it("ModelType has expected values", () => {
    expect(ModelType.Chat).toBe("chat");
    expect(ModelType.Completion).toBe("completion");
    expect(ModelType.Embedding).toBe("embedding");
  });

  it("ComplexityLevel has expected values", () => {
    expect(ComplexityLevel.Simple).toBe("simple");
    expect(ComplexityLevel.Medium).toBe("medium");
    expect(ComplexityLevel.Complex).toBe("complex");
    expect(ComplexityLevel.Stress).toBe("stress");
  });

  it("EndpointType has expected values", () => {
    expect(EndpointType.OpenAICompatible).toBe("openai-compatible");
    expect(EndpointType.ModelInvoke).toBe("model-invoke");
    expect(EndpointType.Custom).toBe("custom");
  });

  it("RequestEndpoint has expected values", () => {
    expect(RequestEndpoint.Chat).toBe("chat");
    expect(RequestEndpoint.Completions).toBe("completions");
    expect(RequestEndpoint.Embeddings).toBe("embeddings");
    expect(RequestEndpoint.Invoke).toBe("invoke");
    expect(RequestEndpoint.InvokeStream).toBe("invoke-stream");
  });
});
