// Shared utility functions for AI Hub Request Generator

/**
 * Recursively strips undefined values from an object for clean JSON serialization.
 * Arrays are preserved with their elements cleaned. Null values are preserved.
 */
export function cleanObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }

  if (typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const cleanedValue = cleanObject(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }

  return obj;
}

/**
 * Serializes an object to JSON, stripping undefined values first.
 * @param obj - The object to serialize
 * @param indented - Whether to pretty-print with 2-space indentation (default: true)
 */
export function toJson(obj: unknown, indented = true): string {
  return JSON.stringify(cleanObject(obj), null, indented ? 2 : undefined);
}
