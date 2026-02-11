// Template Loader - Loads and processes template files with variable substitution
// Port of TemplateLoader.cs

import { promises as fs } from "fs";
import path from "path";
import type { ChatCompletionsRequest } from "../core/models/types.js";

/**
 * Resolve the default templates directory relative to the package root.
 * Uses import.meta.url to find the package root regardless of cwd.
 */
function getDefaultTemplatesDir(): string {
  return path.join(process.cwd(), "data", "templates");
}

/**
 * Load a template by name and optionally apply variable substitution.
 *
 * File resolution order:
 * 1. `{templateName}.template.json`
 * 2. `{templateName}.json`
 *
 * Returns undefined if neither file is found.
 *
 * @param templateName - The name of the template to load (without extension)
 * @param variables - Optional key-value pairs for variable substitution (e.g., GENERIC_MODEL_ID)
 * @param templatesDir - Optional directory to load templates from (defaults to data/templates)
 * @returns The parsed ChatCompletionsRequest with variables substituted, or undefined if not found
 */
export async function loadTemplate(
  templateName: string,
  variables?: Record<string, string>,
  templatesDir?: string,
): Promise<ChatCompletionsRequest | undefined> {
  const dir = templatesDir ?? getDefaultTemplatesDir();

  // Try .template.json first, then .json
  const candidates = [
    path.join(dir, `${templateName}.template.json`),
    path.join(dir, `${templateName}.json`),
  ];

  let content: string | undefined;

  for (const candidate of candidates) {
    try {
      content = await fs.readFile(candidate, "utf-8");
      break;
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }

  if (content === undefined) {
    return undefined;
  }

  const template = JSON.parse(content) as ChatCompletionsRequest;

  // Apply variable substitution if variables are provided
  if (variables && Object.keys(variables).length > 0) {
    return applyVariableSubstitution(template, variables);
  }

  return template;
}

/**
 * Apply variable substitution to a template.
 * Replaces `{{VAR_NAME}}` placeholders in:
 * - model field
 * - messages[].content (string content only)
 * - messages[].tool_calls[].function.arguments
 *
 * @param template - The template to process
 * @param variables - Key-value pairs where keys are variable names (without braces)
 * @returns A new ChatCompletionsRequest with variables replaced
 */
export function applyVariableSubstitution(
  template: ChatCompletionsRequest,
  variables: Record<string, string>,
): ChatCompletionsRequest {
  // Deep clone to avoid mutating the original
  const result = JSON.parse(JSON.stringify(template)) as ChatCompletionsRequest;

  // Substitute in model field
  if (result.model) {
    result.model = substituteVariables(result.model, variables);
  }

  // Substitute in messages
  if (result.messages) {
    for (const message of result.messages) {
      // Substitute in string content
      if (typeof message.content === "string") {
        message.content = substituteVariables(message.content, variables);
      }

      // Substitute in tool call arguments
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.function?.arguments) {
            toolCall.function.arguments = substituteVariables(
              toolCall.function.arguments,
              variables,
            );
          }
        }
      }
    }
  }

  return result;
}

/**
 * Replace all `{{VAR_NAME}}` occurrences in a string with their values.
 */
function substituteVariables(
  text: string,
  variables: Record<string, string>,
): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value);
  }
  return result;
}

/**
 * Type guard for Node.js system errors with a `code` property.
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
