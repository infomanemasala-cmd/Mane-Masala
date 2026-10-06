# Mane Masala Project Bible — Forensic Archive

**Archive date:** 2026-10-06. Documentation-only forensic recovery; secrets excluded.

## Traceability Matrix
| Requirement | Source | Implemented | LIVE | Runtime verified | Gap |
| Reservations do not reduce stock | v1.6/AGENTS | Yes | Yes | Backend PASS | browser E2E |
| Dispatch reduces stock once | F-08 | Yes | Yes | Yes | complete UI E2E |
| Sale/invoice do not reduce stock | validation | Yes | Yes | Yes | full permutations |
| FIFO physical dates | F-02 | Yes | Yes | Yes | full UI E2E |
| Accepted purchase creates stock | purchasing rules | Yes | Yes | Yes | UI E2E |
| Order starts planning | v1.6 | Yes | Yes | backend | browser E2E |
| Explicit recipe version | v1.6 | Yes | Yes | partial | UI proof |
| Payment allocation | validation | Yes | Yes | backend | UI/reconciliation |
| Customer return inspection | rules | schema | Yes | unclear | writer/E2E |
| Shared DataTable | UI standard | source | N/A | partial | page-by-page |
| RLS | security docs | Yes | Yes | config | auth E2E |
| Reports reconcile | release gate | source | Yes | no | realistic reconciliation |

### Database→Code→UI
items→master/update/archive RPCs→MasterItemManager/masters; purchases→purchase RPCs→purchases; inventory→stock-out/adjustment/dispatch RPCs→inventory/dispatch; recipes/production→production RPCs/views→production/orders-partial; orders→planning/confirm RPCs→orders; dispatch/sales/invoices→dispatch/sale/invoice RPCs→sales-invoices; payments→allocation RPCs→payments; returns→return tables/adjustments→transactions/returns; reports→read-only views→reports. “Implemented” is not “runtime verified.”