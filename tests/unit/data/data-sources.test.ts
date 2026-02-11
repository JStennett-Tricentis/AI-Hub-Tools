import { describe, it, expect } from "vitest";
import {
  randomChoice,
  getRandomTopic,
  getRandomLanguage,
  getRandomDomain,
  getRandomTask,
  getRandomVulnerability,
} from "../../../src/core/data/data-sources.js";

describe("randomChoice", () => {
  it("should return an element from the array", () => {
    const arr = ["a", "b", "c"];
    const result = randomChoice(arr);
    expect(arr).toContain(result);
  });

  it("should return the only element for single-item array", () => {
    expect(randomChoice(["only"])).toBe("only");
  });
});

describe("getRandomTopic", () => {
  it("should return a non-empty string", () => {
    const topic = getRandomTopic();
    expect(typeof topic).toBe("string");
    expect(topic.length).toBeGreaterThan(0);
  });
});

describe("getRandomLanguage", () => {
  it("should return a known programming language", () => {
    const knownLanguages = [
      "Python", "JavaScript", "TypeScript", "Java", "C#",
      "Go", "Rust", "Ruby", "PHP", "Swift", "Kotlin", "Scala", "Elixir", "SQL",
    ];
    const lang = getRandomLanguage();
    expect(knownLanguages).toContain(lang);
  });
});

describe("getRandomDomain", () => {
  it("should return a non-empty string", () => {
    const domain = getRandomDomain();
    expect(typeof domain).toBe("string");
    expect(domain.length).toBeGreaterThan(0);
  });
});

describe("getRandomTask", () => {
  it("should return a non-empty string", () => {
    const task = getRandomTask();
    expect(typeof task).toBe("string");
    expect(task.length).toBeGreaterThan(0);
  });
});

describe("getRandomVulnerability", () => {
  it("should return a non-empty string", () => {
    const vuln = getRandomVulnerability();
    expect(typeof vuln).toBe("string");
    expect(vuln.length).toBeGreaterThan(0);
  });
});
