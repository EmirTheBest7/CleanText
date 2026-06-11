// popup.js — Main extension controller
// Wires UI, runs humanization/detection, manages state & history.
'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────

const HISTORY_KEY = 'ah_history';
const THEME_KEY   = 'ah_theme';
const MAX_HISTORY = 5;

const EXAMPLE_TEXT = `In today's rapidly evolving digital landscape, it is important to note that artificial intelligence has fundamentally transformed the way individuals interact with technology. Furthermore, it is crucial to understand that these advancements have not only revolutionized various industries but have also introduced new challenges that must be addressed. Moreover, the integration of AI systems into everyday life has raised significant ethical concerns that require careful consideration. It is essential to facilitate open dialogue about these issues in order to ensure that technological progress aligns with societal values. In conclusion, as we navigate this complex terrain, it is imperative that stakeholders leverage collaborative approaches to foster innovation while simultaneously mitigating potential risks.`;

// ── DOM Refs ──────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const ui = {
  app:           $('app'),
  themeBtn:      $('themeBtn'),

  // Tabs
  tabs:          document.querySelectorAll('.tab'),
  panels:        { process: $('panel-process'), compare: $('panel-compare'), history: $('panel-history') },

  // Input
  inputText:     $('inputText'),
  inputCounter:  $('inputCounter'),
  exampleBtn:    $('exampleBtn'),
  clearBtn:      $('clearBtn'),

  // Actions
  detectBtn:     $('detectBtn'),
  humanizeBtn:   $('humanizeBtn'),

  // Progress
  progressStrip: $('progressStrip'),
  progressFill:  $('progressFill'),

  // Detection result
  detectResult:  $('detectResult'),
  gaugeArc:      $('gaugeArc'),
  gaugePct:      $('gaugePct'),
  gaugeVerdict:  $('gaugeVerdict'),
  fvPerplexity:  $('fvPerplexity'),  fbPerplexity:  $('fbPerplexity'),
  fvBurstiness:  $('fvBurstiness'),  fbBurstiness:  $('fbBurstiness'),
  fvPattern:     $('fvPattern'),     fbPattern:     $('fbPattern'),
  fvCoherence:   $('fvCoherence'),   fbCoherence:   $('fbCoherence'),

  // Output
  outputGroup:   $('outputGroup'),
  outputText:    $('outputText'),
  outputCounter: $('outputCounter'),
  copyBtn:       $('copyBtn'),
  exportBtn:     $('exportBtn'),

  // Compare
  compareEmpty:  $('compareEmpty'),
  compareCols:   $('compareCols'),
  compareOriginal:   $('compareOriginal'),
  compareHumanized:  $('compareHumanized'),

  // History
  historyEmpty:      $('historyEmpty'),
  historyList:       $('historyList'),
  clearHistoryBtn:   $('clearHistoryBtn'),

  // Toast
  toast:         $('toast'),
};

// ── App State ─────────────────────────────────────────────────────────────────

let state = {
  theme:           'dark',
  lastOriginal:    '',
  lastHumanized:   '',
  lastScore:       null,
  history:         [],
  processing:      false,
};

// ── Theme ─────────────────────────────────────────────────────────────────────

function setTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  chrome.storage.local.set({ [THEME_KEY]: theme });
}

ui.themeBtn.addEventListener('click', () => {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
});

// ── Tabs ──────────────────────────────────────────────────────────────────────

ui.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    ui.tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    Object.values(ui.panels).forEach(p => p.hidden = true);

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    const panelKey = tab.dataset.tab;
    if (panelKey === 'history') renderHistory();
    if (panelKey === 'compare') renderCompare();

    const panel = ui.panels[panelKey];
    if (panel) panel.hidden = false;
  });
});

// ── Input counter ─────────────────────────────────────────────────────────────

function updateInputCounter() {
  const text = ui.inputText.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  ui.inputCounter.textContent = `${words}w · ${text.length}c`;
}

ui.inputText.addEventListener('input', updateInputCounter);

