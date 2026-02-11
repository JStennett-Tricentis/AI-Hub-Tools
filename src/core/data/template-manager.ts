// Template manager for AI Hub Request Generator
// Port of tool argument/response generation from TemplateManager.cs

import { getFileExtension } from "./content-generator.js";

// ============================================================
// Tool Arguments Generation
// ============================================================

/**
 * Generates realistic JSON arguments for a given tool invocation.
 * When toscaCompatible is true, the result is double-wrapped JSON
 * (JSON.stringify applied twice) for Tosca interoperability.
 */
export function generateToolArguments(
  toolName: string,
  language: string,
  toscaCompatible: boolean = false,
): string {
  const ext = getFileExtension(language);
  let args: Record<string, unknown>;

  switch (toolName) {
    case "search_codebase":
      args = {
        query: "authentication middleware",
        file_type: ext,
        case_sensitive: false,
      };
      break;

    case "analyze_performance":
      args = {
        code: `import time\n\ndef slow_function():\n    time.sleep(2)\n    return sum(range(1000000))`,
        language: language.toLowerCase(),
        metrics: ["cpu", "memory"],
      };
      break;

    case "execute_database_query":
      args = {
        query: "SELECT * FROM users WHERE active = true ORDER BY created_at DESC LIMIT 100",
        database: "production_db",
        read_only: true,
      };
      break;

    case "deploy_service":
      args = {
        service_name: "auth-service",
        environment: "staging",
        version: "2.1.0",
      };
      break;

    case "get_api_metrics":
      args = {
        endpoint: "/api/v1/users",
        metrics: ["latency", "throughput", "error_rate"],
      };
      break;

    case "analyze_code_security":
      args = {
        code: `app.get("/user", (req, res) => {\n  const id = req.query.id;\n  db.query("SELECT * FROM users WHERE id = " + id);\n});`,
        language: language.toLowerCase(),
        check_types: ["sql_injection", "xss"],
      };
      break;

    case "generate_secure_code":
      args = {
        vulnerable_code: `query = "SELECT * FROM users WHERE name = '" + user_input + "'"`,
        vulnerability_type: "sql_injection",
        language: language.toLowerCase(),
      };
      break;

    case "run_tests":
      args = {
        test_suite: `tests/unit/services/auth.test.${ext}`,
        test_type: "unit",
      };
      break;

    case "check_logs":
      args = {
        service: "api-gateway",
        level: "error",
        time_range: "1h",
      };
      break;

    case "monitor_metrics":
      args = {
        metric_name: "api_response_time_ms",
        threshold: 500,
        duration: "15m",
      };
      break;

    default:
      args = {};
      break;
  }

  const json = JSON.stringify(args);
  return toscaCompatible ? JSON.stringify(json) : json;
}

// ============================================================
// Tool Response Generation
// ============================================================

/**
 * Generates a realistic JSON response for a given tool invocation.
 * When toscaCompatible is true, the result is double-wrapped JSON.
 */
export function generateToolResponse(
  toolName: string,
  toscaCompatible: boolean = false,
): string {
  let response: Record<string, unknown>;

  switch (toolName) {
    case "search_codebase":
      response = {
        matches: 15,
        files: [
          "src/middleware/auth.ts",
          "src/services/auth-service.ts",
          "src/routes/auth-routes.ts",
        ],
        preview: "Found authentication middleware with JWT validation",
      };
      break;

    case "analyze_performance":
      response = {
        bottlenecks: [
          { location: "line 4", issue: "Blocking sleep call", severity: "high" },
          { location: "line 5", issue: "Inefficient range sum", severity: "medium" },
        ],
        cpu_usage: "78%",
        memory_usage: "245MB",
        recommendations: [
          "Replace sleep with async wait",
          "Use math formula for range sum",
        ],
      };
      break;

    case "execute_database_query":
      response = {
        rows_returned: 142,
        execution_time_ms: 23,
        status: "success",
        columns: ["id", "name", "email", "active", "created_at"],
      };
      break;

    case "deploy_service":
      response = {
        status: "success",
        deployment_id: "deploy-a1b2c3d4",
        environment: "staging",
        version: "2.1.0",
        timestamp: "2025-01-15T10:30:00Z",
        health_check: "passing",
      };
      break;

    case "get_api_metrics":
      response = {
        endpoint: "/api/v1/users",
        period: "last_24h",
        latency: { avg_ms: 245, p95_ms: 680, p99_ms: 850 },
        throughput: { requests_per_second: 1250 },
        error_rate: 0.002,
        status_codes: { "200": 98.5, "400": 0.8, "500": 0.2, "other": 0.5 },
      };
      break;

    case "analyze_code_security":
      response = {
        vulnerabilities: [
          {
            type: "sql_injection",
            severity: "critical",
            line: 3,
            description: "User input directly concatenated into SQL query",
            recommendation: "Use parameterized queries",
          },
          {
            type: "xss",
            severity: "medium",
            line: 2,
            description: "Unescaped query parameter in response",
            recommendation: "Sanitize and escape user input",
          },
        ],
        risk_score: 8.5,
        scan_duration_ms: 150,
      };
      break;

    case "generate_secure_code":
      response = {
        secure_code: 'query = "SELECT * FROM users WHERE name = %s"\ncursor.execute(query, (user_input,))',
        changes: [
          "Replaced string concatenation with parameterized query",
          "Added input parameter binding",
        ],
        vulnerability_fixed: "sql_injection",
      };
      break;

    case "run_tests":
      response = {
        total: 156,
        passed: 156,
        failed: 0,
        skipped: 0,
        duration_ms: 4523,
        coverage: 87.3,
        status: "all_passed",
      };
      break;

    case "check_logs":
      response = {
        total_entries: 23,
        level: "error",
        time_range: "1h",
        entries: [
          {
            timestamp: "2025-01-15T10:25:00Z",
            message: "Connection timeout to database",
            service: "api-gateway",
          },
          {
            timestamp: "2025-01-15T10:18:00Z",
            message: "Rate limit exceeded for client X",
            service: "api-gateway",
          },
        ],
      };
      break;

    case "monitor_metrics":
      response = {
        metric_name: "api_response_time_ms",
        current_value: 245,
        threshold: 500,
        status: "healthy",
        trend: "stable",
        data_points: [230, 245, 238, 252, 241],
      };
      break;

    default:
      response = { status: "success", message: "Operation completed successfully" };
      break;
  }

  const json = JSON.stringify(response);
  return toscaCompatible ? JSON.stringify(json) : json;
}
