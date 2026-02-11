# AI Hub Tools - Performance Request Generator

Generates realistic OpenAI-compatible JSON request payloads for testing AI Hub services. Supports chat completions, legacy completions, embeddings, Bedrock invoke, and Bedrock invoke-stream endpoints.

## Quick Start

```bash
npm install
npm run dev                         # Generate a default medium-complexity request
npm run dev -- -x simple            # Simple single-turn request
npm run dev -- -x complex --tools 3 # Complex request with 3 tools
npm run dev -- --embeddings         # Embedding request
```

## Web UI

```bash
npm run dev:api                     # Start server on port 3500
```

Open <http://localhost:3500> in your browser. The web UI provides:

- **Quick Start** presets for profiles, templates, and 8 example scenarios
- **Endpoint tabs** for Chat Completions, Legacy Completions, Embeddings, Bedrock Invoke, and Bedrock Invoke Stream
- **Model picker** grouped by type with capability badges and token limits
- **Generation settings** for complexity, turns, tools, topic, language, and domain
- **Model parameters** with temperature slider, max tokens, and stream toggle
- **Embedding options** for input texts, text count, dimensions, and encoding format
- **Special modes** for Tosca, tools-only, screenshots, images-only, strict, and hub format
- **Output panel** with syntax-highlighted JSON, copy/download, generation summary, and validation warnings
- **Batch generation** to produce multiple requests at once

## CLI Usage

```bash
# Basic generation
ai-hub-generate                                    # Default: medium chat request
ai-hub-generate -x simple                          # Simple: 1 turn, no tools
ai-hub-generate -x complex                         # Complex: 6 turns, 3 tools
ai-hub-generate -x stress                          # Stress: 20 turns, 5 tools

# Content options
ai-hub-generate --topic "microservices" --lang Python
ai-hub-generate -n 5 --domain "healthcare"
ai-hub-generate -t 4                               # Include 4 tools

# Model options
ai-hub-generate -m gpt-4o-mini-2024-07-18
ai-hub-generate --temperature 0.3 --max-tokens 2000
ai-hub-generate --stream

# Endpoint types
ai-hub-generate                                    # Chat completions (default)
ai-hub-generate --completions --prompt "Write a function"
ai-hub-generate --embeddings -i "text1,text2,text3"
ai-hub-generate -E invoke                          # Bedrock invoke format
ai-hub-generate -E invoke-stream                   # Bedrock invoke streaming format

# Profiles (predefined configurations)
ai-hub-generate -p simple
ai-hub-generate -p maestro
ai-hub-generate -p security

# Templates (full request templates with messages and tools)
ai-hub-generate -T simple-question
ai-hub-generate -T test-generation
ai-hub-generate -T performance-optimization

# Output options
ai-hub-generate -o request.json                    # Save to file
ai-hub-generate -o                                 # Save with auto-generated filename
ai-hub-generate -y                                 # Copy to clipboard
ai-hub-generate --compact                          # Single-line JSON

# Special modes
ai-hub-generate --tosca-compatible                 # Double-wrapped JSON for Tosca
ai-hub-generate --tools-only                       # Tool definitions only
ai-hub-generate -S 3 --screenshot-size 100         # Add 3 screenshots (100KB each)

# Model information
ai-hub-generate --list-models                      # List all supported models
ai-hub-generate --model-info gpt-4o-2024-05-13     # Detailed model info
ai-hub-generate --list-endpoints                   # Show endpoint mappings
```

## API Server

```bash
npm run dev:api                    # Start API server on port 3500
```

### Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/` | Web UI |
| POST | `/api/generate` | Generate a request payload |
| GET | `/api/models` | List all models by type |
| GET | `/api/models/:id` | Get model details |
| GET | `/api/endpoints` | List endpoint mappings |
| GET | `/api/profiles` | List available profiles |
| GET | `/api/profiles/:name` | Get profile configuration |
| GET | `/api/templates` | List available templates |
| GET | `/api/templates/:name` | Get template content |
| GET | `/health` | Health check |

### Generate Request Examples

```bash
# Chat completions
curl -X POST http://localhost:3500/api/generate \
  -H "Content-Type: application/json" \
  -d '{"complexity": "complex", "tools": 3, "topic": "microservices"}'

# Bedrock invoke
curl -X POST http://localhost:3500/api/generate \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "invoke", "model": "us.anthropic.claude-sonnet-4-20250514-v1:0"}'

# Bedrock invoke-stream (same request body, different endpoint route)
curl -X POST http://localhost:3500/api/generate \
  -H "Content-Type: application/json" \
  -d '{"endpoint": "invoke-stream", "model": "us.anthropic.claude-sonnet-4-20250514-v1:0"}'
```

## Endpoint Types

