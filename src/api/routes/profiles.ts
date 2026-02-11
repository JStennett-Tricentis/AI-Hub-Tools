import { Router } from "express";
import { loadProfile } from "../../loaders/profile-loader.js";
import { loadTemplate } from "../../loaders/template-loader.js";
import fs from "fs/promises";
import path from "path";

export const profileRoutes = Router();

const dataDir = path.join(process.cwd(), "data");

profileRoutes.get("/profiles", async (_req, res) => {
  try {
    const profilesDir = path.join(dataDir, "profiles");
    const files = await fs.readdir(profilesDir);
    const profiles = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
    res.json({ profiles });
  } catch {
    res.json({ profiles: [] });
  }
});

profileRoutes.get("/profiles/:name", async (req, res) => {
  const profile = await loadProfile(req.params.name);
  if (!profile) {
    res.status(404).json({ error: `Profile '${req.params.name}' not found` });
    return;
  }
  res.json(profile);
});

profileRoutes.get("/templates", async (_req, res) => {
  try {
    const templatesDir = path.join(dataDir, "templates");
    const files = await fs.readdir(templatesDir);
    const templates = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".template.json", "").replace(".json", ""));
    res.json({ templates });
  } catch {
    res.json({ templates: [] });
  }
});

profileRoutes.get("/templates/:name", async (req, res) => {
  const template = await loadTemplate(req.params.name);
  if (!template) {
    res.status(404).json({ error: `Template '${req.params.name}' not found` });
    return;
  }
  res.json(template);
});
