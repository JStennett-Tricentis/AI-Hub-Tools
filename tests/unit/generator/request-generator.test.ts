import { describe, it, expect } from "vitest";
import { RequestGenerator } from "../../../src/core/generator/request-generator.js";
import { BuilderConfigService } from "../../../src/core/generator/builder-config.js";
import { createDefaultOptions } from "../../../src/core/models/types.js";

describe("RequestGenerator", () => {
  const builderConfig = new BuilderConfigService();
  const generator = new RequestGenerator(builderConfig);

  describe("chat generation", () => {
    it("should generate valid chat request JSON", () => {
      const options = createDefaultOptions();
      const result = generator.generate(options);

      expect(result.endpointType).toBe("chat");
      const parsed = JSON.parse(result.json);
      expect(parsed.model).toBeDefined();
      expect(parsed.messages).toBeDefined();
      expect(Array.isArray(parsed.messages)).toBe(true);
    });

    it("should respect complexity level", () => {
      const simpleOpts = { ...createDefaultOptions(), complexity: "simple" };
      const complexOpts = { ...createDefaultOptions(), complexity: "complex" };

      const simpleResult = generator.generate(simpleOpts);
      const complexResult = generator.generate(complexOpts);

      const simpleParsed = JSON.parse(simpleResult.json);
      const complexParsed = JSON.parse(complexResult.json);

      expect(simpleParsed.messages.length).toBeLessThan(complexParsed.messages.length);
    });

    it("should include tools when specified", () => {
      const options = { ...createDefaultOptions(), tools: 3 };
      const result = generator.generate(options);
      const parsed = JSON.parse(result.json);

      expect(parsed.tools).toBeDefined();
      expect(parsed.tools.length).toBe(3);
    });
  });

  describe("completions generation", () => {
    it("should generate valid completions request JSON", () => {
      const options = { ...createDefaultOptions(), useCompletions: true };
      const result = generator.generate(options);

      expect(result.endpointType).toBe("completions");
      const parsed = JSON.parse(result.json);
      expect(parsed.model).toBeDefined();
      expect(parsed.prompt).toBeDefined();
    });

    it("should use provided prompt", () => {
      const options = {
        ...createDefaultOptions(),
        useCompletions: true,
        prompt: "Write a function",
      };
      const result = generator.generate(options);
      const parsed = JSON.parse(result.json);

      expect(parsed.prompt).toBe("Write a function");
    });
  });

  describe("embedding generation", () => {
    it("should generate valid embedding request JSON", () => {
      const options = { ...createDefaultOptions(), useEmbeddings: true };
      const result = generator.generate(options);

      expect(result.endpointType).toBe("embeddings");
      const parsed = JSON.parse(result.json);
      expect(parsed.model).toBeDefined();
      expect(parsed.input).toBeDefined();
    });

    it("should use embedding model instead of chat model", () => {
      const options = { ...createDefaultOptions(), useEmbeddings: true };
      const result = generator.generate(options);
      const parsed = JSON.parse(result.json);

      // Should not be the default chat model
      expect(parsed.model).not.toBe("gpt-4o-2024-05-13");
    });
  });

  describe("invoke generation", () => {
    it("should generate valid Bedrock invoke request JSON", () => {
      const options = { ...createDefaultOptions(), endpoint: "invoke" };
      const result = generator.generate(options);

      expect(result.endpointType).toBe("invoke");
      const parsed = JSON.parse(result.json);
      expect(parsed.messages).toBeDefined();
      expect(parsed.max_tokens).toBeDefined();
    });

    it("should generate bedrock invoke-stream request", () => {
      const options = {
        ...createDefaultOptions(),
        endpoint: "invoke-stream",
        model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
      };
      const result = generator.generate(options);

      expect(result.endpointType).toBe("invoke-stream");
      const parsed = JSON.parse(result.json);
      expect(parsed.anthropic_version).toBe("bedrock-2023-05-31");
      expect(parsed.messages).toBeDefined();
      expect(parsed.max_tokens).toBeDefined();
    });
  });

  describe("template generation", () => {
    it("should use pre-loaded template when available", () => {
      const options = {
        ...createDefaultOptions(),
        template: "test",
        _loadedTemplate: {
          model: "gpt-4o-2024-05-13",
          messages: [
            { role: "user" as const, content: "Template message" },
          ],
          temperature: 0.5,
        },
      };
      const result = generator.generate(options);
      const parsed = JSON.parse(result.json);

      expect(parsed.messages[0].content).toBe("Template message");
      expect(parsed.temperature).toBe(0.5);
    });
  });

  describe("output format", () => {
    it("should produce pretty-printed JSON by default", () => {
      const options = createDefaultOptions();
      const result = generator.generate(options);

      expect(result.json).toContain("\n");
      expect(result.json).toContain("  ");
    });

    it("should produce compact JSON when specified", () => {
      const options = { ...createDefaultOptions(), compact: true };
      const result = generator.generate(options);

      expect(result.json).not.toContain("\n");
    });
  });
});
