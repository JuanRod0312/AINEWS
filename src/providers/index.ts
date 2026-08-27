import type { LanguageModelProvider } from "./provider.js";
import { GeminiProvider } from "./gemini.js";
import { TemplateProvider } from "./template.js";

export function createProvider(name: string, model: string): LanguageModelProvider {
  if (name === "template") return new TemplateProvider();
  if (name === "gemini") return new GeminiProvider(model);
  throw new Error(`Unknown provider "${name}". Available providers: gemini, template`);
}
