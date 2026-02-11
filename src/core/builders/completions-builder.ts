// Completions Request Builder - Fluent builder for legacy completions requests
// Port of CompletionsBuilder.cs

import type { CompletionsRequest } from "../models/types.js";
import {
  getRandomTopic,
  getRandomLanguage,
} from "../data/data-sources.js";
import { generateCompletionPrompt } from "../data/content-generator.js";
import { toJson } from "../utils.js";

const GENERATOR_VERSION = "1.0.0";

/**
 * Fluent builder for constructing OpenAI-compatible legacy completions requests.
 *
 * Supports auto-generation of prompts based on topic and language,
 * and provides fine-grained control over all completions parameters.
 */
export class CompletionsBuilder {
  private request: CompletionsRequest;
  private _topic?: string;
  private _language?: string;
  private _skipMetadata = true;

  constructor() {
    this.request = {
      model: "gpt-3.5-turbo-instruct",
      prompt: "",
    };
  }

  // ============================================================
  // Configuration methods
  // ============================================================

  /**
   * Set the model identifier.
   */
  model(m: string): this {
    this.request.model = m;
    return this;
  }

  /**
   * Set the prompt text directly.
   */
  prompt(p: string): this {
    this.request.prompt = p;
    return this;
  }

  /**
   * Set the topic for auto-generated prompts.
   */
  topic(t: string): this {
    this._topic = t;
    return this;
  }

  /**
   * Set the language for auto-generated prompts.
   */
  language(l: string): this {
    this._language = l;
    return this;
  }

  /**
   * Set the max_tokens parameter.
   */
  maxTokens(n: number): this {
    this.request.max_tokens = n;
    return this;
  }

  /**
   * Set the temperature parameter.
   */
  temperature(t: number): this {
    this.request.temperature = t;
    return this;
  }

  /**
   * Enable or disable streaming.
   */
  streaming(s = true): this {
    this.request.stream = s;
    return this;
  }

  /**
   * Control whether metadata is skipped in the output.
   */
  skipMetadataFlag(skip = true): this {
    this._skipMetadata = skip;
    return this;
  }

  // ============================================================
  // Generation
  // ============================================================

  /**
   * Generate the complete completions request.
   * If no prompt is set, auto-generates one from topic and language.
   */
  generate(): CompletionsRequest {
    // Auto-generate prompt if not explicitly set
    if (!this.request.prompt) {
      const topic = this._topic ?? getRandomTopic();
      const language = this._language ?? getRandomLanguage();
      this.request.prompt = generateCompletionPrompt(topic, language);
    }

    // Add metadata if not skipped
    if (!this._skipMetadata) {
      this.request._metadata = {
        generated_at: new Date().toISOString(),
        generator_version: GENERATOR_VERSION,
        model: this.request.model,
      };
    }

    return this.request;
  }

  /**
   * Serialize the generated request to JSON.
   */
  toJson(indented = true): string {
    return toJson(this.request, indented);
  }
}