// ── Example & Clear ───────────────────────────────────────────────────────────

ui.exampleBtn.addEventListener('click', () => {
  ui.inputText.value = EXAMPLE_TEXT;
  updateInputCounter();
  ui.inputText.focus();
});

ui.clearBtn.addEventListener('click', () => {
  ui.inputText.value = '';
  ui.detectResult.hidden = true;
  ui.outputGroup.hidden = true;
  updateInputCounter();
  ui.inputText.focus();
});

// ── Keyboard shortcuts ────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runHumanize();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault();
    runDetect();
  }
});

// ── Progress strip ────────────────────────────────────────────────────────────

let progressTimer = null;

function startProgress(label) {
  ui.progressStrip.hidden = false;
  ui.progressFill.style.width = '0%';
  // Fake progress to ~85%, then hold
  let pct = 0;
  progressTimer = setInterval(() => {
    pct += (85 - pct) * 0.12;
    ui.progressFill.style.width = pct + '%';
  }, 80);
}

function finishProgress() {
  clearInterval(progressTimer);
  ui.progressFill.style.width = '100%';
  setTimeout(() => {
    ui.progressStrip.hidden = true;
    ui.progressFill.style.width = '0%';
  }, 400);
}

// ── Button loading state ──────────────────────────────────────────────────────

function setButtonLoading(btn, loading) {
  const label   = btn.querySelector('.btn-label');
  const spinner = btn.querySelector('.btn-spinner');
  if (loading) {
    btn.disabled = true;
    label.style.opacity = '0.4';
    spinner.hidden = false;
  } else {
    btn.disabled = false;
    label.style.opacity = '';
    spinner.hidden = true;
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer = null;

function showToast(msg) {
  clearTimeout(toastTimer);
  ui.toast.textContent = msg;
  ui.toast.classList.add('show');
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2200);
}

// ── Arc Gauge Rendering ───────────────────────────────────────────────────────
// The arc path goes from M 20 85 to 140 85 spanning 188.5px (circumference of
// a 60-radius semicircle). stroke-dashoffset from 188.5 (empty) → 0 (full).

function renderGauge(score) {
  const total = 188.5;
  const offset = total - (score / 100) * total;
  ui.gaugeArc.style.strokeDashoffset = offset;
  ui.gaugePct.textContent = Math.round(score) + '%';

  // Color the arc
  let color, verdictText, verdictClass;
  if (score >= 70) {
    color = '#f85149';
    verdictText = 'Likely AI-generated';
    verdictClass = 'verdict-ai';
  } else if (score >= 40) {
    color = '#d29922';
    verdictText = 'Mixed signals';
    verdictClass = 'verdict-mixed';
  } else {
    color = '#3fb950';
    verdictText = 'Likely human-written';
    verdictClass = 'verdict-human';
  }

  // Inject gradient into SVG if not present, else just update arc color
  const svgEl = ui.gaugeArc.closest('svg');
  if (!svgEl.querySelector('#gaugeGrad')) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `<linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="${color}cc"/>
    </linearGradient>`;
    svgEl.insertBefore(defs, svgEl.firstChild);
  } else {
    const stops = svgEl.querySelectorAll('#gaugeGrad stop');
    stops[0].setAttribute('stop-color', color);
    stops[1].setAttribute('stop-color', color + 'cc');
  }

  ui.gaugeVerdict.textContent = verdictText;
  ui.gaugeVerdict.className = `gauge-verdict ${verdictClass}`;
}

// ── Factor bar rendering ──────────────────────────────────────────────────────

function renderFactor(barEl, valEl, score) {
  barEl.style.width = Math.round(score * 100) + '%';
  valEl.textContent = Math.round(score * 100) + '%';

  // Color the bar by intensity
  if (score > 0.65) {
    barEl.style.background = '#f85149';
  } else if (score > 0.4) {
    barEl.style.background = '#d29922';
  } else {
    barEl.style.background = 'linear-gradient(135deg, #8B5CF6, #06B6D4)';
  }
}

