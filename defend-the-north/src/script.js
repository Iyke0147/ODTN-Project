/**
 * Defend the North: Incident Command Simulator
 * script.js — All application logic
 *
 * Security controls:
 * - No eval(), document.write(), or innerHTML for user content
 * - All dynamic content rendered with textContent
 * - Team name validated with allowlist regex before use
 * - Event listeners registered with addEventListener only
 * - All simulation state stored in memory-only JS variables
 * - No data is transmitted or persisted beyond the browser session
 */

'use strict';

/* =====================================================
   SIMULATION DATA
   ===================================================== */

/** Starting scores — mid-range to reflect an active incident */
const INITIAL_SCORES = { security: 60, businessContinuity: 60, publicTrust: 60 };

/**
 * Four sequential decisions.
 * Each option has:
 *   text      — option label (rendered via textContent)
 *   scores    — delta applied to each score dimension
 *   quality   — 'best' | 'okay' | 'poor'
 *   feedback  — explanation shown after selection
 *   lesson    — key security principle to reinforce
 */
const DECISIONS = [
  {
    id: 1,
    tag: 'Account Security',
    question: 'A privileged service account may have been compromised. What should the team do?',
    options: [
      {
        text: 'Disable the account immediately',
        scores: { security: 15, businessContinuity: -3, publicTrust: 8 },
        quality: 'best',
        feedback: 'Correct decision. Immediately disabling the compromised account halts the attacker\'s ability to use that access path. The short disruption to any service relying on the account is an acceptable trade-off to stop an active threat. This aligns with the principle of containment: stop the bleeding before investigating.',
        lesson: 'In incident response, containment is prioritized over convenience. A disabled account cannot be exploited; an active one can. Re-enabling after investigation is straightforward; recovering from a fully compromised network is not.'
      },
      {
        text: 'Reset the password but leave it active',
        scores: { security: -5, businessContinuity: 2, publicTrust: -3 },
        quality: 'okay',
        feedback: 'Partial action only. Resetting the password may not be sufficient if the attacker has already established persistence through other means — for example, active session tokens, OAuth grants, API keys, or additional backdoor accounts created during the intrusion. Leaving the account active creates ongoing risk.',
        lesson: 'Password resets alone do not invalidate active sessions or third-party tokens. Full account disablement, combined with a session revocation, is required to cut off attacker access reliably.'
      },
      {
        text: 'Continue monitoring without taking action',
        scores: { security: -20, businessContinuity: -5, publicTrust: -15 },
        quality: 'poor',
        feedback: 'Insufficient and dangerous. Deferring action while monitoring allows the attacker to continue operating, escalate privileges, access additional systems, and exfiltrate data. Every minute of inaction increases both the technical damage and the regulatory exposure.',
        lesson: 'Monitoring without containment is observation, not response. The NIST Incident Response lifecycle requires containment as an active step — passive observation during an active intrusion is not an acceptable substitute.'
      }
    ]
  },
  {
    id: 2,
    tag: 'Network Containment',
    question: 'Suspicious activity has reached two critical servers. What should the team do?',
    options: [
      {
        text: 'Isolate the affected network segment',
        scores: { security: 12, businessContinuity: -5, publicTrust: 8 },
        quality: 'best',
        feedback: 'Sound decision. Isolating only the affected network segment limits the blast radius of the attack without shutting down the entire organization. Patient-facing systems and unaffected facilities can continue operating, preserving business continuity while the threat is contained.',
        lesson: 'Targeted network isolation is a proportionate containment response. The goal is to stop lateral movement, not to achieve total network shutdown. Segmentation — both as a preventive architecture and an incident response tactic — is a core defence principle.'
      },
      {
        text: 'Shut down the entire company network',
        scores: { security: 5, businessContinuity: -20, publicTrust: -5 },
        quality: 'poor',
        feedback: 'Disproportionate action. Shutting down the entire network of a healthcare organization risks patient safety, disrupts clinical operations, and triggers regulatory obligations around system availability. A targeted response that isolates affected segments achieves containment with far less collateral damage.',
        lesson: 'Incident response decisions must be proportionate. In healthcare environments, network availability is directly tied to patient safety. A total shutdown should only be considered when no targeted isolation is possible and the threat is pervasive.'
      },
      {
        text: 'Keep systems online while gathering more evidence',
        scores: { security: -20, businessContinuity: 5, publicTrust: -10 },
        quality: 'poor',
        feedback: 'High risk. Keeping compromised systems online while gathering evidence may preserve short-term availability, but allows the attacker to continue lateral movement, data exfiltration, and potential destruction. Evidence can also be collected from isolated systems; containment does not preclude forensics.',
        lesson: 'Evidence collection and containment are not mutually exclusive. Forensic imaging and log capture can be performed on isolated systems. Prioritizing evidence gathering over containment during an active attack is a dangerous misapplication of priorities.'
      }
    ]
  },
  {
    id: 3,
    tag: 'Crisis Communication',
    question: 'Senior management wants an immediate incident update. What should the team communicate?',
    options: [
      {
        text: 'Provide confirmed facts, known risks, actions taken, and current uncertainties',
        scores: { security: 5, businessContinuity: 8, publicTrust: 15 },
        quality: 'best',
        feedback: 'Excellent approach. Transparent, factual communication allows management to make informed decisions, allocate resources appropriately, and prepare for potential regulatory notifications. Clearly distinguishing confirmed facts from working hypotheses prevents uninformed escalation.',
        lesson: 'Effective crisis communication distinguishes clearly between what is known, what is suspected, and what is unknown. Overconfident briefings that later require correction damage trust more than careful acknowledgment of uncertainty.'
      },
      {
        text: 'Tell management there is no serious problem',
        scores: { security: -3, businessContinuity: -5, publicTrust: -20 },
        quality: 'poor',
        feedback: 'Misleading and harmful. Understating the incident to management prevents appropriate resource allocation, delays notification to regulators and insurers, and may constitute a breach of reporting obligations. When the true scope becomes clear, organizational trust in the security team will be severely damaged.',
        lesson: 'Minimizing or concealing incidents from leadership is a serious governance failure. Privacy laws in Canada (including PIPEDA and provincial health legislation) require timely notification of significant breaches — deliberate concealment can trigger regulatory penalties.'
      },
      {
        text: 'Wait until the investigation is complete before briefing anyone',
        scores: { security: -3, businessContinuity: -8, publicTrust: -8 },
        quality: 'okay',
        feedback: 'Not advisable. Waiting for a complete picture before briefing management delays critical decisions: legal, regulatory, communications, and resource questions cannot be addressed without leadership awareness. Timely briefings with clear uncertainty flags are expected.',
        lesson: 'Management briefings during an incident do not require complete information — they require current information with clear uncertainty flags. Regular cadence updates are standard practice; one final report at the end is not.'
      }
    ]
  },
  {
    id: 4,
    tag: 'Public & Media Relations',
    question: 'A journalist contacts the organization asking whether customer information was exposed. What should the organization do?',
    options: [
      {
        text: 'Coordinate a verified response through legal and communications teams',
        scores: { security: 5, businessContinuity: 8, publicTrust: 15 },
        quality: 'best',
        feedback: 'Correct approach. External statements about a security incident must be coordinated between legal counsel, communications, and the incident response team to ensure accuracy, meet regulatory obligations, and avoid statements that could undermine the investigation or create additional legal liability.',
        lesson: 'Media and public communications during an incident are a legal and reputational matter, not just an operational one. Speaking without legal and communications coordination — even with good intentions — can worsen outcomes, contradict regulatory disclosures, or inadvertently confirm unverified details.'
      },
      {
        text: 'Deny that an incident occurred',
        scores: { security: -3, businessContinuity: -5, publicTrust: -25 },
        quality: 'poor',
        feedback: 'Serious misstep. Publicly denying an incident that later proves real creates severe reputational and legal consequences. False statements to media can compound regulatory violations, increase civil liability, and permanently damage public trust in the organization — and in Canadian healthcare organizations, may trigger mandatory breach notifications that make the denial untenable.',
        lesson: 'Denial of a real incident is nearly always worse than acknowledgment. "No comment while we investigate" or "We are aware of reports and are investigating" are legally defensible; false denials are not. Candour, within legal boundaries, is the more sustainable and ethical path.'
      },
      {
        text: 'Publish full technical investigation details immediately',
        scores: { security: -12, businessContinuity: -5, publicTrust: -5 },
        quality: 'poor',
        feedback: 'Counterproductive and risky. Publishing technical details of an ongoing investigation can expose additional attack vectors to threat actors, interfere with forensic evidence, and disclose patient or employee data prematurely. It may also violate regulatory obligations that require controlled disclosure processes.',
        lesson: 'Technical details of an active investigation are sensitive. Premature disclosure can enable further exploitation, compromise law enforcement cooperation, and violate privacy regulations. Public communications should describe impact and organizational response — not technical vulnerability details — until the investigation is complete.'
      }
    ]
  }
];

