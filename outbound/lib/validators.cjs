// Email copy validators — deterministic string matching, not prompts
// Models paraphrase around instructions. They can't paraphrase around these checks.

const SLOP = [
  'hope you',
  'hope this finds you',
  'i wanted to reach out',
  'i came across',
  'just following up',
  'just checking in',
  'touching base',
  'circle back',
  'quick question',
  'as a football coach',
  'as an athletic director',
  'as an ad',
  'congrats on a great season',
  'congratulations on',
  'i know you\'re busy',
  'i\'d love to',
  'excited to share',
  'game-changer',
  'game changer',
  'revolutionary',
  'innovative solution',
  'synergy',
  'leverage',
  'take it to the next level',
  'best-in-class',
  'world-class',
  'cutting-edge',
  'state-of-the-art',
  'dear coach',
  'dear athletic director',
  'to whom it may concern',
]

// Em dash — never in copy
function checkEmDash(body) {
  if (body.includes('—') || body.includes(' -- ')) {
    return { pass: false, reason: 'em dash found' }
  }
  return { pass: true }
}

// No slop phrases
function checkSlop(body) {
  const lower = body.toLowerCase()
  for (const phrase of SLOP) {
    if (lower.includes(phrase)) {
      return { pass: false, reason: `slop phrase: "${phrase}"` }
    }
  }
  return { pass: true }
}

// Any quoted string (in quotes) must appear verbatim in research
function checkGrounding(body, research) {
  const researchText = JSON.stringify(research).toLowerCase()
  const quotes = body.match(/"([^"]{4,})"/g) || []
  for (const q of quotes) {
    const inner = q.slice(1, -1).toLowerCase()
    if (!researchText.includes(inner)) {
      return { pass: false, reason: `ungrounded quote: ${q}` }
    }
  }
  return { pass: true }
}

// Any score like "31-24" or "47-12" must appear in research
// Excludes ranges followed by unit words (e.g. "4-6 hours", "2-3 days")
function checkStats(body, research) {
  const researchText = JSON.stringify(research).toLowerCase()
  const scores = body.match(/\d{1,3}-\d{1,3}/g) || []
  const unitWords = /^\s*(hours?|minutes?|yards?|points?|lbs?|days?|weeks?|months?|years?|minutes?|seconds?)/i
  for (const score of scores) {
    const idx = body.indexOf(score)
    const after = body.slice(idx + score.length)
    if (unitWords.test(after)) continue
    if (!researchText.includes(score)) {
      return { pass: false, reason: `ungrounded score: ${score}` }
    }
  }
  return { pass: true }
}

// Body must be under 200 words
function checkLength(body) {
  const words = body.trim().split(/\s+/).length
  if (words > 200) {
    return { pass: false, reason: `too long: ${words} words (max 200)` }
  }
  return { pass: true }
}

// First sentence must not contain a pitch (product name or URL)
function checkNoPitchInOpener(body) {
  const firstSentence = body.split(/[.!?]/)[0].toLowerCase()
  if (firstSentence.includes('xiq') || firstSentence.includes('getxiq') || firstSentence.includes('platform') || firstSentence.includes('system')) {
    return { pass: false, reason: 'pitch in first sentence' }
  }
  return { pass: true }
}

// Must end with a single clear ask — not multiple questions
function checkSingleAsk(body) {
  const questions = (body.match(/\?/g) || []).length
  if (questions > 2) {
    return { pass: false, reason: `too many questions: ${questions}` }
  }
  return { pass: true }
}

function validate(body, research) {
  const checks = [
    checkEmDash(body),
    checkSlop(body),
    checkGrounding(body, research),
    checkStats(body, research),
    checkLength(body),
    checkNoPitchInOpener(body),
    checkSingleAsk(body),
  ]
  const failures = checks.filter(c => !c.pass)
  return {
    pass: failures.length === 0,
    failures: failures.map(f => f.reason),
  }
}

module.exports = { validate, SLOP }
