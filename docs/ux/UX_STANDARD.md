# Mane Masala — Wife-Friendly UX Standard

## Primary user
The wife is essentially a zero-computer user. The application must feel like a simple business assistant, not a database form.

## Rules
- Plain business language.
- One obvious next action per operational screen.
- Minimal fields; hide technical IDs unless useful for traceability.
- System-generated business codes are displayed; users do not type them.
- Use tables for repeated line items, with clear headings and contained horizontal scrolling on small screens.
- One clear primary action per form/step.
- Strong confirmation for important stock/financial actions.
- Errors explain what to do next in plain language.
- Preserve entered context when opening related-master creation.
- Search should work by useful business name/code where appropriate.
- Keep Current Stock, Reserved and Net Available distinct; never visually merge them.
- Status wording should describe the business action, not database state.

## Purchase UX
Use the sequence: **Record Purchase → Check What Arrived → Review Shortage/Damage → Finish & Pay**. Show supplier name/business information rather than raw Supplier UUID. The system generates the Purchase No.; the physical supplier slip/bill reference is optional.

For each purchase line, make Received, Accepted and Rejected/Damaged easy to record. Calculate shortage automatically. Show a complete summary and supplier response. If supplier refuses a claim, visibly label it disputed instead of silently reducing payable.

## Order UX
Use: **Order → Check Stock → Approve Production → Produce → Dispatch**. For multi-line orders, each line can show its own state. Avoid technical wording where a plain phrase such as “Can make it”, “Can make part”, or “Purchase required” communicates the decision better.

## Mobile
Responsive reflow, one-column forms where appropriate, touch-friendly controls, full-width primary actions where useful, usable modal/bottom-sheet treatment, contained horizontal table scrolling and camera/file picker support.

## Branding
Use the supplied Mane Masala logo and fixed company name. Do not redesign the logo. Visual polish is secondary to functional consistency.
