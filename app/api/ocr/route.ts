import { VISION_SYSTEM_PROMPT, parseVoucher } from "@/lib/vision-receipt";

export const runtime = "nodejs";

const KEY_HELP =
  "Set GEMINI_API_KEY in the Netlify site environment to a Google AI Studio key (it starts with AIza or AQ.), then redeploy. Do not paste a Supabase anon key or a login token. An OpenAI key must start with sk-.";

function cleanKey(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function isJwt(key: string): boolean {
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key);
}

function isGeminiKey(key: string): boolean {
  return key.startsWith("AIza") || key.startsWith("AQ.");
}

function isOpenAIKey(key: string): boolean {
  return key.startsWith("sk-");
}

function visionProvider(): { name: "openai" | "gemini"; key: string; model: string } | "rejected" | null {
  const keys = [
    cleanKey(process.env.OPENAI_API_KEY),
    cleanKey(process.env.GEMINI_API_KEY),
    cleanKey(process.env.GOOGLE_API_KEY),
  ].filter(Boolean);
  const usable = keys.filter((key) => !isJwt(key));
  const gemini =
    usable.find(isGeminiKey) ??
    [cleanKey(process.env.GEMINI_API_KEY), cleanKey(process.env.GOOGLE_API_KEY)].find((key) => key && !isJwt(key));
  if (gemini) {
    return {
      name: "gemini",
      key: gemini,
      model: process.env.GEMINI_VISION_MODEL?.trim() || "gemini-3.5-flash-lite",
    };
  }
  const openai = usable.find(isOpenAIKey);
  if (openai) {
    return { name: "openai", key: openai, model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini" };
  }
  if (keys.length > 0) return "rejected";
  return null;
}

function parseModelJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("The vision model did not return JSON.");
  }
}

async function providerError(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
      const error = parsed.error;
      if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
        return error.message;
      }
      if (typeof error === "string") return error;
    }
  } catch {
    // The provider returned plain text.
  }
  return body.replace(/\s+/g, " ").slice(0, 240) || `Vision request failed (${response.status})`;
}

async function readOpenAI(file: File, key: string, model: string): Promise<unknown> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1024,
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Receipt." },
            { type: "image_url", image_url: { url: `data:${mime};base64,${bytes.toString("base64")}`, detail: "low" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(await providerError(response));
  const payload: unknown = await response.json();
  const content =
    typeof payload === "object" &&
    payload !== null &&
    "choices" in payload &&
    Array.isArray(payload.choices)
      ? (payload.choices[0] as { message?: { content?: string } } | undefined)?.message?.content
      : "";
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The vision model returned an empty reply.");
  }
  return parseModelJson(content);
}

async function readGemini(file: File, key: string, model: string): Promise<unknown> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";
  const image = bytes.toString("base64");
  let lastError = "The vision model could not read this image.";
  for (const fast of [true, false]) {
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    };
    if (fast) {
      generationConfig.thinkingConfig = { thinkingLevel: "MINIMAL" };
      generationConfig.mediaResolution = "MEDIA_RESOLUTION_LOW";
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: "Receipt." }, { inlineData: { mimeType: mime, data: image } }] }],
          generationConfig,
        }),
      },
    );
    if (response.ok) {
      const payload: unknown = await response.json();
      const parts =
        typeof payload === "object" && payload !== null && "candidates" in payload
          ? (
              payload as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
              }
            ).candidates?.[0]?.content?.parts
          : [];
      const text = (parts ?? [])
        .filter((part) => part.thought !== true)
        .map((part) => part.text ?? "")
        .filter(Boolean)
        .join("\n");
      if (typeof text !== "string" || !text.trim()) {
        throw new Error("The vision model returned an empty reply.");
      }
      return parseModelJson(text);
    }
    lastError = await providerError(response);
    const unsupported = response.status === 400 && /thinking|mediaResolution|unknown|invalid/i.test(lastError);
    if (fast && unsupported) continue;
    throw new Error(lastError);
  }
  throw new Error(lastError);
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ voucher: null, error: "Upload a voucher image." }, { status: 400 });
  }
  const provider = visionProvider();
  if (provider === "rejected") {
    return Response.json({ voucher: null, error: KEY_HELP }, { status: 503 });
  }
  if (!provider) {
    return Response.json(
      {
        voucher: null,
        error: "Set GEMINI_API_KEY or OPENAI_API_KEY on the server to read voucher photos.",
      },
      { status: 503 },
    );
  }
  try {
    const raw =
      provider.name === "openai"
        ? await readOpenAI(file, provider.key, provider.model)
        : await readGemini(file, provider.key, provider.model);
    const voucher = parseVoucher(raw);
    if (!voucher) {
      return Response.json({ voucher: null, error: "The vision model did not return a voucher." });
    }
    return Response.json({ voucher });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The vision model could not read this image.";
    const issuer = /not from a valid issuer|unauthenticated|invalid authentication|api key/i.test(message);
    return Response.json({ voucher: null, error: issuer ? KEY_HELP : message });
  }
}
