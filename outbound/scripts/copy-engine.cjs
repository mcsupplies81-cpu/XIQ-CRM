// Copy engine — Claude writes personalized emails, validators check them
// Max 3 attempts per contact before quarantine

const Anthropic = require('@anthropic-ai/sdk')
const { validate } = require('../lib/validators.cjs')

const client = new Anthropic.default()

const PRODUCT_CONTEXT = `
XIQ is the operating system for an offensive football staff. NOT just a wristband tool — the full stack.

The core problem: every offensive staff runs 4-6 disconnected files every game week.
- Monday: update play inventory in a Google Sheet
- Tuesday: manually build the call sheet in Excel or PowerPoint, pulling from the sheet
- Wednesday: build the practice script in a separate doc, cross-referencing the call sheet by hand
- Thursday night: build QB wristbands in Word or Google Slides — copying play names, organizing by situation, numbering by hand
- Friday: a play changed. Update four documents. Reprint the wristband.

For HS coaches with day jobs: this is happening at 10pm every night.
For college staffs with analysts: still 4-8 hours of manual labor per week that doesn't need to exist.

XIQ connects all four: Inventory -> Call Sheet -> Practice Script -> QB Wristband.
Add a play once. It flows everywhere. Change something — it updates everywhere.

The four modules:
1. Inventory: master play database (formation, situation tags, install status, personnel, hash-specific calls, install batches)
2. Call Sheet: built directly from inventory — game plan in minutes, not hours
3. Script: practice planning that knows what's on the call sheet and what's game-ready
4. Wristband: auto-generated from the live game plan. Situations, personnel, play numbers, ready to print. Not typed in Word.

The result: game week prep goes from 4-6 hours to under an hour. One source of truth. No more version mismatches, no more wrong wristband on game day.

Competition: Hudl and XO do film and play drawing — no call sheets, scripts, or wristbands. Google Sheets is disconnected. XIQ is the only platform connecting all four in one football-native system.

Demo: 15 minutes, no pitch deck. Just the product.
Website: getxiq.com
Pricing: HS from $1,000/yr, 14-day free trial, no card required.
`

const HS_STAFF_CONTEXT = `
Staff framing for HIGH SCHOOL:
HS offensive coordinators often have day jobs — they teach, they work. Game week prep is happening at 10pm after practice ends. Staff is small: HC, OC, 2-4 assistants handling everything.
DO NOT reference QC analysts, graduate assistants, or GAs — those are college roles that don't exist at HS.
Use "you and your staff", "you and your coaches." Frame it as their own time being consumed, not a support staff problem.
The real buy for HS: time back. When game week prep goes from 6 hours to 45 minutes, that's real life back.
`

const COLLEGE_STAFF_CONTEXT = `
Staff framing for COLLEGE:
More staff, more complexity, higher stakes. QC coaches, graduate assistants, GAs — these roles exist and can be referenced.
Key pain points at college: multiple analysts managing separate spreadsheets, version mismatches, "which call sheet are we printing?" on Friday, wristband accuracy (an error doesn't just cost a play — it can cost a game).
Frame: GAs and analysts should be in the film room breaking down tendencies, not rebuilding documents.
`

const SOCIAL_PROOF_HS = `Programs from high school to Power Four are running it, including teams in the SEC and Big 12.`
const SOCIAL_PROOF_COLLEGE = `Programs at Alabama, Baylor, Hawaii, Nevada, and Sac State are running it.`
// NEVER mention high schools to college contacts.

