// Screenshot Injector - Adds synthetic screenshot data to tool response messages
// Port of ScreenshotInjector.cs

import { randomBytes } from "crypto";
import type { ChatCompletionsRequest, ChatMessage } from "../core/models/types.js";

/**
 * Adds synthetic base64-encoded screenshot data to tool response messages
 * in a serialized ChatCompletionsRequest JSON string.
 *
 * This is used to inflate request payloads for performance testing,
 * simulating real-world scenarios where tool responses contain screenshots.
 *
 * @param json - The serialized ChatCompletionsRequest JSON
 * @param numScreenshots - Number of screenshots to inject
 * @param sizeKb - Size of each screenshot in kilobytes (default: 50)
 * @returns The modified JSON string with screenshots injected
 */
export function addScreenshotsToJson(
  json: string,
  numScreenshots: number,
  sizeKb: number = 50,
): string {
  if (numScreenshots <= 0) {
    return json;
  }

  const request: ChatCompletionsRequest = JSON.parse(json);

  // Find all messages with role "tool"
  const toolMessages: ChatMessage[] = request.messages.filter(
    (m) => m.role === "tool",
  );

  if (toolMessages.length === 0) {
    return json;
  }

  // Calculate distribution interval: spread screenshots evenly across tool messages
  const interval = Math.max(1, Math.floor(toolMessages.length / numScreenshots));
  let screenshotsAdded = 0;

  for (let i = 0; i < toolMessages.length && screenshotsAdded < numScreenshots; i++) {
    // Select tool messages at regular intervals
    if (i % interval === 0) {
      const message = toolMessages[i];
      injectScreenshot(message, sizeKb);
      screenshotsAdded++;
    }
  }

  return JSON.stringify(request, null, 2);
}

/**
 * Inject a synthetic screenshot into a tool message's content.
 * Parses the existing content as JSON, adds a screenshot_base64 field,
 * then stringifies back.
 */
function injectScreenshot(message: ChatMessage, sizeKb: number): void {
  // Generate random bytes and encode as base64
  const byteCount = sizeKb * 1024;
  const randomData = randomBytes(byteCount);
  const base64Data = randomData.toString("base64");

  // Parse existing content as JSON if possible, otherwise wrap it
  let contentObj: Record<string, unknown>;
  try {
    if (typeof message.content === "string") {
      contentObj = JSON.parse(message.content) as Record<string, unknown>;
    } else {
      contentObj = { original_content: message.content };
    }
  } catch {
    contentObj = { original_content: message.content };
  }

  // Add screenshot data
  contentObj["screenshot_base64"] = base64Data;

  // Stringify back into the message content
  message.content = JSON.stringify(contentObj);
}
