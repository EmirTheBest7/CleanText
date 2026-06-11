// utils.js — NLP helpers, replacement maps, statistical utilities
'use strict';

// ── AI Phrase Replacements ────────────────────────────────────────────────────
// Maps common AI-generated phrases to more natural human alternatives.
// Each key maps to an array; a random entry is chosen during humanization.

const AI_PHRASES = {
  // Openers / transitions
  'it is important to note that': ['keep in mind that', 'worth noting:', 'one thing to remember —', 'just so you know,'],
  'it is worth noting that': ['worth mentioning,', 'something to keep in mind:', 'notably,'],
  'furthermore,': ['on top of that,', 'also,', 'and', 'plus,', 'what\'s more,'],
  'moreover,': ['beyond that,', 'on top of that,', 'also,', 'and another thing —'],
  'in addition,': ['also,', 'on top of that,', 'and', 'not to mention,'],
  'in addition to this,': ['beyond this,', 'on top of all that,', 'and there\'s also'],
  'in conclusion,': ['to wrap up,', 'all in all,', 'at the end of the day,', 'so,', 'bottom line:'],
  'to summarize,': ['in short,', 'basically,', 'to put it simply,', 'the short version:'],
  'in summary,': ['in short,', 'to boil it down,', 'the gist of it:'],
  'it is essential to': ['you really need to', 'it\'s critical to', 'you\'ve got to'],
  'it is crucial to': ['it\'s vital to', 'you need to', 'it really matters to'],
  'it is necessary to': ['you need to', 'it\'s important to', 'you have to'],
  'this is because': ['the reason is', 'that\'s because', 'it comes down to'],
  'due to the fact that': ['because', 'since', 'given that'],
  'in order to': ['to', 'so you can', 'if you want to'],
  'as a result,': ['so,', 'because of this,', 'that\'s why,', 'which means'],
  'as a result of': ['because of', 'thanks to', 'due to'],
  'therefore,': ['so,', 'which means,', 'that\'s why,'],
  'however,': ['but,', 'that said,', 'still,', 'though,'],
  'nevertheless,': ['still,', 'even so,', 'but,', 'that said,'],
  'nonetheless,': ['still,', 'even so,', 'but,'],
  'on the other hand,': ['then again,', 'but,', 'at the same time,', 'flip side:'],
  'it is clear that': ['clearly,', 'obviously,', 'it\'s plain that'],
  'it is evident that': ['clearly,', 'it\'s obvious that', 'you can see that'],
  'it is obvious that': ['clearly,', 'obviously,', 'it\'s easy to see that'],
  'it should be noted that': ['note that', 'keep in mind,', 'worth knowing:'],
  'one must consider': ['you should think about', 'it\'s worth considering', 'think about'],
  'one should': ['you should', 'it\'s a good idea to', 'try to'],
  'individuals': ['people', 'folks', 'users', 'everyone'],
  'utilize': ['use', 'make use of', 'put to work'],
  'leverage': ['use', 'take advantage of', 'tap into'],
  'facilitate': ['help', 'make easier', 'enable', 'support'],
  'demonstrate': ['show', 'prove', 'make clear'],
  'endeavor': ['try', 'aim', 'attempt', 'work'],
  'commence': ['start', 'begin', 'kick off'],
  'terminate': ['end', 'stop', 'finish', 'wrap up'],
  'subsequently': ['then', 'after that', 'next', 'later'],
  'previously': ['before', 'earlier', 'in the past'],
  'currently': ['right now', 'at the moment', 'these days', 'now'],
  'numerous': ['many', 'lots of', 'a bunch of', 'quite a few'],
  'significant': ['big', 'major', 'notable', 'real'],
  'approximately': ['about', 'around', 'roughly', 'give or take'],
  'provide': ['give', 'offer', 'deliver', 'supply'],
  'obtain': ['get', 'grab', 'pick up', 'acquire'],
  'require': ['need', 'call for', 'demand'],
  'consider': ['think about', 'look at', 'weigh'],
  'ensure': ['make sure', 'guarantee', 'see to it'],
  'achieve': ['reach', 'hit', 'accomplish', 'pull off'],
  'implement': ['put in place', 'roll out', 'set up', 'use'],
  'regarding': ['about', 'on', 'when it comes to'],
  'concerning': ['about', 'on', 'relating to'],
  'in terms of': ['when it comes to', 'as for', 'regarding'],
  'with respect to': ['about', 'as for', 'on the topic of'],
  'a wide range of': ['many different', 'all kinds of', 'a variety of'],
  'a variety of': ['different', 'various', 'many kinds of'],
  'in the context of': ['when it comes to', 'in', 'within'],
  'it\'s worth mentioning': ['by the way,', 'also worth noting —', 'just to mention,'],
  'it is imperative': ['it\'s critical', 'you must', 'it\'s absolutely necessary'],
  'undoubtedly': ['no doubt,', 'clearly,', 'for sure,', 'definitely'],
  'certainly': ['sure,', 'of course,', 'definitely,'],
  'absolutely': ['totally,', 'completely,', 'for sure,'],
};

