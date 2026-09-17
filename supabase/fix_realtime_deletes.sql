-- Fixes deletes (stores, items) not disappearing from the UI.
-- Run this once in the Supabase SQL editor.
--
-- Cause: by default a table's REPLICA IDENTITY is "DEFAULT", which means a
-- DELETE's old-row data in the WAL only contains primary key columns.
-- Supabase Realtime needs the *full* old row to evaluate each subscriber's
-- row-level security SELECT policy (here, it needs household_id, not just
-- id) before deciding whether to broadcast the delete to them. Without the
-- full row, the check can't be evaluated, so the delete event is silently
-- dropped — the row really is deleted in Postgres, but no connected client
-- ever hears about it, so the UI still shows it.

alter table stores replica identity full;
alter table items replica identity full;
alter table lists replica identity full;
alter table household_members replica identity full;
