import { describe, it, expect } from "vitest";
import { cleanObject, toJson } from "../../src/core/utils.js";

describe("cleanObject", () => {
  it("should remove undefined values", () => {
    const input = { a: 1, b: undefined, c: "test" };
    const result = cleanObject(input) as Record<string, unknown>;
    expect(result).toEqual({ a: 1, c: "test" });
    expect("b" in result).toBe(false);
  });

  it("should preserve null values as undefined (stripped)", () => {
    const result = cleanObject(null);
    expect(result).toBeUndefined();
  });

  it("should handle nested objects", () => {
    const input = { a: { b: 1, c: undefined }, d: 2 };
    const result = cleanObject(input) as Record<string, unknown>;
    expect(result).toEqual({ a: { b: 1 }, d: 2 });
  });

  it("should handle arrays", () => {
    const input = [1, 2, 3];
    const result = cleanObject(input);
    expect(result).toEqual([1, 2, 3]);
  });

  it("should handle primitive values", () => {
    expect(cleanObject(42)).toBe(42);
    expect(cleanObject("hello")).toBe("hello");
    expect(cleanObject(true)).toBe(true);
  });

  it("should handle empty objects", () => {
    const result = cleanObject({});
    expect(result).toEqual({});
  });
});

describe("toJson", () => {
  it("should serialize with indentation by default", () => {
    const result = toJson({ a: 1, b: 2 });
    expect(result).toContain("\n");
    expect(result).toContain("  ");
  });

  it("should serialize without indentation when compact", () => {
    const result = toJson({ a: 1, b: 2 }, false);
    expect(result).not.toContain("\n");
    expect(result).toBe('{"a":1,"b":2}');
  });

  it("should strip undefined values during serialization", () => {
    const result = toJson({ a: 1, b: undefined });
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ a: 1 });
    expect("b" in parsed).toBe(false);
  });
});
