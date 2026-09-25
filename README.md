# Aura

A daily personal expense ledger. Track spending against a monthly budget, filter the full ledger, and scan a receipt into an editable preview before it is saved.

Expenses and the budget are stored in Supabase. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Run `supabase/migrations/001_expenses.sql` on a new project, or `supabase/migrations/002_public_ledger.sql` if the tables already exist. Run `supabase/migrations/004_recurring_and_goals.sql` for fixed bills and savings goals. Run `supabase/migrations/006_category_budgets.sql` for category spending limits. Run `supabase/migrations/007_daily_bills.sql` for daily bills. Run `supabase/migrations/009_profiles.sql` so each account gets a profile row. Sign in at `/login`. Add `/reset-password` to the Supabase redirect URLs. A daily reminder can prompt you to log expenses. The app does not keep a ledger in the browser.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What you can do

- **Overview** shows this month's total, budget remaining, daily average, scanned-receipt count, and a category chart.
- **Ledger** lists every expense with search, category, and date filters, plus edit and delete.
- **Plan** keeps fixed bills (weekly or monthly) and savings envelopes. A bill can ask before it is logged, or log itself when the date arrives. Each goal has a target, an optional date, a monthly share of income, and a progress bar.
- **Scanner** accepts a PNG, JPG, WEBP, SVG, or PDF. A three-step read (`Uploading image`, `Detecting vendor & totals`, `Parsing line items & category`) opens the file beside a form. **Confirm & Add to Expenses** writes it into the ledger and updates the overview.
- Photos are resized and sent to the vision model as soon as you drop them. The amount saved is the grand total, not cash, change, service charge, or tax.
- Amounts are Myanmar kyat and display with thousand separators, such as `1,650 Ks`.
- Light and dark mode follow the system, and can be switched from the sidebar.

Photos are sent to a vision model (GPT-4o when `OPENAI_API_KEY` is set, otherwise Gemini when `GEMINI_API_KEY` or `GOOGLE_API_KEY` is set). The model must return the shop, items, and grand total as JSON. Without a key, a photo opens an empty form instead of crashing. Images are not stored with the expense.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — ESLint
