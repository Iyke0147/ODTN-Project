# Defend the North: Incident Command Simulator

An educational cybersecurity incident-response simulation set in a fictional Canadian healthcare organization, NorthStar Health Services.

## Purpose

This simulation teaches incident-response decision-making through four sequential scenarios drawn from a real-world cyberattack scenario. Visitors act as members of an IR team and must make critical decisions about account security, network containment, crisis communication, and public relations. Every decision is evaluated against industry best practices, with educational explanations and a final rated report.

## Features

- **Incident Briefing** — Background on the fictional organization, active threat indicators, and optional team name entry
- **Security Operations Dashboard** — Live-updating metrics (security score, business continuity score, public trust score), a simulated alert feed, and an incident timeline
- **Decision Room** — Four sequential decisions with immediate feedback, score impact display, and key security lessons
- **After-Action Report** — Final total score, score breakdown, decision review, positive actions, areas for improvement, security lessons, and a performance rating

## Ratings

| Score Range | Rating                           |
|-------------|----------------------------------|
| 85–100      | Incident Commander               |
| 70–84       | Strong Responder                 |
| 50–69       | Developing Analyst               |
| Below 50    | Response Plan Requires Improvement |

## Technology

- Pure HTML5, CSS3, and vanilla JavaScript (ES modules)
- No external libraries, frameworks, or APIs
- No backend, database, or server-side processing
- All state is held in JavaScript memory only — nothing is transmitted or persisted

## Files

```
index.html     — Application structure (4 views) and Content Security Policy
src/styles.css — SOC-themed dark navy stylesheet with responsive layout
src/script.js  — All simulation logic, state, and DOM interaction
README.md      — This file
SECURITY.md    — Security design documentation
```

## Testing Checklist

### Navigation
- [ ] Click "Begin Simulation" → transitions to dashboard
- [ ] Click "Enter Decision Room" → transitions to decision room
- [ ] All four decisions advance in sequence
- [ ] Final decision transitions to After-Action Report
- [ ] "Restart Simulation" returns to briefing with all state cleared

### Team Name Validation
- [ ] Empty team name is accepted (field is optional)
- [ ] Valid name (letters, numbers, spaces, hyphens, apostrophes) is accepted
- [ ] Name with special characters (e.g. `<script>`) is rejected with an error message
- [ ] Name over 40 characters cannot be entered (maxlength enforced)
- [ ] Error message disappears when corrected input is supplied

### Score Calculations
- [ ] Selecting all optimal answers produces a score ≥ 85 (Incident Commander)
- [ ] Selecting all poor answers produces a score < 50 (Response Plan Requires Improvement)
- [ ] Scores update visually after each decision
- [ ] Score meters animate to new values

### Decision Room
- [ ] Only one option can be selected per decision (radio button group)
- [ ] Options are locked after selection (no re-selection)
- [ ] Feedback panel appears immediately after selection
- [ ] Best option is always highlighted in green after locking
- [ ] "Next Decision" button appears only after a selection is made

### After-Action Report
- [ ] All four decisions appear in the review section
- [ ] Team name appears if one was entered; hidden if field was left empty
- [ ] Positive actions list shows only optimal decisions
- [ ] Areas for Improvement shows only suboptimal or poor decisions
- [ ] Security lessons appear correctly numbered

### Restart
- [ ] All scores reset to 60
- [ ] Alert feed is cleared
- [ ] Timer resets to 00:00:00
- [ ] Team name field is cleared
- [ ] Decision progress resets to 0 of 4

### Accessibility
- [ ] All views navigable by keyboard alone (Tab, Shift+Tab, Enter, Space)
- [ ] Focus moves to the heading when a new view appears
- [ ] All form inputs have visible focus rings
- [ ] Screen reader announcements fire for alert feed additions
- [ ] Score meters have aria-valuenow updates

### Mobile
- [ ] Layout renders without horizontal scroll on 375px width
- [ ] Buttons are comfortably tappable
- [ ] Score cards stack vertically on small screens
- [ ] Decision card is readable and usable on mobile

### Console
- [ ] No JavaScript errors in browser console during normal flow
- [ ] No errors on restart

## Publishing

1. Push the project to your hosting provider of choice (static file hosting is sufficient — no server is required).
2. Ensure `index.html`, `src/styles.css`, and `src/script.js` are all served from the same origin so the Content Security Policy `default-src 'self'` allows them.
3. No build step is required. Vite is used only to serve the files locally during development.

## Licence

Educational use only. Not for commercial distribution.
