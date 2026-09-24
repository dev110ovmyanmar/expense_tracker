"use client";

import { Check, Loader2, ScanLine, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { ExpenseFields } from "@/components/expense-fields";
import { useExpenses } from "@/components/expense-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/format";
import { extractReceipt, fileKind, OCR_STEPS } from "@/lib/ocr";
import { draftFromOCR, validateDraft, type FieldErrors } from "@/lib/validate";
import type { Expense, ExpenseDraft, OCRData } from "@/types/expense";

type Phase = "idle" | "processing" | "review" | "saved";
type PreviewKind = "image" | "pdf";

const FIELD_ORDER = ["vendor", "date", "amount", "lineItems", "notes"] as const;
const MAX_BYTES = 10 * 1024 * 1024;

export function OCRScanner() {
  const { addExpense, hydrated, saving } = useExpenses();
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const previewRef = useRef<string | null>(null);
  const generation = useRef(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("image");
  const [fileName, setFileName] = useState("");
  const [ocr, setOcr] = useState<OCRData | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState<Expense | null>(null);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase !== "processing") return;
    const timers = [
      window.setTimeout(() => setStep(1), 180),
      window.setTimeout(() => setStep(2), 360),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [phase, run]);

  function replacePreview(next: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next;
    setPreviewUrl(next);
  }

  function reset() {
    generation.current += 1;
    replacePreview(null);
    setPhase("idle");
    setStep(0);
    setFileName("");
    setOcr(null);
    setDraft(null);
    setErrors({});
    setSaved(null);
    setDragging(false);
    dragDepth.current = 0;
    if (inputRef.current) inputRef.current.value = "";
  }

  function begin(file: File) {
    const kind = fileKind(file);
    if (!kind) {
      toast.error("That file type is not supported", {
        description: "Upload a PNG, JPG, WEBP, SVG, or PDF.",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That file is too large", {
        description: "Receipts need to be under 10 MB.",
      });
      return;
    }
    const token = generation.current + 1;
    generation.current = token;
    replacePreview(URL.createObjectURL(file));
    setPreviewKind(kind);
    setFileName(file.name);
    setOcr(null);
    setDraft(null);
    setErrors({});
    setSaved(null);
    setStep(0);
    setRun((current) => current + 1);
    setPhase("processing");

    void extractReceipt(file).then((data) => {
      if (generation.current !== token) return;
      setOcr(data);
      setDraft(draftFromOCR(data));
      setPhase("review");
      if (data.warning) {
        toast.error("Vision read needs attention", { description: data.warning });
      }
    });
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    if (event.dataTransfer.files.length > 1) {
      toast("Using the first file", { description: "Scan one receipt at a time." });
    }
    begin(file);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    if (!hydrated) {
      toast.error("The ledger is still loading", { description: "Try confirming again in a moment." });
      return;
    }
    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      const first = FIELD_ORDER.find((key) => result.errors[key]);
      if (first) document.getElementById(`ocr-${first}`)?.focus();
      return;
    }
    try {
      const expense = await addExpense({
        ...result.value,
        source: "ocr",
        receiptName: fileName,
      });
      setSaved(expense);
      setPhase("saved");
      toast.success("Added to your ledger", {
        description: `${expense.vendor} · ${formatMoney(expense.amount)}`,
      });
    } catch (error) {
      toast.error("Could not save this receipt", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    }
  }

  if (phase === "saved" && saved) {
    return (
      <Card>
        <CardContent className="grid gap-6 py-2 sm:grid-cols-[180px_1fr] sm:items-center">
          {previewUrl && previewKind === "image" ? (
            <ReceiptPreview url={previewUrl} kind={previewKind} name={fileName} compact />
          ) : (
            <span className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Check className="size-7" />
            </span>
          )}
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Saved
              </p>
              <h2 className="font-heading text-2xl tracking-tight">Added to your ledger</h2>
              <p className="text-sm text-muted-foreground">
                {saved.vendor} · {formatMoney(saved.amount)} · {formatDate(saved.date)} ·{" "}
                {saved.category}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="h-10" onClick={reset}>
                Scan another
              </Button>
              <Button asChild variant="outline" className="h-10">
                <Link href="/expenses">View ledger</Link>
              </Button>
              <Button asChild variant="ghost" className="h-10">
                <Link href="/">Back to overview</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "processing" && previewUrl) {
    const progress = step === 0 ? 22 : step === 1 ? 58 : 86;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reading receipt</CardTitle>
          <CardDescription>{fileName}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="relative overflow-hidden rounded-xl bg-muted">
            <ReceiptPreview url={previewUrl} kind={previewKind} name={fileName} />
            <div className="aura-scanline pointer-events-none absolute inset-x-4 h-px bg-primary shadow-[0_0_16px_var(--primary)]" />
          </div>
          <div className="space-y-5">
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <ol className="grid gap-3" aria-live="polite">
              {OCR_STEPS.map((item, index) => {
                const state = index < step ? "done" : index === step ? "active" : "pending";
                return (
                  <li key={item.title} className="flex gap-3">
                    <span className="mt-0.5 grid size-6 place-items-center">
                      {state === "done" ? (
                        <Check className="size-4 text-primary" />
                      ) : state === "active" ? (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      ) : (
                        <span className="size-2 rounded-full bg-border" />
                      )}
                    </span>
                    <span>
                      <span className={state === "pending" ? "text-muted-foreground" : "font-medium"}>
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{item.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
            <Button type="button" variant="outline" onClick={reset}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (phase === "review" && previewUrl && draft && ocr) {
    const confidence = Math.round(ocr.confidence * 100);
    return (
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Receipt</CardTitle>
            <CardDescription className="truncate">{fileName}</CardDescription>
          </CardHeader>
          <CardContent>
            <ReceiptPreview url={previewUrl} kind={previewKind} name={fileName} framed />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Extracted fields</CardTitle>
                <CardDescription>
                  {ocr.totalFound && confidence >= 70
                    ? `${ocr.vendor} is filled from the voucher. The amount is the grand total. Check each item before you add it.`
                    : "The vision read is incomplete. Type the shop and the grand total in kyat."}
                </CardDescription>
              </div>
              <Badge variant="secondary">{confidence}% match</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-5">
              <ReceiptReadout ocr={ocr} />
              <ExpenseFields
                draft={draft}
                onChange={setDraft}
                errors={errors}
                idPrefix="ocr"
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" className="h-11 flex-1 text-base" disabled={!hydrated || saving}>
                  <Check />
                  {saving ? "Saving…" : "Confirm & Add to Expenses"}
                </Button>
                <Button type="button" variant="outline" className="h-11" onClick={reset}>
                  Discard
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="grid gap-6">
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            dragDepth.current += 1;
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault();
            dragDepth.current -= 1;
            if (dragDepth.current <= 0) {
              dragDepth.current = 0;
              setDragging(false);
            }
          }}
          onDrop={onDrop}
          className={`rounded-2xl border border-dashed px-6 py-12 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-border bg-muted/40"
          }`}
        >
          <input
            ref={inputRef}
            id="receipt-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf,.png,.jpg,.jpeg,.webp,.svg,.pdf"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) begin(file);
            }}
          />
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <ScanLine />
          </span>
          <h2 className="mt-4 font-heading text-2xl tracking-tight">Drop a receipt or voucher</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            PNG or JPG vouchers are sent to a vision model, which returns the shop, items, and grand total.
            Check the form before it joins the ledger.
          </p>
          <Button asChild className="mt-5 h-10">
            <label htmlFor="receipt-upload">
              <Upload />
              Browse files
            </label>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReceiptReadout({ ocr }: { ocr: OCRData }) {
  return (
    <div
      className={`rounded-lg px-3 py-2 text-sm ${
        ocr.totalFound ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-foreground"
      }`}
    >
      {ocr.totalFound ? (
        <p>
          Amount is the grand total{ocr.invoiceNo ? ` · invoice ${ocr.invoiceNo}` : ""}. Totals, tax, and service charge are not item lines.
        </p>
      ) : (
        <p>{ocr.warning || "No grand total was read. Enter the amount in kyat. Currency stays MMK."}</p>
      )}
    </div>
  );
}

function ReceiptPreview({
  url,
  kind,
  name,
  framed = false,
  compact = false,
}: {
  url: string;
  kind: PreviewKind;
  name: string;
  framed?: boolean;
  compact?: boolean;
}) {
  if (kind === "pdf") {
    return (
      <iframe
        title={name}
        src={url}
        className={`w-full rounded-lg bg-white ${compact ? "h-32" : "h-80"}`}
      />
    );
  }

  return (
    // Blob and generated receipt previews are local object URLs, which next/image cannot optimize.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Uploaded receipt ${name}`}
      className={`w-full rounded-lg object-contain ${framed ? "max-h-[640px] bg-muted" : ""} ${
        compact ? "h-32 object-cover" : "max-h-[420px]"
      }`}
    />
  );
}
