// Copy engine — Claude writes personalized emails, validators check them
// Max 3 attempts per contact before quarantine

const Anthropic = require('@anthropic-ai/sdk')
const { validate } = require('../lib/validators.cjs')

const client = new Anthropic.default()

const PRODUCT_CONTEXT = `
XIQ is an offensive operations platform for football. NOT a wristband tool — the full stack.
- Playbook management
- Call sheet creation
- Practice scripts
- Auto-generated QB wristbands from the actual game plan
All in one system. Change one play and it updates everywhere.

Core problem it solves: Coaches juggle Google Sheets for the playbook, PowerPoint for the call sheet, hand-typed scripts, and wristbands built in Word at midnight before game day. None of it talks to each other.

Why they win: Nobody else connects inventory to game plan to practice script to wristband in one football-native system. Hudl draws plays. XO draws plays. Nobody does the full ops stack.

Website: getxiq.com
Demo ask: 15 minutes
`

const HS_STAFF_CONTEXT = `Staff framing for HIGH SCHOOL: HS programs do NOT have QC analysts, graduate assistants, or GAs. It's the head coach, OC, and a few assistants doing everything. Use "you and your staff", "you and your coaches" — frame it as their own time being consumed, not a support staff problem.`

const COLLEGE_STAFF_CONTEXT = `Staff framing for COLLEGE: reference QC analysts, graduate assistants, GAs, quality control staff — these roles exist. "Your QC guys and GAs could be in the film room breaking down tendencies instead of rebuilding documents."`

const SOCIAL_PROOF_HS = `Programs from high school to Power Four are running it, including teams in the SEC and Big 12.`
const SOCIAL_PROOF_COLLEGE = `Programs at Alabama, Baylor, Hawaii, Nevada, and Sac State are running it.`
// NEVER mention high schools to college contacts.

const SEQUENCE_PROMPTS = [
  // Step 0: personalized opener
  (research, contact, school, isCollege) => `
You are writing a cold outreach email from Cameron at XIQ to ${contact.name}, ${contact.role} at ${school.name}.

${PRODUCT_CONTEXT}

${isCollege ? COLLEGE_STAFF_CONTEXT : HS_STAFF_CONTEXT}

Research bundle — if record, ranking, or enrollment data is present, open with it. Do not invent facts:
${JSON.stringify(research, null, 2)}

Social proof (one line, woven in naturally):
${isCollege ? SOCIAL_PROOF_COLLEGE : SOCIAL_PROOF_HS}

Rules — hard constraints:
- NEVER use em dashes (—). Use commas or periods instead.
- No slop: no "hope you're doing well", "i wanted to reach out", "just following up", "congrats on a great season", "as a coach", etc.
- Do NOT pitch the product in the first sentence. Lead with something specific about their program or the problem.
- Any score, record, or stat you mention must come from the research bundle above. Do not invent.
- Max 150 words. Shorter is better.
- One clear ask at the end: "Worth 15 minutes?" or similar. One question only.
- Sign off: Cameron / XIQ (two lines, nothing else)
- ${isCollege ? 'College program. Never mention high schools or JV/varsity.' : 'High school program. Never reference QC analysts, GAs, or graduate assistants — those are college roles.'}

Write the subject line on the first line (no "Subject:" prefix), then a blank line, then the email body.
`,

  // Step 1: follow-up — wristband hook
  (research, contact, school, isCollege) => `
Write a short follow-up email (email 2 of 3) from Cameron at XIQ to ${contact.name} at ${school.name}.

This is a follow-up to an unanswered email. Reference "last week" briefly.
Then drop ONE specific thing about the product: the wristband is auto-generated from the actual game plan. Not typed in Word. Not a doc that breaks when you add a play. Ready to print.

Rules:
- NEVER use em dashes (—)
- Max 80 words
- No slop phrases
- One ask: happy to do a quick demo
- Sign off: Cameron / XIQ

Write subject on first line, blank line, then body.
`,

  // Step 2: video email — still personal, then the video
  (research, contact, school, isCollege) => `
Write email 3 of 3 from Cameron at XIQ to ${contact.name} at ${school.name}.

Open with one personal line referencing something specific about their program from this research:
${JSON.stringify(research, null, 2)}

Then one sentence: put together a short video showing what XIQ looks like for a program at their level — probably the fastest way to see if it fits.

End with: [Watch the demo: getxiq.com/demo]

Rules:
- NEVER use em dashes (—)
- Max 80 words
- No slop
- Sign off: Cameron / XIQ

Write subject on first line, blank line, then body.
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
    const subject = lines[0].trim()
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