// ── Sentence Starter Variety ──────────────────────────────────────────────────
// When a sentence starts with these AI-common openers, replace them.

const SENTENCE_STARTERS = {
  'The ': ['This ', 'That ', 'Each ', 'Every ', 'Here, the '],
  'This ': ['That ', 'Each '],
  'These ': ['Those '],
  'There are ': ['You\'ll find ', 'We have ', 'There\'s '],
  'There is ': ['There\'s ', 'You\'ve got ', 'We have '],
  'It is ': ['It\'s ', 'This is '],
  'It was ': ['It was ', 'Back then, ', 'At the time, '],
  'I am ': ['I\'m '],
  'You are ': ['You\'re '],
  'We are ': ['We\'re '],
  'They are ': ['They\'re '],
  'He is ': ['He\'s '],
  'She is ': ['She\'s '],
};

// ── AI Pattern Detection Phrases ──────────────────────────────────────────────
// Phrases that strongly indicate AI-generated content (weighted by strength).

const AI_DETECTION_PATTERNS = [
  { pattern: /\bit is important to note\b/gi, weight: 3.5 },
  { pattern: /\bit is worth noting\b/gi, weight: 3.0 },
  { pattern: /\bfurthermore\b/gi, weight: 2.5 },
  { pattern: /\bmoreover\b/gi, weight: 2.5 },
  { pattern: /\bin conclusion\b/gi, weight: 3.0 },
  { pattern: /\bto summarize\b/gi, weight: 2.8 },
  { pattern: /\bin summary\b/gi, weight: 2.8 },
  { pattern: /\bit is essential to\b/gi, weight: 2.5 },
  { pattern: /\bit is crucial\b/gi, weight: 2.5 },
  { pattern: /\bdue to the fact that\b/gi, weight: 3.0 },
  { pattern: /\bin order to\b/gi, weight: 1.8 },
  { pattern: /\bsubsequently\b/gi, weight: 2.5 },
  { pattern: /\butilize\b/gi, weight: 2.0 },
  { pattern: /\bleverage\b/gi, weight: 2.2 },
  { pattern: /\bfacilitate\b/gi, weight: 2.0 },
  { pattern: /\bdemonstrate\b/gi, weight: 1.8 },
  { pattern: /\bindividuals\b/gi, weight: 2.0 },
  { pattern: /\bsignificant(ly)?\b/gi, weight: 1.5 },
  { pattern: /\bcomprehensive\b/gi, weight: 2.0 },
  { pattern: /\bintricate\b/gi, weight: 2.5 },
  { pattern: /\bdelve\b/gi, weight: 3.5 },
  { pattern: /\btapestry\b/gi, weight: 3.5 },
  { pattern: /\bembark\b/gi, weight: 3.0 },
  { pattern: /\bfoster\b/gi, weight: 2.5 },
  { pattern: /\bspearhead\b/gi, weight: 2.8 },
  { pattern: /\bground-?breaking\b/gi, weight: 2.5 },
  { pattern: /\bundoubtedly\b/gi, weight: 2.5 },
  { pattern: /\bcertainly\b/gi, weight: 1.5 },
  { pattern: /\boverall,\b/gi, weight: 1.5 },
  { pattern: /\bultimately\b/gi, weight: 1.8 },
  { pattern: /\bplay a (crucial|pivotal|vital|key) role\b/gi, weight: 3.0 },
  { pattern: /\ba wide range of\b/gi, weight: 2.0 },
  { pattern: /\bin the realm of\b/gi, weight: 3.0 },
  { pattern: /\bin today's (world|society|digital age|landscape)\b/gi, weight: 3.5 },
  { pattern: /\bin the modern era\b/gi, weight: 3.0 },
  { pattern: /\bas we (navigate|move forward|delve)\b/gi, weight: 3.5 },
  { pattern: /\bit is imperative\b/gi, weight: 3.0 },
  { pattern: /\bwith that (said|being said)\b/gi, weight: 2.5 },
  { pattern: /\bone must\b/gi, weight: 2.5 },
  { pattern: /\bone should\b/gi, weight: 2.0 },
  { pattern: /\bnotably\b/gi, weight: 1.8 },
  { pattern: /\bspecifically\b/gi, weight: 1.2 },
  { pattern: /\bin essence\b/gi, weight: 2.5 },
  { pattern: /\bfundamentally\b/gi, weight: 2.0 },
];

// ── Statistical Helpers ───────────────────────────────────────────────────────

/**
 * Tokenize text into sentences.
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeSentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])|(?<=\n)\s*(?=[A-Z"'])/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Tokenize text into words (alpha only).
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeWords(text) {
  return text.toLowerCase().match(/\b[a-z']+\b/g) || [];
}

/**
 * Calculate mean of a number array.
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate standard deviation.
 * @param {number[]} arr
 * @returns {number}
 */
function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * Clamp a number between min and max.
 */
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Pick a random element from an array.
 */
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Common English word frequency estimate (approximated bigram model) ────────
// Higher frequency = more "expected" = lower perplexity.
// This is a simplified word frequency tier system.

const HIGH_FREQ_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
  'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
  'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
  'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could',
  'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come',
  'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how',
  'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because',
  'any', 'these', 'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were',
  'been', 'has', 'had', 'did', 'said', 'each', 'may', 'still',
]);

