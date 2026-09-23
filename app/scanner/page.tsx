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
        description="Upload a City Express slip, tea-shop bill, or other thermal receipt. Folio reads the vendor, the DD/MM date, and the Total in kyat, then lets you correct the amount before it joins the ledger."
      />
      <OCRScanner />
    </div>
  );
}
