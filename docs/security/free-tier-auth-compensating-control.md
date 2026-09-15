# Free-tier Auth security compensating control

## Scope
Supabase Free does not provide Supabase Auth's built-in leaked-password protection. This is a documented platform limitation, not an application defect.

## Compensating control
Mane Masala rejects new passwords unless they:
- contain at least 12 characters;
- contain lowercase and uppercase letters;
- contain a number;
- contain a symbol; and
- are absent from the Have I Been Pwned Pwned Passwords corpus.

The Pwned Passwords check uses k-anonymity: the browser computes SHA-1 locally, sends only the first five hash characters, and compares the returned suffixes locally. The full password is never sent to the password-breach service.

The check runs before Supabase Auth `signUp`. Sign-in is unaffected so existing credentials continue to work.

## Residual platform finding
Supabase Security Advisor may continue to report the platform-level leaked-password-protection setting as unavailable on Free. This is accepted as a known platform limitation for the MVP and is not represented as if the Supabase native feature were enabled.

## Upgrade path
When the project moves to Supabase Pro, enable native leaked-password protection and retain the application-side check as defense in depth unless there is a reason to remove it.
