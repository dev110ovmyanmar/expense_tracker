# Aura

A daily personal expense ledger. Track spending against a monthly budget, filter the full ledger, and scan a receipt into an editable preview before it is saved.

Expenses and the budget live in `localStorage` in this browser. Nothing is sent to a server.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What you can do

- **Overview** shows this month's total, budget remaining, daily average, scanned-receipt count, and a category chart.
- **Ledger** lists every expense with search, category, and date filters, plus edit and delete.
- **Scanner** accepts a PNG, JPG, WEBP, SVG, or PDF. A three-step read (`Uploading image`, `Detecting vendor & totals`, `Parsing line items & category`) opens the file beside a form. **Confirm & Add to Expenses** writes it into the ledger and updates the overview.
- Sample vouchers (City Express, a tea shop, and a Beer Factory check) are built in the browser. Photos are read on this computer with Tesseract. The amount saved is the grand total, not cash, change, service charge, or tax.
- Amounts are Myanmar kyat and display with thousand separators, such as `1,650 Ks`.
- Light and dark mode follow the system, and can be switched from the sidebar.

Photos are recognized on the Aura server running on this computer. SVG, PDF, and text files are read directly. Nothing is sent to an outside vision service. Review the preview before confirming. Images are not stored with the expense.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — ESLint
