// Content generator for AI Hub Request Generator
// Port of TemplateManager.cs - message and content generation

import { randomChoice } from "./data-sources.js";

// ============================================================
// Code Snippets
// ============================================================

export const CODE_SNIPPETS: Record<string, string[]> = {
  python: [
    `def fibonacci(n):
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b`,
    `class DatabaseConnection:
    def __init__(self, host, port, database):
        self.host = host
        self.port = port
        self.database = database
        self._connection = None

    def connect(self):
        if self._connection is None:
            self._connection = self._create_connection()
        return self._connection

    def _create_connection(self):
        return {"host": self.host, "port": self.port, "db": self.database}`,
    `async def fetch_data(url, headers=None):
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as response:
            if response.status == 200:
                return await response.json()
            raise Exception(f"HTTP {response.status}: {await response.text()}")`,
  ],
  csharp: [
    `public class UserService
{
    private readonly IUserRepository _repository;
    private readonly ILogger<UserService> _logger;

    public UserService(IUserRepository repository, ILogger<UserService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<User?> GetByIdAsync(int id)
    {
        _logger.LogInformation("Fetching user {UserId}", id);
        return await _repository.FindByIdAsync(id);
    }
}`,
    `public static class StringExtensions
{
    public static string ToCamelCase(this string str)
    {
        if (string.IsNullOrEmpty(str)) return str;
        var words = str.Split(new[] { '_', '-', ' ' }, StringSplitOptions.RemoveEmptyEntries);
        return words[0].ToLower() + string.Concat(words.Skip(1).Select(w =>
            char.ToUpper(w[0]) + w[1..].ToLower()));
    }
}`,
    `public class RetryPolicy<T>
{
    private readonly int _maxRetries;
    private readonly TimeSpan _delay;

    public RetryPolicy(int maxRetries = 3, TimeSpan? delay = null)
    {
        _maxRetries = maxRetries;
        _delay = delay ?? TimeSpan.FromSeconds(1);
    }

    public async Task<T> ExecuteAsync(Func<Task<T>> action)
    {
        for (int i = 0; i < _maxRetries; i++)
        {
            try { return await action(); }
            catch when (i < _maxRetries - 1) { await Task.Delay(_delay); }
        }
        return await action();
    }
}`,
  ],
  javascript: [
    `function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}`,
    `class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this.events[event] = this.events[event]?.filter(cb => cb !== callback);
  }

  emit(event, ...args) {
    this.events[event]?.forEach(callback => callback(...args));
  }
}`,
    `async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}`,
  ],
  java: [
    `public class LRUCache<K, V> {
    private final int capacity;
    private final LinkedHashMap<K, V> cache;

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.cache = new LinkedHashMap<>(capacity, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<K, V> eldest) {
                return size() > LRUCache.this.capacity;
            }
        };
    }

    public synchronized V get(K key) { return cache.get(key); }
    public synchronized void put(K key, V value) { cache.put(key, value); }
}`,
    `@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentGateway paymentGateway;
    private final NotificationService notificationService;

    @Autowired
    public OrderService(OrderRepository orderRepository,
                        PaymentGateway paymentGateway,
                        NotificationService notificationService) {
        this.orderRepository = orderRepository;
        this.paymentGateway = paymentGateway;
        this.notificationService = notificationService;
    }

    @Transactional
    public Order createOrder(OrderRequest request) {
        Order order = orderRepository.save(new Order(request));
        paymentGateway.processPayment(order);
        notificationService.sendConfirmation(order);
        return order;
    }
}`,
    `public class ThreadPool {
    private final BlockingQueue<Runnable> taskQueue;
    private final List<WorkerThread> threads;
    private volatile boolean isRunning = true;

    public ThreadPool(int numThreads) {
        taskQueue = new LinkedBlockingQueue<>();
        threads = new ArrayList<>();
        for (int i = 0; i < numThreads; i++) {
            WorkerThread thread = new WorkerThread(taskQueue);
            threads.add(thread);
            thread.start();
        }
    }

    public void submit(Runnable task) { taskQueue.offer(task); }

    public void shutdown() {
        isRunning = false;
        threads.forEach(WorkerThread::interrupt);
    }
}`,
  ],
};

// ============================================================
// Code Snippet Helpers
// ============================================================

/** Returns a random code snippet for the given language. Falls back to python. */
export function getCodeSnippet(language: string): string {
  const key = language.toLowerCase();
  const snippets = CODE_SNIPPETS[key] ?? CODE_SNIPPETS["python"];
  return randomChoice(snippets);
}

/** Returns the file extension for a programming language. */
export function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    "Python": "py",
    "JavaScript": "js",
    "TypeScript": "ts",
    "Java": "java",
    "C#": "cs",
    "Go": "go",
    "Rust": "rs",
    "C++": "cpp",
    "PHP": "php",
    "Ruby": "rb",
    "Swift": "swift",
    "Kotlin": "kt",
    "Scala": "scala",
    "Elixir": "ex",
    "SQL": "sql",
  };
  return extensions[language] ?? "txt";
}

// ============================================================
// Message Generators
// ============================================================

/** Generates a system prompt for a given topic and domain. */
export function generateSystemPrompt(topic: string, domain: string): string {
  return (
    `You are an expert software architect specializing in ${topic} for ${domain} applications. ` +
    `You have deep knowledge and follow industry best practices. ` +
    `Provide detailed, accurate, and actionable advice.`
  );
}

/** Generates an initial user message for a conversation. */
export function generateInitialUserMessage(
  topic: string,
  language: string,
  domain: string,
): string {
  const templates = [
    `Explain best practices for ${topic} in ${language} for ${domain} systems.`,
    `How would you implement ${topic} in a ${domain} application using ${language}?`,
    `What are the common pitfalls when working with ${topic} in ${language}?`,
    `Can you provide a code example of ${topic} in ${language}?`,
    `How do you handle ${topic} at scale in ${domain} environments?`,
  ];
  return randomChoice(templates);
}

/** Generates a follow-up user message for ongoing conversation. */
export function generateFollowUpMessage(topic: string): string {
  const templates = [
    `Can you elaborate more on the ${topic} approach you mentioned?`,
    `What about error handling in the context of ${topic}?`,
    `How would you test this ${topic} implementation?`,
    `Are there any performance concerns with this ${topic} approach?`,
    `What security considerations apply to ${topic}?`,
    `Can you show me a more advanced example of ${topic}?`,
    `How does this ${topic} pattern scale in production?`,
    `What are the alternatives to this ${topic} approach?`,
  ];
  return randomChoice(templates);
}

/** Generates an assistant response for the given topic and language. */
export function generateAssistantResponse(topic: string, language: string): string {
  return (
    `Based on industry best practices, here's my recommendation for ${topic} in ${language}:\n\n` +
    `1. Follow the principle of least privilege\n` +
    `2. Implement proper error handling and logging\n` +
    `3. Use dependency injection for testability\n` +
    `4. Apply SOLID principles consistently\n` +
    `5. Write comprehensive unit tests\n\n` +
    `Would you like me to elaborate on any of these points?`
  );
}

/** Generates a prompt for legacy completions endpoint. */
export function generateCompletionPrompt(topic: string, language: string): string {
  const templates = [
    `Write a ${language} function that demonstrates ${topic}.`,
    `Explain how to implement ${topic} in ${language} with code examples.`,
    `Create a comprehensive ${language} code example showing best practices for ${topic}.`,
    `Provide a detailed ${language} implementation of ${topic} with comments.`,
  ];
  return randomChoice(templates);
}
