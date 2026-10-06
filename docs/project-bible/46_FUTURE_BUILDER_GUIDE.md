# Mane Masala Project Bible — Forensic Archive

**Archive date:** 2026-10-06. Documentation-only forensic recovery; secrets excluded.

## Future Builder Operating Manual
Sequence: read Master State → decisions → Do Not Break → inspect Git → LIVE schema/migrations/functions/views/RLS → deployed commit → determine truth/drift → smallest safe change → build/lint → business tests → exact runtime deployment test → reconcile → document → commit → deploy only when authorized → reconcile LIVE.

Prohibit blind redesign, destructive cleanup, deletion of history, invented values, source=LIVE assumptions, READY=verified assumptions, unperformed test claims, restored reverted code and fake production records. First reconcile main ca0e0ade…, production bf2529…, and LIVE migration 20260928124242.