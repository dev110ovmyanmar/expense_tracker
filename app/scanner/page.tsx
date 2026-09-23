import type { Metadata } from "next";
import { OCRScanner } from "@/components/OCRScanner";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Scanner",
};

export default function ScannerPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Receipt scanner"
        title="Read a voucher, then confirm it"
        description="Upload a photo or PDF. Folio walks through upload, vendor and totals, then line items, and waits for you to correct the fields before they join the ledger."
      />
      <OCRScanner />
    </div>
  );
}
