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

function visionProvider(): { name: "openai" | "gemini"; key: string; model: string } | null {
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return { name: "openai", key: openai, model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o" };
  }
  const gemini = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (gemini) {
    return {
      name: "gemini",
      key: gemini,
      model: process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.5-flash",
    };
  }
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
  const models = [...new Set([model, "gemini-2.5-flash", "gemini-flash-latest"])];
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
                  text: "Extract this voucher. grandTotal must be the GRAND TOTAL, not the subtotal or cash tendered. Do not put totals, tax, or service charge in items. Reply with JSON only.",
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
      if (response.status === 404) continue;
      throw new Error(lastError);
    }
    const payload: unknown = await response.json();
    const text =
      typeof payload === "object" && payload !== null && "candidates" in payload
        ? (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates?.[0]
            ?.content?.parts?.[0]?.text
        : "";
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
  if (!provider) {
    return Response.json(
      {
        voucher: null,
        error: "Set OPENAI_API_KEY or GEMINI_API_KEY to read voucher photos.",
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
    return Response.json({ voucher: null, error: message });
  }
}
