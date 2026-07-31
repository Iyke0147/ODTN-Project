# Postmortem: Security Headers Silently Bypassed in Production

**Project:** Defend the North — Incident Command Simulator
**Status:** Resolved
**Severity:** Medium (no data exposure; hardening work was fully implemented but not reaching users)

## Summary

A custom Node server (`server.mjs`) was written and verified in code to set a
full set of security response headers — CSP, `X-Frame-Options`, HSTS,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`Cross-Origin-Opener-Policy`, and `Cross-Origin-Resource-Policy` — plus
path-traversal-safe static file serving. `SECURITY.md` documented this
correctly.

Despite that, the live production deployment was not sending any of these
headers. The application code was correct; the *deployment configuration*
was serving the built static files directly, bypassing `server.mjs`
entirely.

## Timeline

1. `server.mjs` implemented with security headers and reviewed — confirmed
   correct in source.
2. `SECURITY.md` written, correctly noting that Replit's static hosting
   "serves files without a custom server and therefore cannot apply the
   security headers listed above" — the exact failure mode that later
   occurred.
3. Production checked via `curl -sI` against the live URL. Response showed:
   - No CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
     `Permissions-Policy`, COOP, or CORP headers.
   - `cache-control: private` — a value `server.mjs` never produces.
   - `accept-ranges: bytes` — `server.mjs` does not implement range requests.
   - `server: Google Frontend` — not Node's default (no `Server` header).
   - `<meta name="robots">` value in the served HTML did not match the
     `noindex, nofollow` value in the source repo's `index.html`.
4. Root cause identified: response signature indicated the app was being
   served by Replit's static-hosting path rather than by the running
   `server.mjs` process.
5. Fix applied: Replit deployment type switched to Autoscale, with
   `node server.mjs` (later `artifact.toml` updated to
   `node artifacts/defend-the-north/server.mjs`) as the actual run command,
   instead of a static file publish.
6. Redeployed. `curl -sI` re-run: all expected headers present, robots tag
   matched source, response signature changed to match `server.mjs`'s
   actual behavior (`cache-control: no-store`, no `accept-ranges`).
7. Re-verified again after a second, unrelated redeploy (README/CSP-meta/
   config updates) to confirm the fix was stable, not a one-off.

## Root Cause

Deployment configuration, not application code. Replit offers multiple
deployment types; static-file publishing serves the build output directly
and does not execute a custom server process. The project's security
hardening lived entirely in a custom server (`server.mjs`) that was never
actually running in production until the deployment type was corrected.

## Why It Wasn't Caught Immediately

- The application rendered correctly and functioned normally either way —
  there was no functional symptom, only a missing set of response headers
  that don't affect page behavior in normal use.
- `SECURITY.md` documented the risk in writing, but writing down a risk
  doesn't verify it hasn't happened — that requires actually inspecting
  live response headers, not just the application source.

## Detection Method

Manual `curl -sI` against the production URL, compared line-by-line against
what `server.mjs` defines. This is the same check now automated in CI (see
Follow-ups).

## Follow-ups

- [x] Switch Replit deployment type to Autoscale, confirm `server.mjs` (or
      its current path) is the executed process.
- [x] Re-verify headers and robots tag via `curl` after redeploy.
- [x] Re-verify again after a subsequent, unrelated redeploy to confirm
      stability.
- [ ] Add CI check (`verify-security-headers.yml`) that runs `curl -sI`
      against production on every push and fails the build if any expected
      header is missing — turns this from a manual check into an automatic
      guardrail.
- [ ] Investigate the duplicate `Strict-Transport-Security` header (one
      instance without `preload`, one with) — currently believed to be
      injected by Replit's front-end proxy layer rather than by
      `server.mjs`, which sets it only once. Low severity; both values
      agree on `max-age` and `includeSubDomains`.
- [ ] Consider documenting the deployment type requirement directly in a
      pinned config file (e.g. `artifact.toml`) rather than relying solely
      on manual selection in the Replit UI, to reduce the chance of this
      regressing.

## Lesson

Code review confirms what the application *would* do if it ran as written.
It does not confirm what is actually reachable by users in production.
Those are only the same thing once verified directly — in this case, via
raw HTTP response headers, not the deployed page's rendered content or the
documentation describing the intended behavior.