const SEQUENCE_PROMPTS = [
  // Step 0 (Email 1, Day 1): personalized cold opener
  (research, contact, school, isCollege) => `
You are writing a cold outreach email from Cameron at XIQ to ${contact.name}, ${contact.role} at ${school.name}.

${PRODUCT_CONTEXT}

${isCollege ? COLLEGE_STAFF_CONTEXT : HS_STAFF_CONTEXT}

Research bundle -- use any record, ranking, or specific fact to personalize the opener. Do not invent facts:
${JSON.stringify(research, null, 2)}

Social proof (one line, woven in naturally):
${isCollege ? SOCIAL_PROOF_COLLEGE : SOCIAL_PROOF_HS}

Rules -- hard constraints:
- NEVER use em dashes (—). Use commas or periods.
- No slop: no "hope you're doing well", "I wanted to reach out", "just following up", "congrats on a great season", "as a coach"
- If research has a record, ranking, or notable win — open with it. "A 14-1 season this past year..." or "Going undefeated this past year..." Not with the product name.
- Any stat or record you mention must come from the research bundle. Never invent.
- When referencing a season record, always say "this past year" or "last season" — never "this year" or "this season."
- Lead with their program or the problem. Do NOT pitch XIQ in the first sentence.
- Max 150 words. Shorter is better.
- One clear ask: "Worth 15 minutes?" or similar.
- Sign off: Cameron / XIQ (two lines)
- ${isCollege ? 'College program. Never mention high schools or JV/varsity.' : 'High school program. Never reference QC analysts, GAs, or graduate assistants.'}

Write the subject line on the first line (no "Subject:" prefix), then a blank line, then the email body.
`,

  // Step 1 (Email 2, Day 3): wristband hook + personalized
  (research, contact, school, isCollege) => `
Write a follow-up email (email 2 of 4) from Cameron at XIQ to ${contact.name} at ${school.name}.

${isCollege ? COLLEGE_STAFF_CONTEXT : HS_STAFF_CONTEXT}

This is a follow-up to a cold email that got no reply. Reference "last week" briefly once.

If the research bundle has something specific (record, ranking, offensive style) — open with ONE brief personal line about it. 1 sentence, then move on. If nothing useful is in research, skip this.

Then: pivot to how they're building QB wristbands right now. Most OCs are doing it in Word, Google Slides, or by hand. Every week. XIQ auto-generates them from the live game plan — by situation, by personnel, proper numbering, ready to print. Two minutes instead of two hours.

One ask at the end: worth a look?

Research bundle (use only if something concrete is there, do not invent):
${JSON.stringify(research, null, 2)}

Rules:
- NEVER use em dashes (—)
- No "quick question", no slop phrases
- Max 80 words
- Sign off: Cameron / XIQ

Write subject on first line (no "Subject:" prefix), blank line, then body.
`,

  // Step 2 (Email 3, Day 6): the disconnected files problem
  (research, contact, school, isCollege) => `
Write email 3 of 4 from Cameron at XIQ to ${contact.name} at ${school.name}.

${isCollege ? COLLEGE_STAFF_CONTEXT : HS_STAFF_CONTEXT}

This email is about the disconnected files problem — the full ops chaos, not wristbands specifically.

Core message for ${isCollege ? 'COLLEGE' : 'HIGH SCHOOL'}:
${isCollege
  ? 'Their staff is probably running the offense out of 4-5 separate files: play inventory, call sheet, practice script, wristband doc. Multiple analysts managing their own spreadsheets that need to be reconciled. Version mismatches. "Which call sheet are we printing?" on Friday night. XIQ is one source of truth: add a play once, it flows to call sheet, script, and wristband automatically. Change happens in one place.'
  : 'Their staff is running the offense out of 4-5 disconnected files. One messy Google Sheet that tries to be everything. A call sheet. A wristband doc. None of them talk to each other. They update one, they have to update all of them. At 10pm. XIQ is one system: add a play once, it flows everywhere. No more rebuilding the same information four times.'}

If research has something personal (record, offensive style), open with a brief one-line reference. If not, lead straight with the problem.

One ask: 15 minutes, no pitch deck.

Research bundle (use only what's specific, do not invent):
${JSON.stringify(research, null, 2)}

Rules:
- NEVER use em dashes (—)
- Max 100 words
- No slop
- Sign off: Cameron / XIQ

Write subject on first line (no "Subject:" prefix), blank line, then body.
`,

  // Step 3 (Email 4, Day 10): break-up email
  (research, contact, school, isCollege) => `
Write a final break-up email (email 4 of 4) from Cameron at XIQ to ${contact.name} at ${school.name}.

This is the last touch. Low pressure. Leave the door completely open.

Tone: honest, zero pressure. If game week prep is already smooth — XIQ isn't for them right now, no hard feelings. But if they're still building by hand, before next season is the right time to look.

One last ask: 15 minutes, no pitch, just the product. Reply or grab time.

Rules:
- NEVER use em dashes (—)
- Max 60 words
- No slop
- Sign off: Cameron / XIQ

Write subject on first line (no "Subject:" prefix), blank line, then body.
`,
]

async function generateEmail(step, research, contact, school) {
  const isCollege = ['FCS', 'FBS', 'D1', 'D2', 'D3', 'NAIA', 'JUCO'].includes(school.level)
  const prompt = SEQUENCE_PROMPTS[step](research, contact, school, isCollege)

  for (let attempt = 1; attempt <= 3; attempt++) {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const output = msg.content[0].text.trim()
    const lines = output.split('\n')
    const subject = lines[0].trim().replace(/^subject:\s*/i, '').replace(/—/g, ',').replace(/ -- /g, ', ')
    const body = lines.slice(2).join('\n').trim()

    const result = validate(body, research)
    if (result.pass) {
      return { subject, body, attempt }
    }

    console.log(`  Attempt ${attempt} failed: ${result.failures.join(', ')}`)
  }

  return null // quarantine
}

module.exports = { generateEmail }
