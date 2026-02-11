import { describe, it, expect } from "vitest";
import { EmbeddingBuilder } from "../../../src/core/builders/embedding-builder.js";

describe("EmbeddingBuilder", () => {
  describe("basic generation", () => {
    it("should generate a request with auto-generated text", () => {
      const builder = new EmbeddingBuilder();
      const request = builder.generate();

      expect(request.model).toBe("text-embedding-ada-002");
      expect(typeof request.input).toBe("string");
      expect((request.input as string).length).toBeGreaterThan(0);
    });

    it("should use provided input text", () => {
      const builder = new EmbeddingBuilder();
      const request = builder.input("Hello world").generate();

      expect(request.input).toBe("Hello world");
    });

    it("should handle array input", () => {
      const builder = new EmbeddingBuilder();
      const request = builder.input(["text1", "text2"]).generate();

      expect(Array.isArray(request.input)).toBe(true);
      expect(request.input).toEqual(["text1", "text2"]);
    });
  });

  describe("complexity presets", () => {
    it("simple should generate 1 text", () => {
      const builder = new EmbeddingBuilder();
      const request = builder.simple().generate();
      expect(typeof request.input).toBe("string");
    });

    it("medium should generate 5 texts", () => {
      const builder = new EmbeddingBuilder();
      const request = builder.medium().generate();
      expect(Array.isArray(request.input)).toBe(true);
      expect((request.input as string[]).length).toBe(5);
    });

    it("complex should generate 20 texts", () => {
      const builder = new EmbeddingBuilder();
      const request = builder.complex().generate();
      expect(Array.isArray(request.input)).toBe(true);
      expect((request.input as string[]).length).toBe(20);
    });

    it("stressTest should generate 100 texts", () => {
      const builder = new EmbeddingBuilder();
      const request = builder.stressTest().generate();
      expect(Array.isArray(request.input)).toBe(true);
      expect((request.input as string[]).length).toBe(100);
    });
  });

  describe("configuration", () => {
    it("should set model", () => {
      const builder = new EmbeddingBuilder();
      const request = builder.model("text-embedding-3-small").generate();
      expect(request.model).toBe("text-embedding-3-small");
    });

    it("should set encoding format", () => {
      const builder = new EmbeddingBuilder();
      const request = builder.encodingFormat("base64").generate();
      expect(request.encoding_format).toBe("base64");
    });

    it("should set dimensions", () => {
      const builder = new EmbeddingBuilder();
      const request = builder.dimensions(256).generate();
      expect(request.dimensions).toBe(256);
    });

    it("should set topic and domain for auto-generation", () => {
      const builder = new EmbeddingBuilder();
      const request = builder.topic("security").domain("healthcare").generate();
      const text = request.input as string;
      expect(text).toContain("security");
      expect(text).toContain("healthcare");
    });
  });

  describe("serialization", () => {
    it("should serialize to valid JSON", () => {
      const builder = new EmbeddingBuilder();
      builder.input("test").generate();
      const json = builder.toJson();

      const parsed = JSON.parse(json);
      expect(parsed.model).toBeDefined();
      expect(parsed.input).toBe("test");
    });
  });
});