// ── AI Detection Engine ───────────────────────────────────────────────────────

function runDetect() {
  const text = ui.inputText.value.trim();
  if (!text) { showToast('Paste some text first.'); return; }
  if (text.split(/\s+/).length < 20) { showToast('Need at least 20 words for analysis.'); return; }

  setButtonLoading(ui.detectBtn, true);
  startProgress();

  // Async to keep UI responsive
  setTimeout(() => {
    const result = detectAI(text);
    finishProgress();
    setButtonLoading(ui.detectBtn, false);

    renderGauge(result.score);
    renderFactor(ui.fbPerplexity, ui.fvPerplexity, result.perplexity);
    renderFactor(ui.fbBurstiness, ui.fvBurstiness, result.burstiness);
    renderFactor(ui.fbPattern, ui.fvPattern, result.pattern);
    renderFactor(ui.fbCoherence, ui.fvCoherence, result.coherence);

    ui.detectResult.hidden = false;
    state.lastScore = result.score;
  }, 300);
}

function detectAI(text) {
  const { calculatePerplexity, calculateBurstiness, calculateCoherenceMarkers,
          calculateSentenceStartVariety, detectAIPatterns, clamp } = window.NLP;

  const perplexity  = calculatePerplexity(text);
  const burstiness  = calculateBurstiness(text);
  const coherence   = calculateCoherenceMarkers(text);
  const pattern     = detectAIPatterns(text);
  const startVar    = calculateSentenceStartVariety(text);

  // Weighted composite score (tuned to give 70-95% for obvious AI, 5-30% for human)
  const raw = (
    perplexity  * 0.20 +
    burstiness  * 0.20 +
    coherence   * 0.15 +
    pattern     * 0.30 +
    startVar    * 0.15
  );

  // Scale to realistic range: raw 0–1 → 0–100%
  // Apply a slight s-curve so mid-range isn't always 50%
  const curved = clamp(raw * 1.15 - 0.05, 0, 1);
  const score = Math.round(curved * 100);

  return { score, perplexity, burstiness, coherence, pattern, startVar };
}

ui.detectBtn.addEventListener('click', runDetect);

// ── Humanization Engine ───────────────────────────────────────────────────────

function runHumanize() {
  const text = ui.inputText.value.trim();
  if (!text) { showToast('Paste some text first.'); return; }
  if (text.split(/\s+/).length < 5) { showToast('Need at least 5 words to humanize.'); return; }

  setButtonLoading(ui.humanizeBtn, true);
  startProgress();

  // Use setTimeout to yield to render thread before heavy processing
  setTimeout(() => {
    const result = humanizeText(text);
    finishProgress();
    setButtonLoading(ui.humanizeBtn, false);

    // Show output
    ui.outputText.textContent = result;
    const words = result.trim().split(/\s+/).length;
    ui.outputCounter.textContent = `${words}w · ${result.length}c`;
    ui.outputGroup.hidden = false;

    // Store for compare
    state.lastOriginal  = text;
    state.lastHumanized = result;

    // Run silent detection for history score
    const detection = detectAI(text);
    state.lastScore = detection.score;

    // Scroll output into view
    ui.outputGroup.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Save to history
    saveHistory({ original: text, humanized: result, score: detection.score, date: new Date().toISOString() });

    showToast('Text humanized successfully');
  }, 50);
}

ui.humanizeBtn.addEventListener('click', runHumanize);

// ── Core Humanization Algorithm ───────────────────────────────────────────────

