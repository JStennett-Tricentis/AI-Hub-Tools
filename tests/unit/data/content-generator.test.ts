import { describe, it, expect } from "vitest";
import {
  generateSystemPrompt,
  generateInitialUserMessage,
  generateFollowUpMessage,
  generateAssistantResponse,
  generateCompletionPrompt,
  getCodeSnippet,
  getFileExtension,
} from "../../../src/core/data/content-generator.js";

describe("generateSystemPrompt", () => {
  it("should include topic and domain", () => {
    const prompt = generateSystemPrompt("microservices", "e-commerce");
    expect(prompt).toContain("microservices");
    expect(prompt).toContain("e-commerce");
  });

  it("should return a non-empty string", () => {
    const prompt = generateSystemPrompt("testing", "healthcare");
    expect(prompt.length).toBeGreaterThan(0);
  });
});

describe("generateInitialUserMessage", () => {
  it("should include topic, language, and domain", () => {
    const msg = generateInitialUserMessage("API design", "Python", "fintech");
    expect(msg).toContain("API design");
    // At least one of language or domain should appear
    expect(msg.includes("Python") || msg.includes("fintech")).toBe(true);
  });
});

describe("generateFollowUpMessage", () => {
  it("should include the topic", () => {
    const msg = generateFollowUpMessage("caching");
    expect(msg).toContain("caching");
  });
});

describe("generateAssistantResponse", () => {
  it("should include topic and language", () => {
    const response = generateAssistantResponse("database optimization", "Go");
    expect(response).toContain("database optimization");
    expect(response).toContain("Go");
  });
});

describe("generateCompletionPrompt", () => {
  it("should include topic and language", () => {
    const prompt = generateCompletionPrompt("algorithms", "Rust");
    expect(prompt).toContain("algorithms");
    expect(prompt).toContain("Rust");
  });
});

describe("getCodeSnippet", () => {
  it("should return a snippet for known languages", () => {
    for (const lang of ["python", "javascript", "csharp", "java"]) {
      const snippet = getCodeSnippet(lang);
      expect(snippet.length).toBeGreaterThan(0);
    }
  });

  it("should fall back to python for unknown languages", () => {
    const snippet = getCodeSnippet("brainfuck");
    expect(snippet.length).toBeGreaterThan(0);
  });
});

describe("getFileExtension", () => {
  it("should return correct extensions", () => {
    expect(getFileExtension("Python")).toBe("py");
    expect(getFileExtension("JavaScript")).toBe("js");
    expect(getFileExtension("TypeScript")).toBe("ts");
    expect(getFileExtension("C#")).toBe("cs");
    expect(getFileExtension("Java")).toBe("java");
    expect(getFileExtension("Go")).toBe("go");
    expect(getFileExtension("Rust")).toBe("rs");
  });

  it("should return txt for unknown languages", () => {
    expect(getFileExtension("Unknown")).toBe("txt");
  });
});