/** Alert feed entries — displayed progressively during the dashboard view */
const ALERT_FEED_ITEMS = [
  { level: 'critical', text: 'Multiple failed administrator login attempts detected on DC01 from 185.220.101.x' },
  { level: 'critical', text: 'PowerShell launched with Base64-encoded command on WKSTN-047' },
  { level: 'warning',  text: 'Service account svc_backup logged in from unusual device — MAC mismatch' },
  { level: 'warning',  text: 'Possible lateral movement detected: new SMB connections from SRV-DB02' },
  { level: 'critical', text: 'Large outbound data transfer observed: 4.2 GB to 91.108.56.x (Tor exit node)' },
  { level: 'warning',  text: 'EDR agent disabled on WKSTN-094 — possible tamper or policy bypass' },
  { level: 'info',     text: 'Firewall rule updated: outbound block applied to flagged IP range' },
  { level: 'warning',  text: 'Kerberoasting activity detected — SPN enumeration on domain controller' },
  { level: 'info',     text: 'Forensic image initiated on SRV-DB02 — collection in progress' },
  { level: 'critical', text: 'New privileged account created: svc_maint2 — source: WKSTN-047' },
  { level: 'info',     text: 'SIEM correlation rule triggered: 14 matching events in 5-minute window' },
  { level: 'warning',  text: 'Scheduled task added on SRV-FS01 — persistence mechanism suspected' }
];

