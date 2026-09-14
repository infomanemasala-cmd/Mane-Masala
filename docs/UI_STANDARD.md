# Mane Masala UI Standard

Version: UI-STD-1.0

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

Every master page has one clear primary create action using the name of the record being created.

| Page | Primary action | Dialog title |
| --- | --- | --- |
| Items | `+ Create Item` | `Create Item` |
| Categories | `+ Create Category` | `Create Category` |
| Units | `+ Create Unit` | `Create Unit` |
| Suppliers | `+ Create Supplier` | `Create Supplier` |
| Customers | `+ Create Customer` | `Create Customer` |
| Sub-Agents | `+ Create Sub-agent` | `Create Sub-agent` |

The same terminology must be used on the page heading, primary button, dialog heading and final submit action. System-generated permanent business codes are not typed by the user.

## 3. Create-related-record action inside dropdowns

When a form requires a master record that may not yet exist, the selection control must provide a create action in the dropdown itself.

For example, Create Item > Category must behave like:

```text
No category
CAT-001 — Chutney Pudi
CAT-002 — Masala
...
----------------------
+ Create new category
```

Rules:

- Use a custom select/combobox when a native HTML select cannot contain an actionable create command.
- The `+ Create new ...` action is visually separated from normal choices.
- Selecting it opens a small create dialog without closing or losing the parent form.
- The user can create the missing record without manually navigating away from the parent form.
- After successful creation, the new record is immediately added to the dropdown and automatically selected.
- The parent form remains intact, including all values already entered.
- The same pattern is reusable for Item Type and other master dependencies where appropriate.
- Creation still uses the normal master rules, permissions and system-generated permanent code.

## 4. Non-technical-user rule

The interface should guide the user toward the next useful action rather than requiring navigation or duplicate data entry. Related-master creation should happen in context whenever a required choice is missing.

## 5. Preservation rule

Existing working behavior must not be redesigned merely for visual preference. New UI work should reuse shared components and established patterns, adding only the behavior required by this standard or by an approved business decision.
