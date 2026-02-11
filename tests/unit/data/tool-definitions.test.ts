import { describe, it, expect } from "vitest";
import {
  TOOL_NAMES,
  getRandomToolNames,
  getRandomTools,
  createSearchCodebaseTool,
  createAnalyzePerformanceTool,
  createRunTestsTool,
} from "../../../src/core/data/tool-definitions.js";

describe("TOOL_NAMES", () => {
  it("should have 10 tool names", () => {
    expect(TOOL_NAMES).toHaveLength(10);
  });

  it("should include expected tool names", () => {
    expect(TOOL_NAMES).toContain("search_codebase");
    expect(TOOL_NAMES).toContain("analyze_performance");
    expect(TOOL_NAMES).toContain("run_tests");
  });
});

describe("getRandomToolNames", () => {
  it("should return requested number of names", () => {
    const names = getRandomToolNames(3);
    expect(names).toHaveLength(3);
  });

  it("should not exceed total available tools", () => {
    const names = getRandomToolNames(100);
    expect(names.length).toBeLessThanOrEqual(TOOL_NAMES.length);
  });

  it("should return unique names", () => {
    const names = getRandomToolNames(5);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

describe("getRandomTools", () => {
  it("should return fully-defined Tool objects", () => {
    const tools = getRandomTools(2);
    expect(tools).toHaveLength(2);
    for (const tool of tools) {
      expect(tool.type).toBe("function");
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeTruthy();
    }
  });
});

describe("individual tool factories", () => {
  it("createSearchCodebaseTool has correct structure", () => {
    const tool = createSearchCodebaseTool();
    expect(tool.type).toBe("function");
    expect(tool.function.name).toBe("search_codebase");
    expect(tool.function.parameters.required).toContain("query");
  });

  it("createAnalyzePerformanceTool has correct structure", () => {
    const tool = createAnalyzePerformanceTool();
    expect(tool.function.name).toBe("analyze_performance");
    expect(tool.function.parameters.required).toContain("code");
  });

  it("createRunTestsTool has correct structure", () => {
    const tool = createRunTestsTool();
    expect(tool.function.name).toBe("run_tests");
    expect(tool.function.parameters.required).toContain("test_suite");
  });
});
