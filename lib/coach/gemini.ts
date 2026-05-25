import "server-only";

import { GoogleGenAI } from "@google/genai";

// Free-tier-friendly Flash model. The Coach is always clearly labelled
// "AI-generated · Gemini" in the UI (see DESIGN_SYSTEM.md).
export const COACH_MODEL = "gemini-2.5-flash";

export type Generated = { text: string; model: string; tokens: number };

export async function generate(
  prompt: string,
  system?: string
): Promise<Generated> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: COACH_MODEL,
    contents: prompt,
    config: {
      systemInstruction: system,
      temperature: 0.7,
      maxOutputTokens: 500,
      // Disable "thinking" — these are short factual insights, and thinking
      // would otherwise consume the output budget (and free-tier quota).
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return {
    text: (response.text ?? "").trim(),
    model: COACH_MODEL,
    tokens: response.usageMetadata?.totalTokenCount ?? 0,
  };
}
