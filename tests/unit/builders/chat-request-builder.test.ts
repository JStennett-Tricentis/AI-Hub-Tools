import { describe, it, expect } from "vitest";
import { ChatRequestBuilder } from "../../../src/core/builders/chat-request-builder.js";

describe("ChatRequestBuilder", () => {
  describe("simple preset", () => {
    it("should generate a single-turn request without system prompt", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.simple().generate();

      expect(request.model).toBe("gpt-4o-2024-05-13");
      expect(request.messages.length).toBe(1);
      expect(request.messages[0].role).toBe("user");
      expect(request.tools).toBeUndefined();
    });
  });

  describe("medium preset", () => {
    it("should generate a multi-turn request with system prompt", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.medium().generate();

      expect(request.messages.length).toBeGreaterThan(1);
      expect(request.messages[0].role).toBe("system");
      expect(request.tools).toBeUndefined();
    });

    it("should respect custom turn count", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.medium(2).generate();

      // system + user1 + assistant1 + user2 = 4 messages
      const userMessages = request.messages.filter((m) => m.role === "user");
      expect(userMessages.length).toBe(2);
    });
  });

  describe("complex preset", () => {
    it("should generate a request with tools", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.complex(2).generate();

      expect(request.tools).toBeDefined();
      expect(request.tools!.length).toBeGreaterThan(0);
      expect(request.tool_choice).toBe("auto");
    });
  });

  describe("configuration methods", () => {
    it("should set model", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.simple().model("gpt-4o-mini-2024-07-18").generate();
      expect(request.model).toBe("gpt-4o-mini-2024-07-18");
    });

    it("should set temperature", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.simple().temperature(0.5).generate();
      expect(request.temperature).toBe(0.5);
    });

    it("should set max_tokens", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.simple().maxTokens(500).generate();
      expect(request.max_tokens).toBe(500);
    });

    it("should set streaming", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.simple().streaming(true).generate();
      expect(request.stream).toBe(true);
    });

    it("should set topic", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.simple().topic("microservices").generate();
      const content = request.messages[0].content as string;
      expect(content).toContain("microservices");
    });

    it("should set domain", () => {
      const builder = new ChatRequestBuilder();
      // simple() disables system prompt, so domain only affects user message generation
      // which uses topic + language but not domain in all templates.
      // Use medium() to get a system prompt where domain appears.
      const request = builder.medium(1).topic("testing").domain("healthcare").generate();
      const systemMsg = request.messages.find((m) => m.role === "system");
      expect(systemMsg).toBeDefined();
      const content = systemMsg!.content as string;
      expect(content.toLowerCase()).toContain("healthcare");
    });

    it("should set tools count", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.simple().withTools(2).generate();
      expect(request.tools).toBeDefined();
      expect(request.tools!.length).toBe(2);
    });
  });

  describe("fromProfile", () => {
    it("should apply built-in simple profile", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.fromProfile("simple").generate();

      expect(request.messages.length).toBe(1);
      expect(request.tools).toBeUndefined();
    });

    it("should apply built-in stress profile", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.fromProfile("stress").generate();

      expect(request.tools).toBeDefined();
      const userMessages = request.messages.filter((m) => m.role === "user");
      expect(userMessages.length).toBe(20);
    });

    it("should apply custom profile configuration", () => {
      const builder = new ChatRequestBuilder();
      const request = builder.fromProfile("custom", {
        name: "custom",
        description: "test",
        defaults: {
          turns: 2,
          includeTools: false,
          includeSystemPrompt: false,
        },
      }).generate();

      const userMessages = request.messages.filter((m) => m.role === "user");
      expect(userMessages.length).toBe(2);
      expect(request.messages[0].role).toBe("user");
      expect(request.tools).toBeUndefined();
    });
  });

  describe("toJson", () => {
    it("should serialize to valid JSON", () => {
      const builder = new ChatRequestBuilder();
      builder.simple().generate();
      const json = builder.toJson();

      const parsed = JSON.parse(json);
      expect(parsed.model).toBe("gpt-4o-2024-05-13");
      expect(parsed.messages).toBeDefined();
    });

    it("should support compact mode", () => {
      const builder = new ChatRequestBuilder();
      builder.simple().generate();

      const indented = builder.toJson(true);
      const compact = builder.toJson(false);

      expect(indented.length).toBeGreaterThan(compact.length);
      expect(compact).not.toContain("\n");
    });
  });

  describe("validation", () => {
    it("should remove tools for models that don't support them", () => {
      const builder = new ChatRequestBuilder();
      const request = builder
        .simple()
        .model("o1")
        .withTools(2)
        .generate();

      expect(request.tools).toBeUndefined();
      expect(request.tool_choice).toBeUndefined();
    });
  });

  describe("tosca compatible mode", () => {
    it("should double-wrap tool arguments when enabled", () => {
      const builder = new ChatRequestBuilder();
      const request = builder
        .complex(2)
        .toscaCompatibleFlag(true)
        .generate();

      const assistantMessages = request.messages.filter(
        (m) => m.role === "assistant" && m.tool_calls
      );

      if (assistantMessages.length > 0) {
        const toolCall = assistantMessages[0].tool_calls![0];
        // Tosca-compatible arguments are double-wrapped JSON
        const outerParsed = JSON.parse(toolCall.function.arguments);
        expect(typeof outerParsed).toBe("string");
      }
    });
  });
});
