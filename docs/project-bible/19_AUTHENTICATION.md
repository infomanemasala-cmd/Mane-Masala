# Mane Masala Project Bible — Forensic Archive

**Archive date:** 2026-10-06. Documentation-only forensic recovery; secrets excluded.

## Authentication
Supabase Auth powers login/session/account. Routes include /login and /auth/callback; account supports password change/logout. Commit 0eb756090… corrected the password update API. Auth ≠ authorization; RLS/RPC controls remain required. Full browser auth E2E remains a gap.