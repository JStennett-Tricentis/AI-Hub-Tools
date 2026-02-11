import { Router } from "express";
import { ModelRegistry } from "../../core/models/model-registry.js";

export const modelRoutes = Router();

modelRoutes.get("/models", (_req, res) => {
  res.json({
    chat: ModelRegistry.getChatModels(),
    completion: ModelRegistry.getCompletionModels(),
    embedding: ModelRegistry.getEmbeddingModels(),
  });
});

modelRoutes.get("/models/:id", (req, res) => {
  const model = ModelRegistry.getModel(req.params.id);
  if (!model) {
    res.status(404).json({ error: `Model '${req.params.id}' not found` });
    return;
  }
  res.json(model);
});

modelRoutes.get("/endpoints", (_req, res) => {
  const modelIds = ModelRegistry.getAllModelIds();
  const endpoints: Record<string, string> = {};
  for (const id of modelIds) {
    endpoints[id] = ModelRegistry.getEndpointPath(id);
  }
  res.json({ endpoints });
});
