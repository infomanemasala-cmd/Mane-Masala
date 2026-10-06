# Mane Masala Project Bible — Forensic Archive

**Archive date:** 2026-10-06. Documentation-only forensic recovery; secrets excluded.

## RLS and Security
All 53 public tables have RLS; 54 policies observed. Historical work hardened audit search_path/permissions, corrected v_supplier_outstanding security behavior, revoked anonymous save_recipe_version execution and restored needed authenticated payment RPC access. Remaining SECURITY DEFINER advisor warnings and disabled leaked-password protection were still open. Do not blindly revoke business functions.