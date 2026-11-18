import "server-only";

/**
 * One interface for every AI call (spec §8): switching providers is a settings change.
 *
 *   AI_PROVIDER=gemini   GEMINI_API_KEY=…  GEMINI_MODEL=gemini-2.5-flash-lite   (default)
 *   AI_PROVIDER=openai   OPENAI_API_KEY=…  OPENAI_MODEL=…  OPENAI_BASE_URL=…    (any OpenAI-compatible API)
 */

export type Provider = "gemini" | "openai";

export function aiConfig(): { provider: Provider; model: string; ready: boolean } {
  const provider: Provider = process.env.AI_PROVIDER === "openai" ? "openai" : "gemini";
  if (provider === "openai") {
    return {
      provider,
      model: process.env.OPENAI_MODEL || "gpt-4.1-nano",
      ready: Boolean(process.env.OPENAI_API_KEY),
    };
  }
  return {
    provider,
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash-lite",
    ready: Boolean(process.env.GEMINI_API_KEY),
  };
}

export class AiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

interface JsonRequest {
  system: string;
  prompt: string;
  temperature?: number;
}

export async function generateJson<T>({ system, prompt, temperature = 0.7 }: JsonRequest): Promise<T> {
  const cfg = aiConfig();
  if (!cfg.ready) {
    throw new AiError(
      cfg.provider === "gemini"
        ? "No AI key yet. Add GEMINI_API_KEY to .env.local and restart the app."
        : "No AI key yet. Add OPENAI_API_KEY to .env.local and restart the app.",
      503,
    );
  }
  const text =
    cfg.provider === "gemini"
      ? await callGemini(cfg.model, system, prompt, temperature)
      : await callOpenAI(cfg.model, system, prompt, temperature);
  return parseJson<T>(text);
}

async function callGemini(model: string, system: string, prompt: string, temperature: number) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) throw new AiError(`Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`, 502);
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) throw new AiError("The AI returned an empty answer. Try again.", 502);
  return text;
}

async function callOpenAI(model: string, system: string, prompt: string, temperature: number) {
  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new AiError(`AI error ${res.status}: ${(await res.text()).slice(0, 300)}`, 502);
  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text) throw new AiError("The AI returned an empty answer. Try again.", 502);
  return text;
}

function parseJson<T>(text: string): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new AiError("The AI's answer wasn't valid JSON. Try again.", 502);
  }
}
