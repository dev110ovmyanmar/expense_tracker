# Folio

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
- Sample vouchers (a coffee receipt and a utility bill) are built in the browser so you can try the scanner without a file.
- Light and dark mode follow the system, and can be switched from the sidebar.

The scanner suggests structured fields from the file name and a set of receipt templates. It does not call an external vision API. Review the preview against the image before confirming. Images stay on this device and are not stored with the expense.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — ESLint
