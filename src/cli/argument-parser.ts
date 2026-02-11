import { Command } from "commander";
import { createDefaultOptions, type GeneratorOptions } from "../core/models/types.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("ai-hub-generate")
    .description("AI Hub Performance Request Generator - generates realistic OpenAI-compatible JSON request payloads")
    .version("1.0.0");

  // Generation mode
  program
    .option("-x, --complexity <level>", "Complexity level: simple, medium, complex, stress", "medium")
    .option("-p, --profile <name>", "Use profile: simple, medium, complex, security, performance, migration, stress, maestro, qtest")
    .option("-T, --template <name>", "Use named template");

  // Content
  program
    .option("-n, --turns <number>", "Number of conversation turns", parseIntArg)
    .option("--topic <topic>", "Topic/subject of conversation")
    .option("--lang, --language <language>", "Programming language (Python, JavaScript, C#, etc.)")
    .option("-d, --domain <domain>", "Business domain context")
    .option("-t, --tools <number>", "Number of tools to include", parseIntArg)
    .option("--prompt <text>", "Prompt text (for legacy completions format)");

  // Model
  program
    .option("-m, --model <id>", "Model to use", "gpt-4o-2024-05-13")
    .option("--temperature <number>", "Temperature (0.0-2.0)", parseFloatArg)
    .option("--max-tokens <number>", "Maximum tokens", parseIntArg)
    .option("--stream [boolean]", "Enable streaming");

  // Output
  program
    .option("-o, --output [path]", "Output file path (default: GeneratedRequests/<filename>.json)")
    .option("--compact", "Output as single-line compact JSON")
    .option("--no-timestamp", "Don't add timestamp to output filename")
    .option("-y, --copy", "Copy output to clipboard");

  // Endpoint
  program
    .option("-E, --endpoint <type>", "Endpoint type: chat, completions, embeddings, invoke, invoke-stream")
    .option("--completions", "Use legacy completions format (alias for --endpoint completions)")
    .option("--embeddings", "Generate embedding request (alias for --endpoint embeddings)");

  // Embedding-specific
  program
    .option("-i, --input <text>", "Input text(s) for embeddings (comma-separated for multiple)")
    .option("--text-count <number>", "Number of texts to generate for embeddings", parseIntArg)
    .option("--encoding-format <format>", "Encoding format for embeddings: float or base64")
    .option("--dimensions <number>", "Number of dimensions for embeddings", parseIntArg);

  // Special modes
  program
    .option("--tosca-compatible", "Enable Tosca-compatible output (double-wrapped JSON)")
    .option("--tosca", "Alias for --tosca-compatible")
    .option("--tools-only", "Generate only tool definitions without conversation messages")
    .option("-S, --screenshots <number>", "Number of screenshots to add to tool responses", parseIntArg)
    .option("--screenshot-size <kb>", "Size of each screenshot in KB", parseIntArg)
    .option("--images-only", "Generate requests with only image content")
    .option("--strict", "Minimal requests with only explicitly requested components")
    .option("--hub-format", "Use Hub format for image_url (direct string instead of nested object)");

  // Info commands
  program
    .option("--list-models", "List all supported models")
    .option("--model-info <id>", "Show detailed model information")
    .option("--list-endpoints", "List endpoint mappings for all models");

  return program;
}

export function parseOptions(program: Command): GeneratorOptions {
  const opts = program.opts();
  const options = createDefaultOptions();

  // Generation mode
  options.complexity = opts.complexity ?? "medium";
  options.profile = opts.profile;
  options.template = opts.template ?? opts.T;

  // Content
  options.turns = opts.turns;
  options.topic = opts.topic;
  options.language = opts.language ?? opts.lang;
  options.domain = opts.domain;
  options.tools = opts.tools;
  options.prompt = opts.prompt;

  // Model
  options.model = opts.model ?? "gpt-4o-2024-05-13";
  options.temperature = opts.temperature;
  options.maxTokens = opts.maxTokens;

  // Stream handling - can be boolean or undefined
  if (opts.stream !== undefined) {
    options.stream = opts.stream === true || opts.stream === "true";
  }

  // Output
  if (opts.output !== undefined) {
    options.output = typeof opts.output === "string" ? opts.output : "request.json";
  }
  options.compact = opts.compact ?? false;
  options.noTimestamp = opts.noTimestamp === false; // commander inverts --no-* flags
  options.copy = opts.copy ?? false;

  // Endpoint
  options.endpoint = opts.endpoint;
  options.useCompletions = opts.completions ?? false;
  options.useEmbeddings = opts.embeddings ?? false;

  // Process endpoint option
  processEndpointOption(options);

  // Embedding-specific
  options.input = opts.input;
  options.textCount = opts.textCount;
  options.encodingFormat = opts.encodingFormat;
  options.dimensions = opts.dimensions;

  // Special modes
  options.toscaCompatible = opts.toscaCompatible ?? opts.tosca ?? false;
  options.toolsOnly = opts.toolsOnly ?? false;
  options.screenshots = opts.screenshots;
  options.screenshotSizeKb = opts.screenshotSize ?? 50;
  options.imagesOnly = opts.imagesOnly ?? false;
  options.strict = opts.strict ?? false;
  options.hubFormat = opts.hubFormat ?? false;

  return options;
}

function processEndpointOption(options: GeneratorOptions): void {
  if (!options.endpoint) return;

  switch (options.endpoint.toLowerCase()) {
    case "chat":
      options.useCompletions = false;
      options.useEmbeddings = false;
      break;
    case "completions":
    case "completion":
      options.useCompletions = true;
      options.useEmbeddings = false;
      break;
    case "embeddings":
    case "embedding":
      options.useCompletions = false;
      options.useEmbeddings = true;
      break;
    case "invoke":
    case "invoke-stream":
      options.useCompletions = false;
      options.useEmbeddings = false;
      break;
    default:
      throw new Error(
        `Invalid endpoint type: ${options.endpoint}. Valid options: chat, completions, embeddings, invoke, invoke-stream`
      );
  }
}

function parseIntArg(value: string): number {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Expected integer, got: ${value}`);
  }
  return parsed;
}

function parseFloatArg(value: string): number {
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Expected number, got: ${value}`);
  }
  return parsed;
}