| Endpoint | CLI Flag | Route Template | Request Format |
| -------- | -------- | -------------- | -------------- |
| Chat Completions | `-E chat` (default) | `/api/v1/hub-service/openai/deployments/{model}/chat/completions` | OpenAI ChatCompletionsRequest |
| Legacy Completions | `-E completions` | `/api/v1/hub-service/openai/deployments/{model}/completions` | OpenAI CompletionsRequest |
| Embeddings | `-E embeddings` | `/api/v1/hub-service/openai/deployments/{model}/embeddings` | OpenAI EmbeddingRequest |
| Bedrock Invoke | `-E invoke` | `/api/v1/hub-service/model/{model}/invoke` | Anthropic Messages API (BedrockInvokeRequest) |
| Bedrock Invoke Stream | `-E invoke-stream` | `/api/v1/hub-service/model/{model}/invoke-with-response-stream` | Anthropic Messages API (BedrockInvokeRequest) |

The `invoke` and `invoke-stream` endpoints share the same request body format. The only difference is the route and response format (buffered JSON vs. event stream).

## Profiles

Predefined configurations in `data/profiles/`:

| Profile | Turns | Tools | Description |
| ------- | ----- | ----- | ----------- |
| simple | 1 | No | Single-turn, no tools |
| medium | 3 | No | Multi-turn conversation |
| complex | 6 | Yes (3) | Multi-turn with tools |
| stress | 20 | Yes (5) | High-volume stress test |
| security | 6 | Yes (3) | Security-focused tools |
| performance | 6 | Yes (3) | Performance testing |
| migration | 6 | Yes (4) | Data migration workflows |
| maestro | 150 | Yes (10) | Maestro/VisionAI agent (1MB+ requests) |
| qtest | 2 | No | qTest test case generation |

## Templates

Full request templates in `data/templates/`:

- `simple-question` - Single-turn question
- `test-generation` - Test suite generation with tools
- `performance-optimization` - Performance analysis workflow
- `data-migration` - Data migration conversation
- `devops-deployment` - DevOps deployment workflow
- `multi-turn-security-analysis` - Security analysis with tools
- `qtest-testcase-generation` - qTest test case generation

## Supported Models

21 models across 3 categories:

- **Chat Models (17)**: GPT-4o, GPT-4.1, GPT-5, O1, O4-mini, Claude Sonnet, SAP models
- **Completion Models (3)**: GPT-3.5 Turbo variants
- **Embedding Models (2)**: text-embedding-ada-002, text-embedding-3-small

Run `ai-hub-generate --list-models` for the full list with capabilities.

## Project Structure

```text
public/
  index.html                    # Web UI
  css/style.css                 # Dark theme styles
  js/app.js                     # Client-side application logic
src/
  index.ts                      # CLI entry point
  cli/
    argument-parser.ts          # Commander.js argument parsing
    cli-handler.ts              # Info commands (list-models, etc.)
    clipboard.ts                # Clipboard integration
    file-output.ts              # File output with timestamps
    screenshot-injector.ts      # Screenshot injection into requests
  api/
    server.ts                   # Express API server + static file serving
    routes/
      generate.ts               # POST /api/generate
      models.ts                 # GET /api/models
      profiles.ts               # GET /api/profiles, /api/templates
  core/
    models/
      types.ts                  # TypeScript interfaces and enums
      model-registry.ts         # Model configurations and capabilities
    builders/
      chat-request-builder.ts   # Fluent builder for chat requests
      completions-builder.ts    # Fluent builder for completions
      embedding-builder.ts      # Fluent builder for embeddings
      bedrock-invoke-builder.ts # Bedrock Anthropic format converter
    generator/
      request-generator.ts      # Main generation orchestrator
      builder-config.ts         # Options-to-builder configuration
      output-formatter.ts       # Generation summary and validation
    data/
      data-sources.ts           # Topics, languages, domains
      content-generator.ts      # Message and prompt generation
      tool-definitions.ts       # Tool schemas and factories
      template-manager.ts       # Tool argument/response generation
    validation/
      request-validator.ts      # Capability validation and auto-adjustment
    utils.ts                    # JSON serialization utilities
  loaders/
    profile-loader.ts           # Profile JSON file loader
    template-loader.ts          # Template JSON file loader
data/
  profiles/                     # Profile JSON configurations
  templates/                    # Template JSON request files
tests/
  unit/                         # Vitest unit tests
```

## Development

```bash
npm install                     # Install dependencies
npm test                        # Run tests
npm run test:watch              # Watch mode
npm run build                   # Build CLI and API
```

### Linting

```bash
npm run lint                    # ESLint on src/
npm run lint:md                 # Markdownlint on all .md files
npm run lint:all                # Both ESLint + markdownlint
```

### Formatting

```bash
npm run format                  # Format TypeScript, JS, CSS, HTML with Prettier
npm run format:check            # Check formatting without writing
npm run format:json             # Format JSON data files (profiles, templates)
npm run format:json:check       # Check JSON formatting without writing
npm run format:all              # Format everything
```

### Full Check

```bash
npm run check                   # Lint + format check + tests (CI-ready)
```

## Build

```bash
npm run build                   # Builds dist/index.js and dist/api/server.js
npm start                       # Run built CLI
npm run start:api               # Run built API server
```
