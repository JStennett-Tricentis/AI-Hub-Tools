// CLI Handler - Display methods for model info, listings, and endpoint mappings
// Port of the display methods from Program.cs (ListModels, ShowModelInfo, ListEndpoints)

import { ModelRegistry } from "../core/models/model-registry.js";

/**
 * Print all registered models grouped by type with capability indicators.
 */
export function listModels(): void {
  const chatModels = ModelRegistry.getChatModels();
  const completionModels = ModelRegistry.getCompletionModels();
  const embeddingModels = ModelRegistry.getEmbeddingModels();

  console.log("\n=== SUPPORTED MODELS ===\n");

  // Chat Models
  console.log(`Chat Models (${chatModels.length}):`);
  console.log("-".repeat(90));
  console.log(
    padRight("Model ID", 50) +
    padRight("Provider", 12) +
    padRight("Tools", 7) +
    padRight("Stream", 8) +
    padRight("Vision", 8),
  );
  console.log("-".repeat(90));

  for (const model of chatModels) {
    console.log(
      padRight(model.modelId, 50) +
      padRight(model.provider, 12) +
      padRight(indicator(model.capabilities.supportsTools), 7) +
      padRight(indicator(model.capabilities.supportsStreaming), 8) +
      padRight(indicator(model.capabilities.supportsVision), 8),
    );
  }

  // Completion Models
  if (completionModels.length > 0) {
    console.log(`\nCompletion Models (${completionModels.length}):`);
    console.log("-".repeat(90));
    console.log(
      padRight("Model ID", 50) +
      padRight("Provider", 12) +
      padRight("Tools", 7) +
      padRight("Stream", 8) +
      padRight("Context", 10),
    );
    console.log("-".repeat(90));

    for (const model of completionModels) {
      console.log(
        padRight(model.modelId, 50) +
        padRight(model.provider, 12) +
        padRight(indicator(model.capabilities.supportsTools), 7) +
        padRight(indicator(model.capabilities.supportsStreaming), 8) +
        padRight(model.capabilities.maxContextTokens.toLocaleString(), 10),
      );
    }
  }

  // Embedding Models
  if (embeddingModels.length > 0) {
    console.log(`\nEmbedding Models (${embeddingModels.length}):`);
    console.log("-".repeat(90));
    console.log(
      padRight("Model ID", 50) +
      padRight("Provider", 12) +
      padRight("Context", 10),
    );
    console.log("-".repeat(90));

    for (const model of embeddingModels) {
      console.log(
        padRight(model.modelId, 50) +
        padRight(model.provider, 12) +
        padRight(model.capabilities.maxContextTokens.toLocaleString(), 10),
      );
    }
  }

  const total = chatModels.length + completionModels.length + embeddingModels.length;
  console.log(`\nTotal: ${total} models registered\n`);
}

/**
 * Print detailed information for a specific model.
 */
export function showModelInfo(modelId: string): void {
  const model = ModelRegistry.getModel(modelId);

  if (!model) {
    console.log(`\nModel "${modelId}" not found in registry.\n`);
    console.log("Available models:");
    for (const id of ModelRegistry.getAllModelIds()) {
      console.log(`  ${id}`);
    }
    console.log("");
    return;
  }

  console.log(`\n=== MODEL INFORMATION: ${model.modelId} ===\n`);

  console.log("General:");
  console.log(`  Model ID:    ${model.modelId}`);
  console.log(`  Provider:    ${model.provider}`);
  console.log(`  Type:        ${model.type}`);

  console.log("\nCapabilities:");
  console.log(`  Tools:              ${boolStr(model.capabilities.supportsTools)}`);
  console.log(`  Streaming:          ${boolStr(model.capabilities.supportsStreaming)}`);
  console.log(`  Vision:             ${boolStr(model.capabilities.supportsVision)}`);
  console.log(`  System Message:     ${boolStr(model.capabilities.supportsSystemMessage)}`);
  console.log(`  Parallel Tool Calls:${boolStr(model.capabilities.supportsParallelToolCalls)}`);
  console.log(`  Temperature:        ${boolStr(model.capabilities.supportsTemperature)}`);
  console.log(`  Top-P:              ${boolStr(model.capabilities.supportsTopP)}`);
  console.log(`  Penalties:          ${boolStr(model.capabilities.supportsPenalties)}`);
  console.log(`  Logprobs:           ${boolStr(model.capabilities.supportsLogprobs)}`);

  console.log("\nToken Limits:");
  console.log(`  Max Context Tokens: ${model.capabilities.maxContextTokens.toLocaleString()}`);
  console.log(`  Max Output Tokens:  ${model.capabilities.maxOutputTokens.toLocaleString()}`);

  console.log("\nEndpoint:");
  console.log(`  Type:     ${model.endpoints.type}`);
  console.log(`  Path:     ${ModelRegistry.getEndpointPath(model.modelId)}`);
  console.log(`  Template: ${model.endpoints.pathTemplate}`);
  console.log("");
}

/**
 * Print model -> endpoint path mapping for all registered models.
 */
export function listEndpoints(): void {
  const allIds = ModelRegistry.getAllModelIds();

  console.log("\n=== ENDPOINT MAPPINGS ===\n");
  console.log(
    padRight("Model ID", 55) +
    "Endpoint Path",
  );
  console.log("-".repeat(120));

  for (const id of allIds) {
    try {
      const endpointPath = ModelRegistry.getEndpointPath(id);
      console.log(
        padRight(id, 55) +
        endpointPath,
      );
    } catch {
      console.log(
        padRight(id, 55) +
        "(error resolving endpoint)",
      );
    }
  }

  console.log(`\nTotal: ${allIds.length} models\n`);
}

// ============================================================
// Formatting helpers
// ============================================================

/** Pad a string to the right with spaces. */
function padRight(str: string, width: number): string {
  return str.padEnd(width);
}

/** Format a boolean as a visual indicator. */
function indicator(value: boolean): string {
  return value ? "[Y]" : "[ ]";
}

/** Format a boolean as "Yes" or "No" with padding. */
function boolStr(value: boolean): string {
  return value ? " Yes" : " No";
}
