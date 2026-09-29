-- Retired. This file used to let every account read and write every row.
-- It is now a no-op. Run supabase/migrations/011_own_ledger.sql so each account only sees its own ledger.
select 1;
