# Mane Masala Project Bible — Forensic Archive

**Archive date:** 2026-10-06. Documentation-only forensic recovery; secrets excluded.

## Dispatch and Sales
Dispatch is the physical stock boundary. It records actual quantities/date/method, supports partial/multiple dispatches and consumes reserved/FIFO stock exactly once. Sale is derived from approved dispatch; invoice follows sale. Sale and invoice must never reduce inventory again. F-08 duplicate-dispatch/idempotency correction was runtime verified.