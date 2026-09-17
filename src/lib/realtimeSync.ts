import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Dispatch, SetStateAction } from "react";

// Applies an INSERT/UPDATE/DELETE realtime payload to local list state.
// INSERT is deduped by id since the row may already be present from an
// optimistic local update; used by every table this app subscribes to.
export function applyRealtimeListChange<T extends { id: string }>(
  setState: Dispatch<SetStateAction<T[]>>
) {
  return (payload: RealtimePostgresChangesPayload<T>) => {
    if (payload.eventType === "INSERT") {
      const row = payload.new as T;
      setState((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]));
    } else if (payload.eventType === "UPDATE") {
      const row = payload.new as T;
      setState((prev) => prev.map((x) => (x.id === row.id ? row : x)));
    } else if (payload.eventType === "DELETE") {
      const row = payload.old as T;
      setState((prev) => prev.filter((x) => x.id !== row.id));
    }
  };
}
