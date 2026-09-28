import { VISION_SYSTEM_PROMPT, parseVoucher } from "@/lib/vision-receipt";

export const runtime = "nodejs";

const VOUCHER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    shopName: { type: "string" },
    date: { type: "string" },
    invoiceNo: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          itemName: { type: "string" },
          quantity: { type: "number" },
          unitPrice: { type: "number" },
          totalPrice: { type: "number" },
        },
        required: ["itemName", "quantity", "unitPrice", "totalPrice"],
      },
    },
    subtotal: { type: "number" },
    tax: { type: "number" },
    serviceCharge: { type: "number" },
    grandTotal: { type: "number" },
    currency: { type: "string" },
  },
  required: [
    "shopName",
    "date",
    "invoiceNo",
    "items",
    "subtotal",
    "tax",
    "serviceCharge",
    "grandTotal",
    "currency",
  ],
} as const;

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
  const openai = usable.find(isOpenAIKey);
  if (openai) {
    return { name: "openai", key: openai, model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o" };
  }
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
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract this voucher. Use the grand total as grandTotal. Do not put totals, tax, or service charge in items. Reply with JSON only.",
            },
            { type: "image_url", image_url: { url: `data:${mime};base64,${bytes.toString("base64")}` } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "voucher", strict: true, schema: VOUCHER_SCHEMA },
      },
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
  const models = [...new Set([model, "gemini-3.5-flash-lite"])];
  let lastError = "The vision model could not read this image.";
  for (const candidate of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                {
                  text: "Extract this voucher as JSON with shopName, date as YYYY-MM-DD, invoiceNo, items[{itemName,quantity,unitPrice,totalPrice}], subtotal, tax, serviceCharge, grandTotal, currency. grandTotal is the Grand Total line, not the subtotal. Do not put totals, tax, or service charge in items. JSON only.",
                },
                { inlineData: { mimeType: mime, data: bytes.toString("base64") } },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );
    if (!response.ok) {
      lastError = await providerError(response);
      const busy = response.status === 404 || response.status === 429 || response.status === 503 || /high demand|unavailable|overloaded|try again/i.test(lastError);
      if (busy) continue;
      throw new Error(lastError);
    }
    const payload: unknown = await response.json();
    const parts =
      typeof payload === "object" && payload !== null && "candidates" in payload
        ? (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]
            ?.content?.parts
        : [];
    const text = (parts ?? []).map((part) => part.text ?? "").filter(Boolean).join("\n");
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("The vision model returned an empty reply.");
    }
    return parseModelJson(text);
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