/** Security lessons displayed in the After-Action Report */
const SECURITY_LESSONS = [
  'Containment before cure: in an active intrusion, limiting the attacker\'s access takes precedence over investigation. Disabled accounts and isolated segments can be restored; exfiltrated data cannot be recalled.',
  'Proportionate response: incident decisions should be calibrated to the threat. A targeted segment isolation is almost always preferable to a full network shutdown in a healthcare environment.',
  'Timely, honest communication: leadership, legal, and regulatory contacts must receive factual, uncertainty-flagged briefings as early as possible. Delayed or minimized communication consistently worsens outcomes.',
  'Coordinated disclosure: external communications during an incident must be reviewed by legal and communications professionals. Technical details of an active investigation should not be published publicly.',
  'Defence in depth: this incident leveraged a single compromised service account to achieve lateral movement. Multi-factor authentication, least-privilege principles, and network segmentation are the key preventive controls.',
  'Incident response planning: organizations that practice tabletop exercises and maintain current IR playbooks respond faster and contain breaches more effectively. Regular drills are not optional — they are the difference between containment and catastrophe.'
];

/* =====================================================
   APPLICATION STATE
   Security: all state is in-memory JS variables only.
   Nothing is persisted to localStorage, sessionStorage,
   cookies, or any external service.
   ===================================================== */

let state = {
  teamName: '',            // Validated team name (may be empty)
  scores: { ...INITIAL_SCORES },
  currentDecision: 0,     // 0-based index into DECISIONS array
  decisionsData: [],       // Array of { decisionIndex, optionIndex, quality } per decision made
  timerInterval: null,
  alertInterval: null,
  alertIndex: 0,
  elapsedSeconds: 0,
  simulationStarted: false,
};

/* =====================================================
   SECURITY: TEAM NAME NORMALIZATION AND VALIDATION
   All input is normalized before validation:
     1. Unicode NFC (canonical composition)
     2. Control characters stripped (C0/C1 except printable)
     3. Zero-width / invisible characters stripped
     4. Whitespace trimmed
     5. Hard cap at 40 characters
   Allowlist regex — only permits letters, numbers,
   spaces, hyphens, and apostrophes.
   The value is NEVER inserted with innerHTML.
   ===================================================== */

/**
 * Normalize a raw team name string before validation or display.
 * @param {string} raw
 * @returns {string}
 */
function normalizeTeamName(raw) {
  let val = String(raw);
  // Step 1: Unicode NFC normalization
  val = val.normalize('NFC');
  // Step 2: Strip C0 and C1 control characters (keep printable ASCII/Unicode)
  val = val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  // Step 3: Strip zero-width and invisible Unicode characters
  val = val.replace(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD\u2028\u2029]/g, '');
  // Step 4: Trim surrounding whitespace
  val = val.trim();
  // Step 5: Hard cap at 40 characters
  return val.substring(0, 40);
}

