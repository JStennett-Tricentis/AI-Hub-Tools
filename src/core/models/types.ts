// Type definitions for AI Hub Request Generator

// ============================================================
// Enums
// ============================================================

export enum ModelType {
  Chat = "chat",
  Completion = "completion",
  Embedding = "embedding",
}

export enum ComplexityLevel {
  Simple = "simple",
  Medium = "medium",
  Complex = "complex",
  Stress = "stress",
}

export enum EndpointType {
  OpenAICompatible = "openai-compatible",
  ModelInvoke = "model-invoke",
  Custom = "custom",
}

export enum RequestEndpoint {
  Chat = "chat",
  Completions = "completions",
  Embeddings = "embeddings",
  Invoke = "invoke",
  InvokeStream = "invoke-stream",
}

export enum VisionFormat {
  Standard = "standard",
  Hub = "hub",
}

// ============================================================
// Model System
// ============================================================

export interface ModelCapabilities {
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsSystemMessage: boolean;
  supportsParallelToolCalls: boolean;
  supportsTemperature: boolean;
  supportsTopP: boolean;
  supportsPenalties: boolean;
  supportsLogprobs: boolean;
  maxContextTokens: number;
  maxOutputTokens: number;
}

export interface EndpointConfiguration {
  type: EndpointType;
  pathTemplate: string;
  requiresSpecialHeaders?: boolean;
}

export interface ModelConfiguration {
  modelId: string;
  provider: string;
  type: ModelType;
  capabilities: ModelCapabilities;
  endpoints: EndpointConfiguration;
}

// ============================================================
// Request DTOs (OpenAI-compatible)
// ============================================================

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: string | { url: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | ContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: FunctionCall;
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface Tool {
  type: "function";
  function: FunctionDefinition;
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatCompletionsRequest {
  description?: string;
  model: string;
  messages: ChatMessage[];
  tools?: Tool[];
  tool_choice?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  parallel_tool_calls?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  logprobs?: boolean;
  top_logprobs?: number;
  seed?: number;
  _metadata?: Record<string, unknown>;
}

export interface CompletionsRequest {
  description?: string;
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  logprobs?: number;
  echo?: boolean;
  stop?: string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  best_of?: number;
  suffix?: string;
  _metadata?: Record<string, unknown>;
}

export interface EmbeddingRequest {
  description?: string;
  model: string;
  input: string | string[];
  encoding_format?: string;
  dimensions?: number;
  user?: string;
  _metadata?: Record<string, unknown>;
}

export interface BedrockTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface BedrockInvokeRequest {
  anthropic_version?: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  system?: string;
  tools?: BedrockTool[];
}

// ============================================================
// Profile & Template Configuration
// ============================================================

export interface ProfileDefaults {
  turns?: number;
  includeTools?: boolean;
  toolCount?: number;
  includeSystemPrompt?: boolean;
  topic?: string;
  temperature?: number;
  maxTokens?: number;
  parallelToolCalls?: boolean;
  stream?: boolean;
}

export interface MessageTemplate {
  role: string;
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ProfileConfiguration {
  name: string;
  description: string;
  defaults?: ProfileDefaults;
  message_sequence?: MessageTemplate[];
  tool_definitions?: Tool[];
  examples?: string[];
}

// ============================================================
// Generator Options (CLI / API Input)
// ============================================================

export interface GeneratorOptions {
  // Generation mode
  complexity: string;
  profile?: string;
  template?: string;

  // Content
  turns?: number;
  topic?: string;
  language?: string;
  domain?: string;
  tools?: number;
  prompt?: string;

  // Model
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream: boolean;

  // Output
  output?: string;
  compact: boolean;
  noTimestamp: boolean;
  copy: boolean;

  // Endpoint
  endpoint?: string;
  useCompletions: boolean;
  useEmbeddings: boolean;

  // Embedding-specific
  input?: string;
  textCount?: number;
  encodingFormat?: string;
  dimensions?: number;

  // Special modes
  toscaCompatible: boolean;
  toolsOnly: boolean;
  screenshots?: number;
  screenshotSizeKb: number;

  // Stashed features
  imagesOnly: boolean;
  strict: boolean;
  hubFormat: boolean;

  // Internal - pre-loaded data (set by CLI/API before passing to generator)
  _loadedProfile?: ProfileConfiguration;
  _loadedTemplate?: ChatCompletionsRequest;
}

export function createDefaultOptions(): GeneratorOptions {
  return {
    complexity: "medium",
    model: "gpt-4o-2024-05-13",
    stream: false,
    compact: false,
    noTimestamp: false,
    copy: false,
    useCompletions: false,
    useEmbeddings: false,
    toscaCompatible: false,
    toolsOnly: false,
    screenshotSizeKb: 50,
    imagesOnly: false,
    strict: false,
    hubFormat: false,
  };
}

// ============================================================
// Generator Output
// ============================================================

export interface GeneratorResult {
  json: string;
  endpointType: string;
}
