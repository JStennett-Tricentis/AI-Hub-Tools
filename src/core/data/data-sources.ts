// Data sources for AI Hub Request Generator
// Port of DataSourceManager.cs - Topics, Languages, Domains, and related data

// ============================================================
// Data Arrays
// ============================================================

const TOPICS: readonly string[] = [
  "software architecture",
  "database optimization",
  "API design",
  "cloud infrastructure",
  "machine learning",
  "cybersecurity",
  "DevOps practices",
  "microservices",
  "code refactoring",
  "performance tuning",
  "testing strategies",
  "CI/CD pipelines",
  "data structures",
  "algorithms",
  "system design",
  "scalability patterns",
];

const LANGUAGES: readonly string[] = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Java",
  "C#",
  "Go",
  "Rust",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "Scala",
  "Elixir",
  "SQL",
];

const DOMAINS: readonly string[] = [
  "e-commerce platform",
  "financial services",
  "healthcare system",
  "logistics management",
  "social media platform",
  "IoT platform",
  "enterprise resource planning",
  "customer relationship management",
];

const TASKS: readonly string[] = [
  "debug a memory leak",
  "optimize database queries",
  "implement caching",
  "design RESTful API",
  "refactor legacy code",
  "write unit tests",
  "configure monitoring",
  "setup CI/CD pipeline",
  "migrate to microservices",
  "implement authentication",
  "optimize API response time",
  "handle concurrency",
];

const VULNERABILITIES: readonly string[] = [
  "sql_injection",
  "xss",
  "csrf",
  "path_traversal",
  "command_injection",
  "xxe",
  "ssrf",
  "deserialization",
  "buffer_overflow",
  "race_condition",
];

// ============================================================
// Helper
// ============================================================

/**
 * Selects a random element from an array.
 */
export function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// Public Accessors
// ============================================================

/** Returns a random topic. */
export function getRandomTopic(): string {
  return randomChoice(TOPICS);
}

/** Returns a random programming language. */
export function getRandomLanguage(): string {
  return randomChoice(LANGUAGES);
}

/** Returns a random business domain. */
export function getRandomDomain(): string {
  return randomChoice(DOMAINS);
}

/** Returns a random development task. */
export function getRandomTask(): string {
  return randomChoice(TASKS);
}

/** Returns a random vulnerability type. */
export function getRandomVulnerability(): string {
  return randomChoice(VULNERABILITIES);
}