/** @param {string} value — must already be normalized */
function isValidTeamName(value) {
  if (value.length === 0) return true;                        // Optional field
  if (value.length > 40) return false;                       // Hard cap
  return /^[A-Za-z0-9 '\-]+$/.test(value);                  // Allowlist characters
}

/* =====================================================
   VIEW MANAGEMENT
   ===================================================== */

/**
 * Show one view and hide all others.
 * Manages aria-hidden for screen readers.
 * @param {string} viewId
 */
function showView(viewId) {
  const views = document.querySelectorAll('.view');
  views.forEach(view => {
    const isTarget = view.id === viewId;
    // Toggle display class
    view.classList.toggle('view--active', isTarget);
    // Accessibility: aria-hidden on non-active views
    view.setAttribute('aria-hidden', String(!isTarget));
  });

  // Move focus to the first heading in the newly shown view
  const target = document.getElementById(viewId);
  if (target) {
    const heading = target.querySelector('h1, h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: false });
    }
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* =====================================================
   SCORE UTILITIES
   ===================================================== */

/** Clamp a value between min and max */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/** Apply a score delta object to state.scores */
function applyScoreDelta(delta) {
  state.scores.security         = clamp(state.scores.security         + (delta.security         || 0), 0, 100);
  state.scores.businessContinuity = clamp(state.scores.businessContinuity + (delta.businessContinuity || 0), 0, 100);
  state.scores.publicTrust      = clamp(state.scores.publicTrust      + (delta.publicTrust      || 0), 0, 100);
}

/** Calculate the composite total score (average of three dimensions) */
function getTotalScore() {
  return Math.round((state.scores.security + state.scores.businessContinuity + state.scores.publicTrust) / 3);
}

/** Update all score displays (dashboard + decision room) */
function updateScoreDisplays() {
  const { security, businessContinuity, publicTrust } = state.scores;

  // Dashboard meters
  setScoreEl('score-security-display', security);
  setScoreEl('score-bc-display', businessContinuity);
  setScoreEl('score-trust-display', publicTrust);
  setMeter('fill-security', 'meter-security', security);
  setMeter('fill-bc', 'meter-bc', businessContinuity);
  setMeter('fill-trust', 'meter-trust', publicTrust);

  // Decision room scores
  setScoreEl('d-score-sec', security);
  setScoreEl('d-score-bc', businessContinuity);
  setScoreEl('d-score-trust', publicTrust);

  // Update ARIA on meters
  updateMeterAria('meter-security', security);
  updateMeterAria('meter-bc', businessContinuity);
  updateMeterAria('meter-trust', publicTrust);
}

function setScoreEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function setMeter(fillId, _meterId, value) {
  const fill = document.getElementById(fillId);
  if (fill) fill.style.width = value + '%';
}

function updateMeterAria(meterId, value) {
  const meter = document.getElementById(meterId);
  if (meter) meter.setAttribute('aria-valuenow', String(value));
}

/* =====================================================
   TIMER
   ===================================================== */

function startTimer() {
  state.elapsedSeconds = 0;
  updateTimerDisplay();
  state.timerInterval = setInterval(() => {
    state.elapsedSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval !== null) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const h = Math.floor(state.elapsedSeconds / 3600);
  const m = Math.floor((state.elapsedSeconds % 3600) / 60);
  const s = state.elapsedSeconds % 60;
  const formatted = [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  const el = document.getElementById('timer-display');
  if (el) el.textContent = formatted;
}

/* =====================================================
   ALERT FEED
   ===================================================== */

function startAlertFeed() {
  state.alertIndex = 0;
  // Add first two alerts immediately
  addNextAlert();
  addNextAlert();
  // Then add one every few seconds
  state.alertInterval = setInterval(() => {
    if (state.alertIndex < ALERT_FEED_ITEMS.length) {
      addNextAlert();
    } else {
      clearInterval(state.alertInterval);
      state.alertInterval = null;
    }
  }, 3500);
}

function stopAlertFeed() {
  if (state.alertInterval !== null) {
    clearInterval(state.alertInterval);
    state.alertInterval = null;
  }
}

function addNextAlert() {
  if (state.alertIndex >= ALERT_FEED_ITEMS.length) return;
  const item = ALERT_FEED_ITEMS[state.alertIndex];
  state.alertIndex++;
  appendAlert(item.level, item.text);
  updateAlertCount();
}

/** Append an alert entry using textContent only — no innerHTML */
function appendAlert(level, text) {
  const feed = document.getElementById('alert-feed');
  if (!feed) return;

  const now = new Date();
  const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':') + ' UTC';

  const entry = document.createElement('div');
  entry.className = `alert-entry alert-entry--${level}`;
  entry.setAttribute('role', 'listitem');

  const timeSpan = document.createElement('span');
  timeSpan.className = 'alert-entry__time';
  timeSpan.textContent = timeStr;   // Security: textContent

  const textSpan = document.createElement('span');
  textSpan.className = 'alert-entry__text';
  textSpan.textContent = text;      // Security: textContent

  entry.appendChild(timeSpan);
  entry.appendChild(textSpan);
  feed.insertBefore(entry, feed.firstChild);
}

function updateAlertCount() {
  const el = document.getElementById('stat-alerts');
  if (el) el.textContent = String(state.alertIndex);
}

/* =====================================================
   VIEW 1 → BEGIN SIMULATION
   ===================================================== */

function handleBeginSimulation() {
  // Security: validate team name before use
  const rawInput = document.getElementById('team-name-input');
  const errorEl  = document.getElementById('team-name-error');
  const trimmed  = normalizeTeamName(rawInput ? rawInput.value : '');

  // Clear previous error
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
  if (rawInput) rawInput.classList.remove('form-input--error');

  if (trimmed.length > 0 && !isValidTeamName(trimmed)) {
    // Security: render error via textContent, never innerHTML
    if (errorEl) {
      errorEl.textContent = 'Team name may only contain letters, numbers, spaces, hyphens, and apostrophes.';
      errorEl.hidden = false;
    }
    if (rawInput) {
      rawInput.classList.add('form-input--error');
      rawInput.focus();
      rawInput.setAttribute('aria-invalid', 'true');
    }
    return; // Do not proceed
  }

  // Security: store validated, trimmed value only
  state.teamName = trimmed;
  if (rawInput) rawInput.setAttribute('aria-invalid', 'false');

  // Update header status
  setHeaderStatus('INCIDENT ACTIVE', true);

  // Record join time in timeline
  const now = new Date();
  const joinTimeEl = document.getElementById('timeline-join-time');
  if (joinTimeEl) {
    joinTimeEl.textContent =
      [now.getHours(), now.getMinutes()].map(n => String(n).padStart(2, '0')).join(':') + ' UTC';
  }

  // Navigate to dashboard
  showView('view-dashboard');

  // Start timer and alert feed
  startTimer();
  startAlertFeed();

  // Update decision counter
  updateDecisionCounter();
  updateScoreDisplays();
}

/* =====================================================
   VIEW 2 → DECISION ROOM
   ===================================================== */

function handleGoToDecisions() {
  state.currentDecision = 0;
  renderDecision(state.currentDecision);
  showView('view-decision');
}

/* =====================================================
   VIEW 3: DECISION ROOM LOGIC
   ===================================================== */

function renderDecision(index) {
  const decision = DECISIONS[index];
  if (!decision) return;

  // Progress indicator
  const progressLabel = document.getElementById('decision-progress-label');
  if (progressLabel) progressLabel.textContent = `Decision ${index + 1} of ${DECISIONS.length}`;
  const progressFill = document.getElementById('decision-progress-fill');
  const progressBar  = document.getElementById('decision-progress-bar');
  const pct = Math.round((index / DECISIONS.length) * 100);
  if (progressFill) progressFill.style.width = pct + '%';
  if (progressBar)  progressBar.setAttribute('aria-valuenow', String(pct));

  // Tag and number — textContent only
  const tagEl = document.getElementById('decision-tag');
  if (tagEl) tagEl.textContent = decision.tag.toUpperCase();
  const numEl = document.getElementById('decision-number');
  if (numEl) numEl.textContent = String(decision.id).padStart(2, '0');
  numEl && numEl.setAttribute('aria-label', `Decision ${decision.id}`);

  // Question — textContent only
  const questionEl = document.getElementById('decision-question');
  if (questionEl) questionEl.textContent = decision.question;

  // Options — build DOM nodes, text via textContent only
  const optionsContainer = document.getElementById('decision-options');
  if (optionsContainer) {
    // Clear previous options safely
    while (optionsContainer.firstChild) {
      optionsContainer.removeChild(optionsContainer.firstChild);
    }

    decision.options.forEach((option, optIdx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'decision-option';
      wrapper.id = `option-wrapper-${index}-${optIdx}`;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `decision-${index}`;
      radio.id = `option-${index}-${optIdx}`;
      radio.value = String(optIdx);
      radio.className = 'decision-option__input';
      radio.setAttribute('aria-describedby', `decision-question`);

      const label = document.createElement('label');
      label.htmlFor = radio.id;
      label.className = 'decision-option__label';

      const indicator = document.createElement('span');
      indicator.className = 'decision-option__indicator';
      indicator.setAttribute('aria-hidden', 'true');

      const checkMark = document.createElement('span');
      checkMark.className = 'decision-option__check';
      indicator.appendChild(checkMark);

      const textNode = document.createTextNode(option.text);  // Security: textContent

      label.appendChild(indicator);
      label.appendChild(textNode);
      wrapper.appendChild(radio);
      wrapper.appendChild(label);
      optionsContainer.appendChild(wrapper);

      // Security: addEventListener, not inline handlers
      radio.addEventListener('change', () => handleOptionSelected(index, optIdx));
    });
  }

  // Hide feedback and next button
  const feedbackEl = document.getElementById('decision-feedback');
  if (feedbackEl) feedbackEl.hidden = true;
  const nextBtn = document.getElementById('btn-next-decision');
  if (nextBtn) nextBtn.hidden = true;

  updateScoreDisplays();
}

/**
 * Called when user selects a decision option.
 * Locks in the selection, shows feedback, updates scores.
 */
function handleOptionSelected(decisionIndex, optionIndex) {
  const decision = DECISIONS[decisionIndex];
  const chosen   = decision.options[optionIndex];

  // Lock all radio inputs for this decision
  const allRadios = document.querySelectorAll(`input[name="decision-${decisionIndex}"]`);
  allRadios.forEach(r => {
    r.disabled = true;
  });

  // Apply visual states to option wrappers
  decision.options.forEach((opt, i) => {
    const wrapper = document.getElementById(`option-wrapper-${decisionIndex}-${i}`);
    if (!wrapper) return;
    const check = wrapper.querySelector('.decision-option__check');

    if (i === optionIndex) {
      // Selected option
      if (opt.quality === 'best') {
        wrapper.classList.add('decision-option--correct');
        if (check) check.textContent = '✓';
      } else {
        wrapper.classList.add('decision-option--selected-wrong');
        if (check) check.textContent = '✗';
      }
    } else if (opt.quality === 'best') {
      // Show which was best
      wrapper.classList.add('decision-option--correct');
      if (check) check.textContent = '✓';
    } else {
      wrapper.classList.add('decision-option--incorrect');
    }
  });

  // Apply score changes
  applyScoreDelta(chosen.scores);
  updateScoreDisplays();

  // Record decision
  state.decisionsData.push({
    decisionIndex,
    optionIndex,
    quality: chosen.quality,
    questionText: decision.question,
    optionText: chosen.text,
  });

  // Update decision counter
  updateDecisionCounter();

  // Show feedback panel
  showDecisionFeedback(chosen, decision.options[optionIndex].quality);

  // Show the Next / Finish button
  const nextBtn  = document.getElementById('btn-next-decision');
  const nextLabel = document.getElementById('btn-next-label');
  if (nextBtn) {
    nextBtn.hidden = false;
    const isLast = (decisionIndex === DECISIONS.length - 1);
    if (nextLabel) nextLabel.textContent = isLast ? 'View After-Action Report' : 'Next Decision';
    nextBtn.setAttribute('aria-label', isLast ? 'View the After-Action Report' : 'Continue to next decision');
  }
}

/** Render feedback panel — all text via textContent */
function showDecisionFeedback(chosenOption, quality) {
  const feedbackEl    = document.getElementById('decision-feedback');
  const headerEl      = document.getElementById('decision-feedback-header');
  const textEl        = document.getElementById('decision-feedback-text');
  const impactEl      = document.getElementById('decision-feedback-impact');
  const lessonEl      = document.getElementById('decision-feedback-lesson');

  if (!feedbackEl) return;

  // Determine header style
  let headerClass, headerText;
  switch (quality) {
    case 'best':
      headerClass = 'decision-feedback__header--positive';
      headerText  = '✓ Effective Decision — Well done';
      break;
    case 'okay':
      headerClass = 'decision-feedback__header--neutral';
      headerText  = '⚠ Partial Action — Could be improved';
      break;
    default:
      headerClass = 'decision-feedback__header--negative';
      headerText  = '✗ Ineffective Decision — Review the lesson below';
  }

  if (headerEl) {
    headerEl.className = `decision-feedback__header ${headerClass}`;
    headerEl.textContent = headerText;    // Security: textContent
  }

  if (textEl) textEl.textContent = chosenOption.feedback;  // Security: textContent

  // Score impact display
  if (impactEl) {
    while (impactEl.firstChild) impactEl.removeChild(impactEl.firstChild);

    const { scores } = chosenOption;
    const dims = [
      { key: 'security',         label: 'Security' },
      { key: 'businessContinuity', label: 'Business Continuity' },
      { key: 'publicTrust',      label: 'Public Trust' },
    ];

    dims.forEach(dim => {
      const val  = scores[dim.key] || 0;
      if (val === 0) return;
      const span = document.createElement('span');
      span.className = `impact-item impact-item--${val > 0 ? 'positive' : 'negative'}`;
      span.textContent = `${dim.label}: ${val > 0 ? '+' : ''}${val}`;  // Security: textContent
      impactEl.appendChild(span);
    });
  }

  // Key lesson
  if (lessonEl) {
    // Build label + text via DOM, no innerHTML
    while (lessonEl.firstChild) lessonEl.removeChild(lessonEl.firstChild);
    const strongEl = document.createElement('strong');
    strongEl.textContent = 'Key lesson: ';
    const lessonText = document.createTextNode(DECISIONS[state.currentDecision].options.find(
      o => o.quality === 'best'
    )?.lesson || '');
    lessonEl.appendChild(strongEl);
    lessonEl.appendChild(lessonText);
  }

  feedbackEl.hidden = false;
}

/** Next decision button handler */
function handleNextDecision() {
  const isLast = (state.currentDecision === DECISIONS.length - 1);

  if (isLast) {
    stopTimer();
    stopAlertFeed();
    generateReport();
    showView('view-report');
    setHeaderStatus('AFTER-ACTION REPORT', false);
  } else {
    state.currentDecision++;
    renderDecision(state.currentDecision);
    // Scroll decision card into view
    const card = document.getElementById('decision-card');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateDecisionCounter() {
  const el = document.getElementById('stat-decisions');
  if (el) el.textContent = `${state.decisionsData.length} / ${DECISIONS.length}`;
}

/* =====================================================
   VIEW 4: AFTER-ACTION REPORT GENERATION
   All rendered via textContent / DOM manipulation
   ===================================================== */

function generateReport() {
  const total = getTotalScore();
  const { security, businessContinuity, publicTrust } = state.scores;

  // Rating
  const rating = getRating(total);

  // Rating banner
  const banner = document.getElementById('report-rating-banner');
  if (banner) {
    banner.className = `rating-banner rating-banner--${rating.cssClass}`;
  }
  const ratingTitle = document.getElementById('report-rating-title');
  if (ratingTitle) ratingTitle.textContent = rating.title;   // Security: textContent
  const totalScoreEl = document.getElementById('report-total-score');
  if (totalScoreEl) totalScoreEl.textContent = `Total Score: ${total} / 100`;

  // Team name (if provided) — Security: textContent only
  const teamNameEl = document.getElementById('report-team-name');
  if (teamNameEl) {
    if (state.teamName) {
      teamNameEl.textContent = `Team: ${state.teamName}`;  // Security: textContent
      teamNameEl.hidden = false;
    } else {
      teamNameEl.hidden = true;
    }
  }

  // Score breakdown
  setScoreEl('report-score-sec', String(security));
  setScoreEl('report-score-bc', String(businessContinuity));
  setScoreEl('report-score-trust', String(publicTrust));
  setMeter('report-fill-sec',   '', security);
  setMeter('report-fill-bc',    '', businessContinuity);
  setMeter('report-fill-trust', '', publicTrust);

  // Decision review cards
  const decisionsContainer = document.getElementById('report-decisions');
  if (decisionsContainer) {
    while (decisionsContainer.firstChild) decisionsContainer.removeChild(decisionsContainer.firstChild);

    state.decisionsData.forEach(recorded => {
      const decision = DECISIONS[recorded.decisionIndex];
      const card = document.createElement('article');
      const cssClass = recorded.quality === 'best' ? 'positive'
                     : recorded.quality === 'okay' ? 'neutral'
                     : 'negative';
      card.className = `report-decision-card report-decision-card--${cssClass}`;

      const header = document.createElement('div');
      header.className = 'report-decision-card__header';

      const numEl = document.createElement('span');
      numEl.className = 'report-decision-card__num';
      numEl.textContent = `Decision ${recorded.decisionIndex + 1}`;  // Security: textContent

      const outcomeEl = document.createElement('span');
      outcomeEl.className = 'report-decision-card__outcome';
      const outcomeText = recorded.quality === 'best' ? 'OPTIMAL'
                        : recorded.quality === 'okay' ? 'SUBOPTIMAL'
                        : 'INEFFECTIVE';
      outcomeEl.textContent = outcomeText;  // Security: textContent

      header.appendChild(numEl);
      header.appendChild(outcomeEl);

      const body = document.createElement('div');
      body.className = 'report-decision-card__body';

      const qEl = document.createElement('p');
      qEl.className = 'report-decision-card__q';
      qEl.textContent = decision.question;  // Security: textContent

      const aEl = document.createElement('p');
      aEl.className = 'report-decision-card__a';
      aEl.textContent = `Your response: ${recorded.optionText}`;  // Security: textContent

      body.appendChild(qEl);
      body.appendChild(aEl);
      card.appendChild(header);
      card.appendChild(body);
      decisionsContainer.appendChild(card);
    });
  }

  // Positive actions and improvements
  buildOutcomeList('report-positives', 'report-improvements');

  // Security lessons — rendered via textContent
  const lessonsList = document.getElementById('report-lessons');
  if (lessonsList) {
    while (lessonsList.firstChild) lessonsList.removeChild(lessonsList.firstChild);
    SECURITY_LESSONS.forEach(lesson => {
      const li = document.createElement('li');
      li.textContent = lesson;  // Security: textContent
      lessonsList.appendChild(li);
    });
  }
}

function getRating(score) {
  if (score >= 85) return { title: 'Incident Commander',              cssClass: 'commander'  };
  if (score >= 70) return { title: 'Strong Responder',                cssClass: 'strong'     };
  if (score >= 50) return { title: 'Developing Analyst',              cssClass: 'developing' };
  return              { title: 'Response Plan Requires Improvement', cssClass: 'needs-work' };
}

function buildOutcomeList(positivesId, improvementsId) {
  const positivesList    = document.getElementById(positivesId);
  const improvementsList = document.getElementById(improvementsId);

  const positives    = [];
  const improvements = [];

  state.decisionsData.forEach(recorded => {
    const decision = DECISIONS[recorded.decisionIndex];
    const option   = decision.options[recorded.optionIndex];
    if (recorded.quality === 'best') {
      positives.push(`Decision ${recorded.decisionIndex + 1}: ${option.text}`);
    } else {
      improvements.push(
        `Decision ${recorded.decisionIndex + 1}: Selected "${option.text}" — ` +
        `optimal was "${decision.options.find(o => o.quality === 'best').text}"`
      );
    }
  });

  // Fallbacks
  if (positives.length === 0) positives.push('No optimal decisions recorded in this run. Review each decision against industry best practices and attempt again.');
  if (improvements.length === 0) improvements.push('Excellent — all decisions were optimal. No areas for improvement identified.');

  // Render lists — Security: textContent
  if (positivesList) {
    while (positivesList.firstChild) positivesList.removeChild(positivesList.firstChild);
    positives.forEach(text => {
      const li = document.createElement('li');
      li.className = 'report-list__item';
      li.textContent = text;  // Security: textContent
      positivesList.appendChild(li);
    });
  }

  if (improvementsList) {
    while (improvementsList.firstChild) improvementsList.removeChild(improvementsList.firstChild);
    improvements.forEach(text => {
      const li = document.createElement('li');
      li.className = 'report-list__item';
      li.textContent = text;  // Security: textContent
      improvementsList.appendChild(li);
    });
  }
}

/* =====================================================
   RESTART
   Clears all simulation state and returns to briefing.
   ===================================================== */

function restartSimulation() {
  // Clear all timers and intervals
  stopTimer();
  stopAlertFeed();

  // Security: reset all state to initial values
  state.teamName       = '';
  state.scores         = { ...INITIAL_SCORES };
  state.currentDecision = 0;
  state.decisionsData  = [];
  state.alertIndex     = 0;
  state.elapsedSeconds = 0;
  state.simulationStarted = false;

  // Reset form input
  const input = document.getElementById('team-name-input');
  if (input) {
    input.value = '';
    input.classList.remove('form-input--error');
    input.setAttribute('aria-invalid', 'false');
  }
  const errorEl = document.getElementById('team-name-error');
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  // Reset score displays
  updateScoreDisplays();

  // Reset timer display
  const timerEl = document.getElementById('timer-display');
  if (timerEl) timerEl.textContent = '00:00:00';

  // Clear alert feed
  const feed = document.getElementById('alert-feed');
  if (feed) while (feed.firstChild) feed.removeChild(feed.firstChild);

  // Reset alert count
  const alertStat = document.getElementById('stat-alerts');
  if (alertStat) alertStat.textContent = '0';

  // Reset decisions counter
  const decStat = document.getElementById('stat-decisions');
  if (decStat) decStat.textContent = '0 / 4';

  // Reset timeline join time
  const joinTime = document.getElementById('timeline-join-time');
  if (joinTime) joinTime.textContent = '—';

  // Reset header status
  setHeaderStatus('STANDBY', false);

  // Navigate to briefing
  showView('view-briefing');
}

/* =====================================================
   HEADER STATUS HELPER
   ===================================================== */

function setHeaderStatus(text, isActive) {
  const dot    = document.querySelector('.status-dot');
  const status = document.getElementById('header-status');
  if (dot) {
    dot.classList.toggle('status-dot--active', isActive);
  }
  if (status) {
    status.textContent = text;  // Security: textContent
    status.classList.toggle('status-text--active', isActive);
  }
}

/* =====================================================
   KEYBOARD NAVIGATION HELPERS
   ===================================================== */

/** Allow Enter/Space to activate button-like elements */
function handleKeyActivate(e, callback) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    callback();
  }
}

/* =====================================================
   INITIALISATION
   All event listeners registered with addEventListener.
   No inline event handlers (onclick, onchange etc.)
   ===================================================== */

function initApp() {
  // View 1: Begin button
  const btnBegin = document.getElementById('btn-begin');
  if (btnBegin) {
    btnBegin.addEventListener('click', handleBeginSimulation);
  }

  // View 1: Allow Enter in team name field to submit
  const teamNameInput = document.getElementById('team-name-input');
  if (teamNameInput) {
    teamNameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleBeginSimulation();
      }
    });
    // Validate on blur for immediate feedback
    teamNameInput.addEventListener('blur', () => {
      const val     = normalizeTeamName(teamNameInput.value);
      const errorEl = document.getElementById('team-name-error');
      if (val && !isValidTeamName(val)) {
        if (errorEl) {
          errorEl.textContent = 'Team name may only contain letters, numbers, spaces, hyphens, and apostrophes.';
          errorEl.hidden = false;
        }
        teamNameInput.classList.add('form-input--error');
        teamNameInput.setAttribute('aria-invalid', 'true');
      } else {
        if (errorEl) {
          errorEl.hidden = true;
          errorEl.textContent = '';
        }
        teamNameInput.classList.remove('form-input--error');
        teamNameInput.setAttribute('aria-invalid', 'false');
      }
    });
  }

  // View 2: Enter decision room
  const btnToDecisions = document.getElementById('btn-to-decisions');
  if (btnToDecisions) {
    btnToDecisions.addEventListener('click', handleGoToDecisions);
  }

  // View 3: Next decision / finish
  const btnNext = document.getElementById('btn-next-decision');
  if (btnNext) {
    btnNext.addEventListener('click', handleNextDecision);
  }

  // View 4: Restart
  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) {
    btnRestart.addEventListener('click', restartSimulation);
  }

  // Initialise score displays
  updateScoreDisplays();
}

// Security: module entry point — runs after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
