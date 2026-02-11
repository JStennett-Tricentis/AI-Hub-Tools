// Embedding Request Builder - Fluent builder for embedding requests
// Port of EmbeddingBuilder.cs

import type { EmbeddingRequest } from "../models/types.js";
import {
  getRandomTopic,
  getRandomDomain,
} from "../data/data-sources.js";
import { toJson } from "../utils.js";

const GENERATOR_VERSION = "1.0.0";

/**
 * Templates for generating embedding input texts.
 * Each template supports {topic} and {domain} interpolation.
 */
const TEXT_TEMPLATES: string[] = [
  "Explain the concept of {topic} in the context of {domain}.",
  "What are the key principles behind {topic} as applied to {domain}?",
  "Describe the relationship between {topic} and modern {domain} practices.",
  "How does {topic} impact decision-making in {domain}?",
  "Summarize the current state of {topic} within the {domain} industry.",
  "Compare different approaches to {topic} used in {domain}.",
  "What challenges arise when implementing {topic} in {domain}?",
  "Provide an overview of {topic} best practices for {domain} professionals.",
  "Analyze the future trends of {topic} in the {domain} sector.",
  "Discuss the ethical considerations of {topic} in {domain} applications.",
];

/**
 * Fluent builder for constructing OpenAI-compatible embedding requests.
 *
 * Supports complexity presets (simple, medium, complex, stress) for
 * controlling the number of input texts, auto-generation of embedding
 * texts from templates, and fine-grained control over all parameters.
 */
export class EmbeddingBuilder {
  private request: EmbeddingRequest;
  private _texts: string[] = [];
  private _textCount = 1;
  private _topic?: string;
  private _domain?: string;
  private _skipMetadata = true;

  constructor() {
    this.request = {
      model: "text-embedding-ada-002",
      input: "",
    };
  }

  // ============================================================
  // Complexity presets
  // ============================================================

  /**
   * Configure for a simple embedding request: single text input.
   */
  simple(): this {
    this._textCount = 1;
    return this;
  }

  /**
   * Configure for a medium complexity embedding request: 5 text inputs.
   */
  medium(count = 5): this {
    this._textCount = count;
    return this;
  }

  /**
   * Configure for a complex embedding request: 20 text inputs.
   */
  complex(count = 20): this {
    this._textCount = count;
    return this;
  }

  /**
   * Configure for a stress test embedding request: 100 text inputs.
   */
  stressTest(count = 100): this {
    this._textCount = count;
    return this;
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
   * Set the input text(s) directly. Accepts a single string or an array of strings.
   */
  input(text: string | string[]): this {
    if (Array.isArray(text)) {
      this._texts = [...text];
    } else {
      this._texts = [text];
    }
    return this;
  }

  /**
   * Set the topic for auto-generated texts.
   */
  topic(t: string): this {
    this._topic = t;
    return this;
  }

  /**
   * Set the domain for auto-generated texts.
   */
  domain(d: string): this {
    this._domain = d;
    return this;
  }

  /**
   * Set the number of texts to auto-generate.
   */
  textCount(n: number): this {
    this._textCount = n;
    return this;
  }

  /**
   * Set the encoding format (e.g., "float", "base64").
   */
  encodingFormat(f: string): this {
    this.request.encoding_format = f;
    return this;
  }

  /**
   * Set the desired embedding dimensions.
   */
  dimensions(d: number): this {
    this.request.dimensions = d;
    return this;
  }

  /**
   * Set the description field on the request.
   */
  description(d: string): this {
    this.request.description = d;
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
   * Generate the complete embedding request.
   *
   * Priority for input selection:
   * 1. If texts were manually set via input(), use those
   * 2. Otherwise auto-generate texts based on textCount, topic, and domain
   *
   * Single text results in a string input; multiple texts result in an array input.
   */
  generate(): EmbeddingRequest {
    let texts: string[];

    if (this._texts.length > 0) {
      // Use manually provided texts
      texts = this._texts;
    } else {
      // Auto-generate texts
      texts = [];
      for (let i = 0; i < this._textCount; i++) {
        texts.push(this.generateText(i));
      }
    }

    // Single text = string input, multiple = array
    if (texts.length === 1) {
      this.request.input = texts[0];
    } else {
      this.request.input = texts;
    }

    // Add metadata if not skipped
    if (!this._skipMetadata) {
      this.request._metadata = {
        generated_at: new Date().toISOString(),
        generator_version: GENERATOR_VERSION,
        text_count: texts.length,
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

  // ============================================================
  // Private methods
  // ============================================================

  /**
   * Generate a single embedding text using templates with topic/domain interpolation.
   */
  private generateText(index: number): string {
    const topic = this._topic ?? getRandomTopic();
    const domain = this._domain ?? getRandomDomain();
    const template = TEXT_TEMPLATES[index % TEXT_TEMPLATES.length];

    return template
      .replace("{topic}", topic)
      .replace("{domain}", domain);
  }
}
