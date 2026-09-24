import { createWorker } from "tesseract.js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ text: "" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(buffer);
    return Response.json({ text: result.data.text });
  } catch {
    return Response.json({ text: "" });
  } finally {
    await worker.terminate();
  }
}
