// Tool definitions for AI Hub Request Generator
// Port of Tools.cs from DataSourceManager.cs - tool creation methods

import type { Tool } from "../models/types.js";

// ============================================================
// Tool Names
// ============================================================

export const TOOL_NAMES: string[] = [
  "search_codebase",
  "analyze_performance",
  "execute_database_query",
  "deploy_service",
  "get_api_metrics",
  "analyze_code_security",
  "generate_secure_code",
  "run_tests",
  "check_logs",
  "monitor_metrics",
];

// ============================================================
// Random Selection
// ============================================================

/** Returns a random subset of tool names. */
export function getRandomToolNames(count: number): string[] {
  const shuffled = [...TOOL_NAMES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, TOOL_NAMES.length));
}

/** Returns a random subset of fully-defined tools. */
export function getRandomTools(count: number): Tool[] {
  const allTools = getAllTools();
  const shuffled = [...allTools].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, allTools.length));
}

// ============================================================
// Individual Tool Factory Functions
// ============================================================

/** Search through code files by pattern or keyword. */
export function createSearchCodebaseTool(): Tool {
  return {
    type: "function",
    function: {
      name: "search_codebase",
      description: "Search through code files by pattern or keyword",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query string",
          },
          file_type: {
            type: "string",
            description: "File extension filter",
          },
          case_sensitive: {
            type: "boolean",
            description: "Whether the search is case sensitive",
          },
        },
        required: ["query"],
      },
    },
  };
}

/** Analyze code performance and identify bottlenecks. */
export function createAnalyzePerformanceTool(): Tool {
  return {
    type: "function",
    function: {
      name: "analyze_performance",
      description: "Analyze code performance and identify bottlenecks",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "Code to analyze",
          },
          language: {
            type: "string",
            enum: ["python", "javascript", "typescript", "java", "csharp", "go", "rust"],
            description: "Programming language of the code",
          },
          metrics: {
            type: "array",
            items: {
              type: "string",
              enum: ["cpu", "memory", "io", "network", "all"],
            },
            description: "Performance metrics to analyze",
          },
        },
        required: ["code", "language", "metrics"],
      },
    },
  };
}

/** Execute SQL query against database. */
export function createExecuteDatabaseQueryTool(): Tool {
  return {
    type: "function",
    function: {
      name: "execute_database_query",
      description: "Execute SQL query against database",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "SQL query to execute",
          },
          database: {
            type: "string",
            description: "Target database name",
          },
          read_only: {
            type: "boolean",
            description: "Whether to execute in read-only mode",
          },
        },
        required: ["query", "database"],
      },
    },
  };
}

/** Deploy service to specified environment. */
export function createDeployServiceTool(): Tool {
  return {
    type: "function",
    function: {
      name: "deploy_service",
      description: "Deploy service to specified environment",
      parameters: {
        type: "object",
        properties: {
          service_name: {
            type: "string",
            description: "Name of service to deploy",
          },
          environment: {
            type: "string",
            enum: ["dev", "staging", "production"],
            description: "Target deployment environment",
          },
          version: {
            type: "string",
            description: "Version to deploy",
          },
        },
        required: ["service_name", "environment", "version"],
      },
    },
  };
}

/** Retrieve API performance metrics. */
export function createGetApiMetricsTool(): Tool {
  return {
    type: "function",
    function: {
      name: "get_api_metrics",
      description: "Retrieve API performance metrics",
      parameters: {
        type: "object",
        properties: {
          endpoint: {
            type: "string",
            description: "API endpoint path",
          },
          metrics: {
            type: "array",
            items: {
              type: "string",
              enum: ["latency", "throughput", "error_rate", "status_codes", "all"],
            },
            description: "Metrics to retrieve",
          },
        },
        required: ["endpoint", "metrics"],
      },
    },
  };
}

/** Scan code for security vulnerabilities. */
export function createAnalyzeCodeSecurityTool(): Tool {
  return {
    type: "function",
    function: {
      name: "analyze_code_security",
      description: "Scan code for security vulnerabilities",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "Code to scan for vulnerabilities",
          },
          language: {
            type: "string",
            enum: ["python", "javascript", "typescript", "java", "csharp", "go", "rust"],
            description: "Programming language of the code",
          },
          check_types: {
            type: "array",
            items: {
              type: "string",
              enum: ["sql_injection", "xss", "csrf", "path_traversal", "command_injection", "all"],
            },
            description: "Types of vulnerabilities to check",
          },
        },
        required: ["code", "language"],
      },
    },
  };
}

/** Generate secure code snippet with best practices. */
export function createGenerateSecureCodeTool(): Tool {
  return {
    type: "function",
    function: {
      name: "generate_secure_code",
      description: "Generate secure code snippet with best practices",
      parameters: {
        type: "object",
        properties: {
          vulnerable_code: {
            type: "string",
            description: "The vulnerable code to fix",
          },
          vulnerability_type: {
            type: "string",
            description: "Type of vulnerability to address",
          },
          language: {
            type: "string",
            enum: ["python", "javascript", "typescript", "java", "csharp", "go", "rust"],
            description: "Programming language for the secure code",
          },
        },
        required: ["vulnerable_code", "vulnerability_type", "language"],
      },
    },
  };
}

/** Execute test suite with specified options. */
export function createRunTestsTool(): Tool {
  return {
    type: "function",
    function: {
      name: "run_tests",
      description: "Execute test suite with specified options",
      parameters: {
        type: "object",
        properties: {
          test_suite: {
            type: "string",
            description: "Name or path of the test suite to run",
          },
          test_type: {
            type: "string",
            enum: ["unit", "integration", "e2e", "all"],
            description: "Type of tests to execute",
          },
        },
        required: ["test_suite"],
      },
    },
  };
}

/** Search and analyze application logs. */
export function createCheckLogsTool(): Tool {
  return {
    type: "function",
    function: {
      name: "check_logs",
      description: "Search and analyze application logs",
      parameters: {
        type: "object",
        properties: {
          service: {
            type: "string",
            description: "Service name to check logs for",
          },
          level: {
            type: "string",
            enum: ["debug", "info", "warn", "error"],
            description: "Log level filter",
          },
          time_range: {
            type: "string",
            description: "Time range to search (e.g. 1h, 24h, 7d)",
          },
        },
        required: ["service"],
      },
    },
  };
}

/** Monitor system and application metrics. */
export function createMonitorMetricsTool(): Tool {
  return {
    type: "function",
    function: {
      name: "monitor_metrics",
      description: "Monitor system and application metrics",
      parameters: {
        type: "object",
        properties: {
          metric_name: {
            type: "string",
            description: "Name of the metric to monitor",
          },
          threshold: {
            type: "number",
            description: "Threshold value for alerts",
          },
          duration: {
            type: "string",
            description: "Monitoring duration (e.g. 5m, 1h, 24h)",
          },
        },
        required: ["metric_name", "threshold"],
      },
    },
  };
}

// ============================================================
// Internal: Get all tools in order
// ============================================================

function getAllTools(): Tool[] {
  return [
    createSearchCodebaseTool(),
    createAnalyzePerformanceTool(),
    createExecuteDatabaseQueryTool(),
    createDeployServiceTool(),
    createGetApiMetricsTool(),
    createAnalyzeCodeSecurityTool(),
    createGenerateSecureCodeTool(),
    createRunTestsTool(),
    createCheckLogsTool(),
    createMonitorMetricsTool(),
  ];
}
