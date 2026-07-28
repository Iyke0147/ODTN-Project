# Security Design Documentation

**Defend the North: Incident Command Simulator**
Version 1.0 — Educational static web application

---

## Overview

This document explains the security decisions made in the design and implementation of this application. Although the application is a static educational tool with no backend, user accounts, or sensitive data processing, deliberate security controls have been applied as best-practice examples and to honour the spirit of the subject matter.

---

## Content Security Policy

A `Content-Security-Policy` meta tag is included in `index.html`:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
form-action 'self';
frame-ancestors 'none';
```

**Key controls:**

- `default-src 'self'` — blocks all resources not served from the same origin by default
- `script-src 'self'` — prevents loading of third-party scripts that could execute malicious code
- `img-src 'self' data:` — allows only locally served images and inline SVG/data URIs; blocks exfiltration via image beacons
- `form-action 'self'` — prevents form submissions to external origins

> Note: `'unsafe-inline'` is present in both `script-src` and `style-src` to support Vite's development-mode injection of the HMR client script and inline style tags. In a fully static production deployment (no Vite dev server), both can be removed, leaving `script-src 'self'` and `style-src 'self'`.

> Note on `frame-ancestors`: this directive is **silently ignored by all browsers when delivered via a `<meta>` tag** — it is only honoured in HTTP response headers. It has therefore been omitted from the meta CSP. For production deployments, set `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` as HTTP headers on the web server to achieve clickjacking protection.

---

## No innerHTML for Dynamic Content

All user-supplied or dynamically generated text is rendered exclusively via `textContent` or explicit DOM node creation. No use of `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write()` appears anywhere in `script.js`.

This prevents Cross-Site Scripting (XSS) attacks even if input validation were somehow bypassed.

**Relevant code pattern (from script.js):**
```javascript
// Security: textContent — never innerHTML
el.textContent = userSuppliedValue;
```

---

## Team Name Input Validation

The optional team name field is the only user-controlled input. It is protected by:

1. **`maxlength="40"` attribute** — enforced by the browser; limits input length at the DOM level before JavaScript runs
2. **Trim before validation** — leading/trailing whitespace is stripped with `.trim()`
3. **Allowlist regex** — only letters, numbers, spaces, hyphens, and apostrophes are permitted:
   ```javascript
   /^[A-Za-z0-9 '\-]+$/.test(value)
   ```
4. **Never transmitted** — the value exists only as a JavaScript variable in the current page session
5. **Rendered via textContent** — the validated value is inserted using `textContent`, never `innerHTML`
6. **aria-invalid** — set to `true` on invalid input to notify screen readers

---

## No eval() or Dynamic Code Execution

The application does not use:
- `eval()`
- `Function()` constructor
- `setTimeout(string)` / `setInterval(string)` with string arguments
- `document.write()`
- Dynamic `<script>` tag injection
- `import()` with user-controlled paths

All logic is in the statically loaded `src/script.js` module.

---

## Event Listeners Only — No Inline Handlers

All interactivity is wired with `addEventListener`. The HTML contains no `onclick`, `onchange`, `onsubmit`, `onkeydown`, or other inline event handler attributes. This separation ensures the Content Security Policy's script controls apply correctly and makes the codebase easier to audit.

---

## No External Dependencies

The application loads:
- Zero third-party JavaScript libraries
- Zero external API calls
- Zero analytics, tracking, or telemetry scripts
- Zero cookies

This eliminates the entire supply-chain risk category from external JavaScript dependencies. There is no `package-lock.json` or `node_modules` in the deployed artifact.

---

## Data Handling

All simulation state is held exclusively in JavaScript memory variables within the current page session:
- No `localStorage` or `sessionStorage` writes
- No `IndexedDB` writes
- No cookie creation (`document.cookie` is never written)
- No `fetch()`, `XMLHttpRequest`, or `WebSocket` calls to external services
- No user-entered data is included in URL parameters

When the user navigates away, refreshes, or restarts the simulation, all state is discarded.

---

## No Hidden Pages or Developer Backdoors

The application contains exactly four visible views:
1. Incident Briefing
2. Security Operations Dashboard
3. Decision Room
4. After-Action Report

There are no hidden administrator pages, debug endpoints, developer overrides, or score manipulation shortcuts. The `showView()` function accepts only the four valid view IDs.

---

## No Exposed Credentials or Secrets

The application contains no API keys, tokens, passwords, connection strings, or secret values of any kind. There is nothing to protect at rest or in transit.

---

## External Links

The application contains no outbound links. If any were added in future, they would require `rel="noopener noreferrer"` as an attribute to prevent the destination page from accessing the originating window's context.

---

## Semantic HTML and Accessibility Controls

Accessibility controls are security-adjacent in that they prevent users from being confused or misled:
- All views use `aria-hidden="true"` when not active, preventing screen readers from announcing hidden content
- `aria-live` regions are used for the alert feed and score displays
- `aria-invalid` is set on the team name input when validation fails
- `role="alert"` is used for the security disclaimer banner

---

## Recommended Production Hardening

If this application were deployed to a production web server (beyond the static file host), the following additional HTTP response headers should be set at the server level:

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

The `frame-ancestors 'none'` in the CSP meta tag already handles framing for supporting browsers, but `X-Frame-Options` provides broader browser coverage.

---

## Reporting Security Issues

This is an educational simulation with no network-accessible backend. If you identify a client-side security issue, please document it as a learning example — the application's purpose is to model good security practices.