function humanizeText(text) {
  const { AI_PHRASES, SENTENCE_STARTERS, tokenizeSentences, randomPick, escapeRegex } = window.NLP;

  let result = text;

  // PASS 1: Replace AI phrase patterns (longer phrases first to avoid partial replacements)
  const sortedPhrases = Object.keys(AI_PHRASES).sort((a, b) => b.length - a.length);
  for (const phrase of sortedPhrases) {
    const replacements = AI_PHRASES[phrase];
    const regex = new RegExp(escapeRegex(phrase), 'gi');
    result = result.replace(regex, (match) => {
      const replacement = randomPick(replacements);
      // Preserve original capitalization of first letter
      if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    });
  }

  // PASS 2: Fix sentence starters (vary repetitive openers)
  const sentences = tokenizeSentences(result);
  const starters  = Object.keys(SENTENCE_STARTERS);

  const processed = sentences.map((sentence, i) => {
    // Don't mess with every sentence — only when we see the same starter used consecutively
    if (i === 0) return sentence;

    for (const starter of starters) {
      if (sentence.startsWith(starter)) {
        // Only replace if the previous sentence started with the same word
        const prevFirstWord = sentences[i - 1].split(' ')[0].toLowerCase();
        const thisFirstWord = sentence.split(' ')[0].toLowerCase();
        if (prevFirstWord === thisFirstWord || Math.random() < 0.35) {
          const alternatives = SENTENCE_STARTERS[starter];
          return randomPick(alternatives) + sentence.slice(starter.length);
        }
      }
    }
    return sentence;
  });

  result = processed.join(' ');

  // PASS 3: Inject contractions where AI writes formal long-forms
  const contractions = [
    [/\bdo not\b/g,    "don't"],
    [/\bdoes not\b/g,  "doesn't"],
    [/\bdid not\b/g,   "didn't"],
    [/\bcannot\b/g,    "can't"],
    [/\bwill not\b/g,  "won't"],
    [/\bwould not\b/g, "wouldn't"],
    [/\bcould not\b/g, "couldn't"],
    [/\bshould not\b/g,"shouldn't"],
    [/\bis not\b/g,    "isn't"],
    [/\bare not\b/g,   "aren't"],
    [/\bwas not\b/g,   "wasn't"],
    [/\bwere not\b/g,  "weren't"],
    [/\bI am\b/g,      "I'm"],
    [/\bI have\b/g,    "I've"],
    [/\bI will\b/g,    "I'll"],
    [/\bthey are\b/g,  "they're"],
    [/\bwe are\b/g,    "we're"],
    [/\byou are\b/g,   "you're"],
    [/\bhe is\b/g,     "he's"],
    [/\bshe is\b/g,    "she's"],
    [/\bit is\b/g,     "it's"],
    [/\bthat is\b/g,   "that's"],
    [/\bwhat is\b/g,   "what's"],
    [/\bthere is\b/g,  "there's"],
    [/\bthere are\b/g, "there are"], // don't contract this one
    [/\blet us\b/g,    "let's"],
  ];

  // Apply contractions probabilistically — not every instance (humans are inconsistent)
  for (const [pattern, replacement] of contractions) {
    result = result.replace(pattern, (match) => {
      return Math.random() < 0.72 ? replacement : match;
    });
  }

  // PASS 4: Break up very long compound sentences (>45 words) at natural conjunctions
  const finalSentences = tokenizeSentences(result);
  const restructured = finalSentences.map(sentence => {
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount <= 40) return sentence;

    // Try to split at ", and ", ", but ", "; " etc.
    const splitPatterns = [
      { re: /, and /g, rep: '. ' },
      { re: /, but /g, rep: '. But ' },
      { re: /; /g,     rep: '. ' },
      { re: /, which /g, rep: '. This ' },
      { re: /, as well as /g, rep: '. Also, ' },
    ];

    let modified = sentence;
    for (const { re, rep } of splitPatterns) {
      if (modified.split(/\s+/).length <= 32) break;
      modified = modified.replace(re, (match, offset) => {
        // Only break if we're past the midpoint
        if (offset > modified.length * 0.45) return rep;
        return match;
      });
    }
    return modified;
  });

  result = restructured.join(' ');

  // PASS 5: Occasionally add a very mild filler/transition for naturalness
  // (inserted at paragraph breaks — simulates human "stream of thought")
  const humanFillers = [
    'Honestly, ', 'To be fair, ', 'Look, ', 'Think about it — ',
    'Heres the thing: ', 'Worth keeping in mind: ',
  ];

  // Only add to texts long enough to warrant it
  if (result.split(/\s+/).length > 80) {
    const paragraphs = result.split(/\n\n+/);
    if (paragraphs.length > 1) {
      const midIdx = Math.floor(paragraphs.length / 2);
      paragraphs[midIdx] = randomPick(humanFillers) + paragraphs[midIdx].charAt(0).toLowerCase() + paragraphs[midIdx].slice(1);
      result = paragraphs.join('\n\n');
    }
  }

  // PASS 6: Clean up — fix double spaces, fix capitalization after period+space
  result = result
    .replace(/  +/g, ' ')
    .replace(/\. ([a-z])/g, (_, c) => '. ' + c.toUpperCase())
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();

  return result;
}

