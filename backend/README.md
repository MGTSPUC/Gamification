# ClassUp live service

Prepared implementation; production activation still requires owner authorization and an Apps Script Web App deployment. The current GitHub Pages app stays a demo until activation and end-to-end verification finish.

## Architecture

The production interface runs inside Apps Script HTML Service and calls `classupApi` through `google.script.run`. GitHub remains the versioned code and badge host; its entry page will link to the deployed app. This avoids sending credentials in query strings, JSONP or opaque cross-origin requests. There is no public score endpoint and no demo bypass in the live app.

`Code.gs` contains the service. `build-live.mjs` generates the live client from the existing prototype UI and embeds it into a self-contained deployment file under `production/Code.gs`. Keep server code out of the client HTML. Set `CU_DB` and `CU_SOURCE` only in the private Apps Script project. Use the provided manifest to constrain Sheets access to read-only.

## Data and permissions

- Existing login username/password values are checked server-side against columns A/E/F in `แสดงผล`. Neither passwords nor the account list are sent to the browser. Conflicting duplicate accounts fail closed.
- This compatibility adapter does not migrate the existing plaintext passwords in the registration spreadsheet. Spreadsheet editors can still read them; a separate migration to managed identity or a password-hash store is required to remove that legacy exposure. It does not duplicate plaintext credentials in any new store.
- Scores are read directly from `รวม`, keyed by student ID/course/group. Rank uses AO and group-specific percentiles; Supreme includes everyone tied with the fifth highest score. Students cannot request another student's enrollment.
- Only the authenticated student's component scores, total and extra/net scores are returned. Peer rows contain only generated/chosen aliases, avatar, position, rank and an `isYou` marker. Initial aliases are generated rather than copied from real names.
- Blank raw project AK means project pending even if AL is formula-zero. Explicit 0 in AK is a published zero. Blank exams remain null. Score-entry conventions must continue distinguishing blank and assessed zero.
- Profile preferences live in Script Properties, keyed by a hash of the student ID; the service does not write to either spreadsheet.
- A one-hour opaque session is held in browser memory and server CacheService. Reload requires signing in again. Cache eviction fails closed. Logout removes the server session; a changed source password invalidates existing sessions.
- Login rate counters use bounded, persistent property buckets and a global limit. There are no password logs. API exceptions return generic error codes.
- Cosmetic ranges and rank gates are enforced by the server on save and on display. The maximum current rank across enrollments governs access; this is not a permanent historical reward ledger.

## Checks

Run from the local workspace root:

    node work/classup/backend/build-live.mjs
    node --check work/classup/production/app.js
    node work/classup/backend/test.mjs

Tests cover session rejection/revocation/logout, incorrect login, rate limiting, score ties, multiple courses, privacy of payloads, blank versus zero, avatar validation and rendering all live pages with the API contract. They use synthetic fixtures only.

Still required before rollout: owner OAuth authorization, deploy execute-as-owner Web App, verify actual login with an authorized test account, verify score parity and avatar persistence, and update the GitHub entry point to the verified deployment URL. Do not mark production connected before those checks.

Docs: https://developers.google.com/apps-script/guides/web and https://developers.google.com/apps-script/guides/html/reference/run
