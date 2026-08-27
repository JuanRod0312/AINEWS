import type { LanguageModelProvider } from "./provider.js";
import { TemplateProvider } from "./template.js";

export function createProvider(name: string): LanguageModelProvider {
  if (name === "template") return new TemplateProvider();
  throw new Error(`Unknown provider "${name}". Available providers: template`);
}

