# Mane Masala Project Bible — Forensic Archive

**Archive date:** 2026-10-06. Documentation-only forensic recovery; secrets excluded.

## Architecture
UI → shared components/hooks → controlled RPC/database functions → PostgreSQL tables/views → audit/history. Supabase is persistent source of truth; reports are read-only. Critical operations are designed for atomic/idempotent execution. Repository main, deployed branch and LIVE database currently sit at different revision points and must be reconciled before implementation.