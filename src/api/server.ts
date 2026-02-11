import express from "express";
import cors from "cors";
import path from "path";
import { generateRoutes } from "./routes/generate.js";
import { modelRoutes } from "./routes/models.js";
import { profileRoutes } from "./routes/profiles.js";

const app = express();
const PORT = process.env.PORT ?? 3500;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve static files from the public directory
app.use(express.static(path.join(process.cwd(), "public")));

// Routes
app.use("/api", generateRoutes);
app.use("/api", modelRoutes);
app.use("/api", profileRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`AI Hub Tools API server running on port ${PORT}`);
  console.log(`  UI: http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Models: http://localhost:${PORT}/api/models`);
  console.log(`  Generate: POST http://localhost:${PORT}/api/generate`);
});

export default app;
