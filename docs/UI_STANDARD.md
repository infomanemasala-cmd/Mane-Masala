# Mane Masala UI Standard

Version: UI-STD-1.1

This specification is mandatory for the Mane Masala application. It applies to all relevant master and operational list screens unless a future approved exception is documented.

## 1. Standard search on list pages

All list/table pages reached from the left navigation must use the same search interaction.

- Search is placed consistently above the table.
- Search behavior, input styling, clear/edit behavior, result count, pagination and sorting are consistent across pages.
- Search covers the page's useful business fields, including permanent business/item codes where applicable.
- Searching resets the current page to page 1.
- Search is server-backed through the shared table component; pages must not invent a separate search experience without an approved reason.
- The shared table component is the standard implementation for master and list tables.

## 2. Page-specific Create action

Every master and operational page has one clear primary create action using the name of the record/action being created.

| Page | Primary action | Dialog title |
| --- | --- | --- |
| Items | `+ Create Item` | `Create Item` |
| Categories | `+ Create Category` | `Create Category` |
| Units | `+ Create Unit` | `Create Unit` |
| Suppliers | `+ Create Supplier` | `Create Supplier` |
| Customers | `+ Create Customer` | `Create Customer` |
| Sub-Agents | `+ Create Sub-agent` | `Create Sub-agent` |
| Purchases | `+ Create Purchase` | `Create Purchase` |
| Inventory | `+ Stock Out` / approved adjustment action | `Stock Out` / `Stock Adjustment` |
| Production | `+ Create Production` | `Create Production` |
| Orders | `+ Create Order` | `Create Order` |
| Sales & Invoices | `+ Create Sale & Invoice` | `Create Sale & Invoice` |
| Payments | `+ Record Payment` | `Record Payment` |

System-generated permanent business codes are not typed by the user.

## 3. Create-related-record action inside dropdowns

When a form requires a master record that may not yet exist, the selection control must provide a create action in the dropdown itself.

Rules:

- Use a custom select/combobox when a native HTML select cannot contain an actionable create command.
- The `+ Create new ...` action is visually separated from normal choices.
- Selecting it opens a small create dialog without closing or losing the parent form.
- The user can create the missing record without manually navigating away from the parent form.
- After successful creation, the new record is immediately added to the dropdown and automatically selected.
- The parent form remains intact, including all values already entered.
- The same pattern is reusable for Item Type and other master dependencies where appropriate.
- Creation still uses the normal master rules, permissions and system-generated permanent code.

## 4. Purchase entry standard

A supplier invoice/slip is treated as one purchase document. The supplier is selected once and all item rows belong to that same supplier and bill.

- Start with Supplier and bill details.
- Allow multiple item rows on one purchase.
- Provide an explicit `+ Add item row` action.
- Each row supports Item, Quantity and Rate; rate may remain blank when the source document does not provide it.
- Selecting `+ Create new Item` from an item row opens an in-flow Create Item dialog and returns to the same purchase row after saving.
- Do not force the user to leave the purchase screen to create a missing item.
- After the purchase is saved, the final step is `Attach the invoice / shopkeeper slip`.
- Attachment supports a photographed handwritten slip as well as PDF/document files.
- The attachment is linked to the purchase transaction, not stored as an unrelated document.
- Physical receiving and inspection remain separate from purchase entry; accepted physical quantity is what creates usable inventory.

## 5. Mobile and tablet standard

The application is mobile/tablet first and responsive desktop. The same business workflows must remain usable on small screens.

- No horizontal page overflow for normal forms.
- Navigation becomes a compact horizontal mobile navigation.
- Primary actions become easy to tap and can use full width where useful.
- Multi-column forms stack vertically on small screens.
- Purchase line rows stack into touch-friendly sections.
- Modals become bottom-sheet-like full-width panels on phones.
- File attachment must work from a phone camera/photo picker where the browser permits it.
- Tables may scroll horizontally inside their own table container rather than forcing the entire page to scroll.

## 6. Visual theme standard

The application must not be limited to a generic CRM appearance. Visual design is an explicit product layer and must feel appropriate for a food business.

Initial visual themes:

1. `Spice Garden` — warm cream, green and earthy accents.
2. `Turmeric Market` — golden, lively and food-forward.
3. `Heritage Masala` — deep, rich and traditional.

Themes change visual presentation only. They do not change business logic, database structure or workflow. Theme preference is stored locally on the device during MVP; persistent per-user theme preference can be added later.

Future themes may be added without changing business functionality.

## 7. Non-technical-user rule

The interface should guide the user toward the next useful action rather than requiring navigation or duplicate data entry. Related-master creation should happen in context whenever a required choice is missing.

## 8. Preservation rule

Existing working business logic and database architecture must not be redesigned merely for visual preference. New UI work should reuse shared components and established patterns, adding only the behavior required by this standard or by an approved business decision.
