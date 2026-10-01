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
        description="Photograph a shop slip or a KBZPay e-receipt. A plus amount is income. A minus amount is an expense. You can still switch the Income tab before saving."
      />
      <OCRScanner />
    </div>
  );
}