// ── Copy & Export ─────────────────────────────────────────────────────────────

ui.copyBtn.addEventListener('click', async () => {
  const text = ui.outputText.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('Copied');
  }
});

ui.exportBtn.addEventListener('click', () => {
  const text = ui.outputText.textContent;
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `humanized-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('File exported');
});

// ── Compare View ──────────────────────────────────────────────────────────────

function renderCompare() {
  if (!state.lastOriginal || !state.lastHumanized) {
    ui.compareEmpty.hidden = false;
    ui.compareCols.hidden  = true;
    return;
  }
  ui.compareEmpty.hidden = true;
  ui.compareCols.hidden  = false;
  ui.compareOriginal.textContent  = state.lastOriginal;
  ui.compareHumanized.textContent = state.lastHumanized;
}

// ── History ───────────────────────────────────────────────────────────────────

function saveHistory(entry) {
  state.history.unshift(entry);
  if (state.history.length > MAX_HISTORY) state.history = state.history.slice(0, MAX_HISTORY);
  chrome.storage.local.set({ [HISTORY_KEY]: state.history });
}

function renderHistory() {
  const list = ui.historyList;
  list.innerHTML = '';

  if (!state.history.length) {
    ui.historyEmpty.hidden = false;
    list.hidden = true;
    return;
  }

  ui.historyEmpty.hidden = true;
  list.hidden = false;

  state.history.forEach((entry, i) => {
    const score = entry.score || 0;
    const scoreClass = score >= 70 ? 'score-high' : score >= 40 ? 'score-mid' : 'score-low';
    const date = new Date(entry.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const preview = entry.original.slice(0, 90).replace(/\n/g, ' ') + (entry.original.length > 90 ? '…' : '');

    const item = document.createElement('div');
    item.className = 'history-item';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.innerHTML = `
      <div class="history-item-meta">
        <span class="history-date">${date}</span>
        <span class="history-score ${scoreClass}">${Math.round(score)}% AI</span>
      </div>
      <div class="history-preview">${escapeHTML(preview)}</div>
    `;

    item.addEventListener('click', () => {
      ui.inputText.value = entry.original;
      updateInputCounter();
      // Switch to process tab
      document.querySelector('.tab[data-tab="process"]').click();
      showToast('Loaded from history');
    });

    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') item.click();
    });

    list.appendChild(item);
  });
}

ui.clearHistoryBtn.addEventListener('click', () => {
  state.history = [];
  chrome.storage.local.set({ [HISTORY_KEY]: [] });
  renderHistory();
  showToast('History cleared');
});

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Pending text from context menu ───────────────────────────────────────────

function checkPendingText() {
  chrome.storage.local.get('pendingText', ({ pendingText }) => {
    if (pendingText) {
      ui.inputText.value = pendingText;
      updateInputCounter();
      chrome.storage.local.remove('pendingText');
    }
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  // Load theme
  chrome.storage.local.get([THEME_KEY, HISTORY_KEY], (data) => {
    if (data[THEME_KEY]) setTheme(data[THEME_KEY]);
    if (data[HISTORY_KEY]) state.history = data[HISTORY_KEY];
  });

  checkPendingText();
  updateInputCounter();
}

boot();
