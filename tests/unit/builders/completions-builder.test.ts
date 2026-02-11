import { describe, it, expect } from "vitest";
import { CompletionsBuilder } from "../../../src/core/builders/completions-builder.js";

describe("CompletionsBuilder", () => {
  it("should generate a request with auto-generated prompt", () => {
    const builder = new CompletionsBuilder();
    const request = builder.generate();

    expect(request.model).toBe("gpt-3.5-turbo-instruct");
    expect(request.prompt.length).toBeGreaterThan(0);
  });

  it("should use provided prompt text", () => {
    const builder = new CompletionsBuilder();
    const request = builder.prompt("Write a haiku about code").generate();

    expect(request.prompt).toBe("Write a haiku about code");
  });

  it("should set model", () => {
    const builder = new CompletionsBuilder();
    const request = builder.model("gpt-35-turbo-0613").generate();
    expect(request.model).toBe("gpt-35-turbo-0613");
  });

  it("should set temperature", () => {
    const builder = new CompletionsBuilder();
    const request = builder.temperature(0.3).generate();
    expect(request.temperature).toBe(0.3);
  });

  it("should set max_tokens", () => {
    const builder = new CompletionsBuilder();
    const request = builder.maxTokens(200).generate();
    expect(request.max_tokens).toBe(200);
  });

  it("should set streaming", () => {
    const builder = new CompletionsBuilder();
    const request = builder.streaming(true).generate();
    expect(request.stream).toBe(true);
  });

  it("should include topic and language in auto-generated prompt", () => {
    const builder = new CompletionsBuilder();
    const request = builder
      .topic("caching")
      .language("Python")
      .generate();

    expect(request.prompt).toContain("caching");
    expect(request.prompt).toContain("Python");
  });

  it("should serialize to valid JSON", () => {
    const builder = new CompletionsBuilder();
    builder.prompt("test").generate();
    const json = builder.toJson();

    const parsed = JSON.parse(json);
    expect(parsed.model).toBeDefined();
    expect(parsed.prompt).toBe("test");
  });
});
