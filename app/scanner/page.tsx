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
        description="Photograph a restaurant check or shop slip. Aura reads the vendor, the date, and the grand total in kyat, and leaves tax, service charge, and cash off the amount."
      />
      <OCRScanner />
    </div>
  );
}
