# Mane Masala — Wife Usability Reference

The wife is the primary operational user and is essentially a zero-computer user. UX decisions are business requirements, not cosmetic preferences.

## Core rules
- Use plain business language.
- Show names and useful business information, not raw database UUIDs.
- Keep only fields the user needs to make the business decision.
- Use one obvious primary action per step.
- Show what has happened, what is needed now and what happens next.
- Important stock/financial actions require clear confirmation.
- Preserve user-entered data when opening related-master creation.
- Avoid duplicate confirmation mechanisms such as a checkbox plus an action button unless separately approved.
- Use tables for repeated line data rather than repeating large blocks of fields.
- On mobile/tablet, reflow forms, keep controls touch-friendly and allow contained horizontal scrolling for unavoidable tables.

## Purchase screen language
Prefer:
- Supplier
- Purchase No. (system generated)
- Supplier slip / bill reference (optional)
- Items bought
- Receive & inspect
- Accepted
- Rejected / damaged
- Shortage (calculated)
- Supplier will honour / will not honour / waiting
- Credit / Refund / Disputed
- Complete purchase
- Proceed to supplier payment

Do not make the wife enter a supplier UUID, database ID, calculated refund amount or manually calculated shortage.

## Order / production approval language
Prefer decision-oriented actions such as:
- Approve this item
- Approve partially
- Purchase required
- Review plan
- Confirm order
- Order fulfilment

A raw-material table should make the decision visible: Raw Material, Needed, Current Stock, Reserved, Net Available. Do not hide the reason a production item is blocked.

## Status visibility
Statuses may be technical in the database, but the UI should translate them into understandable business states and provide the next action. Never invent a near-duplicate status merely to make UI text easier.

## Error handling
Errors should say what went wrong and what the user can do next. Avoid stack traces, RPC names, UUIDs or database terminology in normal user-facing messages.