const MED_FREQ_WORDS = new Set([
  'important', 'provide', 'different', 'large', 'often', 'process',
  'real', 'number', 'off', 'always', 'move', 'right', 'among', 'such',
  'place', 'things', 'hand', 'high', 'every', 'next', 'end', 'near',
  'never', 'without', 'both', 'between', 'need', 'should', 'must',
  'through', 'long', 'used', 'while', 'last', 'under', 'might',
  'help', 'along', 'however', 'found', 'those', 'those', 'ask',
  'change', 'world', 'much', 'another', 'great', 'same', 'where',
  'life', 'very', 'little', 'part', 'let', 'keep', 'children', 'put',
  'does', 'point', 'company', 'too', 'group', 'country', 'problem',
  'hand', 'place', 'case', 'week', 'example', 'show', 'system',
]);

/**
 * Estimate word rarity score (0 = common, 1 = rare).
 */
function wordRarity(word) {
  const w = word.toLowerCase();
  if (HIGH_FREQ_WORDS.has(w)) return 0.1;
  if (MED_FREQ_WORDS.has(w)) return 0.4;
  if (w.length <= 4) return 0.3;
  if (w.length <= 7) return 0.6;
  return 0.85;
}

/**
 * Calculate text perplexity approximation (0 = very predictable, 1 = very unpredictable).
 * Lower perplexity = more AI-like (overly smooth/predictable).
 */
function calculatePerplexity(text) {
  const words = tokenizeWords(text);
  if (words.length < 10) return 0.5;

  const rarities = words.map(wordRarity);
  const avgRarity = mean(rarities);

  // AI text tends to use medium-frequency vocab — not too simple, not too exotic.
  // Peak AI zone is around 0.4–0.6 average rarity.
  // We measure distance from ideal human randomness (~0.55 avg rarity with high variance).
  const rarityVariance = stdDev(rarities);

  // Low variance in word rarity = AI-like
  // Scale: variance 0–0.1 = very AI, 0.3+ = more human
  const varianceScore = clamp(1 - rarityVariance / 0.3, 0, 1);

  // Mid-range average rarity without variance = AI
  const midRangeScore = 1 - Math.abs(avgRarity - 0.45) / 0.45;

  return clamp((varianceScore * 0.6 + midRangeScore * 0.4), 0, 1);
}

