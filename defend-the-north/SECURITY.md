# Security Policy

**Defend the North: Incident Command Simulator**
Version 2.0 — Educational static web application

---

## About This Application

Defend the North is an **educational cybersecurity incident-response simulation**. It presents a fictional scenario involving a fictional Canadian healthcare organization and guides users through four sequential decision points. No real organisation, patient, or employee data is involved.

**Important notices:**
- This application implements **no real authentication**. There are no user accounts, sessions, or login flows.
- Users must **not** enter real credentials, passwords, patient data, or any confidential information. The team-name field accepts a short identifier only; it is stored in memory for the duration of the simulation and discarded when the tab is closed.
- All scenario content, organization names, IP addresses, and incident data are entirely fictional.

---

## Reporting Security Vulnerabilities

Please **do not** open a public issue to report a security vulnerability.

Use GitHub's private vulnerability reporting:

**[Report a vulnerability](https://github.com/Iyke0147/Defend-the-North-Incident-Simulator/security/advisories/new)**

Include a clear description of the issue, the steps to reproduce it, and its potential impact. You will receive a response within a reasonable timeframe.

---

## Production Security Headers

The production server (`server.mjs`) sets the following HTTP response headers on every response:

| Header | Value |
|--------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=(), payment=(), usb=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `X-XSS-Protection` | `0` |

`Cache-Control: no-store` is applied to `index.html`, `robots.txt`, and `security.txt`. Versioned static assets (JS, CSS, fonts) receive `Cache-Control: public, max-age=31536000, immutable`.

**Development note:** The Vite dev server (used during local development via `pnpm dev`) applies equivalent headers where possible but includes `'unsafe-inline'` in `script-src` and `style-src` to support Vite's Hot Module Replacement client. This relaxation is development-only and is **not** present in the production server configuration.

---

## Content Security Policy Rationale

The production CSP (`script-src 'self'`, `style-src 'self'`) enforces:

- **No inline scripts** — all JavaScript is loaded from same-origin external files
- **No inline styles** — all CSS is loaded from same-origin external files; score-meter widths are set via JavaScript CSSOM (`element.style.width`) which is not restricted by `style-src`
- **No external resources** — all assets must originate from the same domain
- **No framing** — `frame-ancestors 'none'` (enforced via HTTP header, which all browsers honour; the equivalent meta tag directive is ignored by browsers)
- **Upgrade insecure requests** — any accidental HTTP sub-resource requests are upgraded to HTTPS

---

## No innerHTML for Dynamic Content

All user-supplied or dynamically generated text is rendered exclusively via `textContent` or explicit DOM node creation (`document.createElement`, `createTextNode`). The codebase contains no assignment to `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write`.

---

## Input Validation — Team Name Field

The team name input is the only user-controlled field. It is protected by:

1. `maxlength="40"` attribute — enforced by the browser before JavaScript runs
2. **Unicode NFC normalization** — prevents homoglyph attacks via alternative Unicode representations
3. **Control character removal** — strips C0/C1 control characters
4. **Zero-width character removal** — strips invisible Unicode characters (`U+200B`–`U+200D`, `U+2060`, `U+FEFF`, etc.)
5. **Whitespace trim** — leading/trailing whitespace stripped
6. **Hard cap at 40 characters** — enforced after normalization in JavaScript
7. **Allowlist regex** — `/^[A-Za-z0-9 '\-]+$/` — only letters, numbers, spaces, hyphens, apostrophes
8. **`aria-invalid` feedback** — set to `true` on rejection to inform screen readers
9. **Rendered via `textContent`** — the validated value is never passed to `innerHTML`
10. **Never transmitted** — the value lives only in a JavaScript variable for the current session

---

## No Persistent Browser Storage

This application intentionally uses **no cookies**, **no `localStorage`**, **no `sessionStorage`**, **no `IndexedDB`**, and makes **no `fetch`, `XMLHttpRequest`, or `WebSocket` calls** to external services. All simulation state is held in JavaScript memory variables and is discarded when the browser tab is closed or the page is refreshed.

---

## No Secrets or Credentials in Source

The application contains no API keys, tokens, passwords, connection strings, or secret values. There is nothing to protect at rest or in transit beyond the static files themselves.

---

## No eval() or Dynamic Code Execution

The application does not use:
- `eval()`
- `Function()` constructor
- `setTimeout(string)` / `setInterval(string)` with string arguments
- Dynamic `<script>` injection
- `import()` with user-controlled paths

---

## Supply-Chain Security

- The project uses **pnpm** with a lockfile and a `minimumReleaseAge` setting in `pnpm-workspace.yaml` that requires packages to have been published for at least 24 hours before installation (defence against supply-chain attacks via newly published malicious versions).
- A GitHub Actions workflow runs `pnpm audit --audit-level=high` on every push and pull request and fails the build if high or critical vulnerabilities are present.

---

## Replit Hosting Limitations

When deployed on Replit's static hosting:

- **HTTP response headers** set by `server.mjs` require a Replit **Autoscale** or equivalent deployment that runs a server process. Replit's pure static hosting serves files without a custom server and therefore cannot apply the security headers listed above.
- The `frame-ancestors 'none'` directive in the CSP is only effective when delivered as an HTTP response header. If the app is served without `server.mjs`, this clickjacking protection is not active.
- `Strict-Transport-Security` is only meaningful over HTTPS. Replit's `.replit.app` domains are served over HTTPS; local development (`localhost`) is HTTP only, so HSTS has no effect in development.

---

## Recommended Hardening for Production Deployment

When deploying to a production web server, ensure:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; ...
```

These are already implemented in `server.mjs`. If using a CDN or reverse proxy in front of `server.mjs`, verify that it does not strip or override these headers.
