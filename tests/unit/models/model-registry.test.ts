import { describe, it, expect } from "vitest";
import { ModelRegistry } from "../../../src/core/models/model-registry.js";

describe("ModelRegistry", () => {
  describe("getModel", () => {
    it("should return model config for known model", () => {
      const model = ModelRegistry.getModel("gpt-4o-2024-05-13");
      expect(model).toBeDefined();
      expect(model!.modelId).toBe("gpt-4o-2024-05-13");
      expect(model!.provider).toBe("OpenAI");
    });

    it("should return undefined for unknown model", () => {
      const model = ModelRegistry.getModel("nonexistent-model");
      expect(model).toBeUndefined();
    });
  });

  describe("getAllModelIds", () => {
    it("should return an array of model IDs", () => {
      const ids = ModelRegistry.getAllModelIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain("gpt-4o-2024-05-13");
    });
  });

  describe("getChatModels", () => {
    it("should return only chat models", () => {
      const models = ModelRegistry.getChatModels();
      expect(models.length).toBeGreaterThan(0);
      for (const model of models) {
        expect(model.type).toBe("chat");
      }
    });
  });

  describe("getCompletionModels", () => {
    it("should return only completion models", () => {
      const models = ModelRegistry.getCompletionModels();
      expect(models.length).toBeGreaterThan(0);
      for (const model of models) {
        expect(model.type).toBe("completion");
      }
    });
  });

  describe("getEmbeddingModels", () => {
    it("should return only embedding models", () => {
      const models = ModelRegistry.getEmbeddingModels();
      expect(models.length).toBeGreaterThan(0);
      for (const model of models) {
        expect(model.type).toBe("embedding");
      }
    });
  });

  describe("getEndpointPath", () => {
    it("should return endpoint path for known model", () => {
      const path = ModelRegistry.getEndpointPath("gpt-4o-2024-05-13");
      expect(path).toContain("/");
    });

    it("should throw for unknown model", () => {
      expect(() => ModelRegistry.getEndpointPath("unknown-model")).toThrow();
    });
  });

  describe("model capabilities", () => {
    it("o1 should not support tools", () => {
      const model = ModelRegistry.getModel("o1");
      expect(model).toBeDefined();
      expect(model!.capabilities.supportsTools).toBe(false);
    });

    it("gpt-4o should support vision", () => {
      const model = ModelRegistry.getModel("gpt-4o-2024-05-13");
      expect(model).toBeDefined();
      expect(model!.capabilities.supportsVision).toBe(true);
    });

    it("embedding models should have correct type", () => {
      const model = ModelRegistry.getModel("text-embedding-ada-002-2");
      expect(model).toBeDefined();
      expect(model!.type).toBe("embedding");
    });
  });
});
