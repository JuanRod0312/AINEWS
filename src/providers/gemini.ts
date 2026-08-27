import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { GoogleGenAI } from "@google/genai";
import { buildEditorialInput, editorialInstructions } from "../editorial/prompt.js";
import { episodeDraftJsonSchema, validateAndRenderEpisode } from "../editorial/schema.js";
import type { EpisodeRequest, GeneratedEpisode } from "../types.js";
import type { LanguageModelProvider } from "./provider.js";

export class GeminiProvider implements LanguageModelProvider {
  readonly name = "gemini";

  constructor(private readonly model: string) {}

  async generateEpisode(request: EpisodeRequest): Promise<GeneratedEpisode> {
    if (existsSync(".env")) loadEnvFile(".env");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Copy .env.example to .env and add your key.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: this.model,
      contents: buildEditorialInput(request),
      config: {
        systemInstruction: editorialInstructions,
        responseMimeType: "application/json",
        responseJsonSchema: episodeDraftJsonSchema
      }
    });
    if (!response.text) throw new Error("Gemini returned no episode text.");
    return validateAndRenderEpisode(JSON.parse(response.text), request);
  }
}