/**
 * Calculate burstiness score.
 * Human writing has "bursty" sentence lengths — some very short, some very long.
 * AI writing tends to have more uniform, medium-length sentences.
 * Returns 0–1 where 1 = very AI-like (low burstiness).
 */
function calculateBurstiness(text) {
  const sentences = tokenizeSentences(text);
  if (sentences.length < 3) return 0.5;

  const lengths = sentences.map(s => tokenizeWords(s).length);
  const m = mean(lengths);
  const sd = stdDev(lengths);

  // Burstiness metric: coefficient of variation
  const cv = m > 0 ? sd / m : 0;

  // Human CV typically 0.5–1.2, AI CV typically 0.15–0.45
  // Map: low CV (AI-like) → high score, high CV (human) → low score
  const burstinessScore = clamp(1 - cv / 0.8, 0, 1);

  // Also check average sentence length — AI often 20–35 words
  const avgLengthPenalty = (m >= 18 && m <= 32) ? 0.15 : 0;

  return clamp(burstinessScore + avgLengthPenalty, 0, 1);
}

/**
 * Calculate coherence marker density.
 * AI text uses transition words at very high rates.
 * Returns 0–1 where 1 = very AI-like.
 */
function calculateCoherenceMarkers(text) {
  const words = tokenizeWords(text);
  if (!words.length) return 0;

  const markers = [
    'furthermore', 'moreover', 'additionally', 'consequently', 'therefore',
    'nevertheless', 'nonetheless', 'subsequently', 'accordingly', 'thus',
    'hence', 'notwithstanding', 'meanwhile', 'conversely', 'alternatively',
    'specifically', 'notably', 'significantly', 'particularly', 'essentially',
    'fundamentally', 'ultimately', 'importantly', 'crucially',
  ];

  const markerCount = words.filter(w => markers.includes(w)).length;
  const density = markerCount / (words.length / 100); // per 100 words

  // AI typically: 3–10+ per 100 words. Human: 0–2 per 100 words.
  return clamp(density / 8, 0, 1);
}

/**
 * Check sentence start variety.
 * AI often starts many sentences with "The", "This", "It", "In".
 * Returns 0–1 where 1 = very AI-like (low variety).
 */
function calculateSentenceStartVariety(text) {
  const sentences = tokenizeSentences(text);
  if (sentences.length < 4) return 0.3;

  const starters = sentences.map(s => {
    const w = s.match(/\b\w+\b/);
    return w ? w[0].toLowerCase() : '';
  }).filter(Boolean);

  const uniqueStarters = new Set(starters).size;
  const totalStarters = starters.length;

  // Count how many start with the most common AI starters
  const commonAIStarters = ['the', 'this', 'it', 'in', 'by', 'there', 'these', 'one', 'to'];
  const aiStartCount = starters.filter(s => commonAIStarters.includes(s)).length;
  const aiStartRatio = aiStartCount / totalStarters;

  // Variety ratio: if 70%+ start with common words = AI-like
  const varietyScore = clamp(aiStartRatio / 0.7, 0, 1);

  return varietyScore;
}

/**
 * Detect AI patterns and return weighted match count.
 * Returns 0–1 score.
 */
function detectAIPatterns(text) {
  if (!text) return 0;

  let totalWeight = 0;
  const words = tokenizeWords(text);
  const wordCount = Math.max(words.length, 1);

  for (const { pattern, weight } of AI_DETECTION_PATTERNS) {
    const matches = (text.match(pattern) || []).length;
    if (matches > 0) {
      // Normalize by text length (per 200 words)
      totalWeight += (matches * weight) / (wordCount / 200);
    }
  }

  // Normalize: a score of 15+ = almost certainly AI
  return clamp(totalWeight / 15, 0, 1);
}

// Export everything
window.NLP = {
  AI_PHRASES,
  SENTENCE_STARTERS,
  AI_DETECTION_PATTERNS,
  tokenizeSentences,
  tokenizeWords,
  mean,
  stdDev,
  clamp,
  randomPick,
  escapeRegex,
  wordRarity,
  calculatePerplexity,
  calculateBurstiness,
  calculateCoherenceMarkers,
  calculateSentenceStartVariety,
  detectAIPatterns,
};
