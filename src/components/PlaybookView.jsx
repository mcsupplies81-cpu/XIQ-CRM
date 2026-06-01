import { useState } from 'react'
import playbook from '../data/playbook.json'

// ── flatten every navigable node into one lookup map ────────────────────────

function buildNodeMap() {
  const map = {}
  for (const persona of Object.values(playbook.personas)) {
    map[persona.script.opener.id] = persona.script.opener
    for (const node of Object.values(persona.script.nodes)) map[node.id] = node
  }
  for (const node of Object.values(playbook.objections)) map[node.id] = node
  for (const node of Object.values(playbook.re_engage_scripts)) {
    if (node.id) map[node.id] = node
  }
  for (const node of Object.values(playbook.wrong_person_handling)) {
    if (node.id) map[node.id] = node
  }
  for (const node of Object.values(playbook.competitor_handling)) {
    if (node.id) map[node.id] = node
  }
  return map
}

const NODES = buildNodeMap()

function lookupDisposition(key) {
  if (!key) return null
  return (
    playbook.dispositions[key] ||
    playbook.dispositions[key.replace(/^disposition_/, '')] ||
    null
  )
}

// ── static config ─────────────────────────────────────────────────────────────

const PERSONAS = [
  {
    openerNode: 'coach_opener',
    label: 'Head Coach',
    sublabel: 'Book walkthrough or refer to OC',
    accent: 'amber',
  },
  {
    openerNode: 'ad_opener',
    label: 'Athletic Director',
    sublabel: 'Route to coach or joint demo',
    accent: 'blue',
  },
]

const QUICK_LINKS = [
  { id: 'reengage_sent_info', label: 'Re-engage: Sent info, no response' },
  { id: 'reengage_call_back', label: 'Re-engage: "Call me back later"' },
  { id: 'reengage_no_show', label: 'Re-engage: Demo no-show' },
  { id: 'wrong_person_not_coach', label: 'Reached wrong person (not the coach)' },
  { id: 'wrong_person_not_football', label: 'Reached wrong coach (not football)' },
  { id: 'competitor_google_sheets', label: 'Objection: "We use Google Sheets"' },
  { id: 'competitor_dedicated_system', label: 'Objection: "We have a system"' },
]

const FIELD_LABELS = {
  date_time: 'Date & time confirmed',
  attendees: 'Attendees noted',
  roles: 'Roles captured',
  current_workflow: 'Current workflow logged',
  main_pain: 'Main pain noted',
  budget_path: 'Budget path clarified',
  referred_name: 'Referral name captured',
  referred_role: 'Referral role noted',
  referred_contact: 'Referral contact info',
  permission_to_mention: 'OK to mention you spoke with HC?',
  existing_system: 'Existing system logged in CRM',
  suppress_future_outreach: 'Mark suppressed in CRM',
  better_timing: 'Better timing noted',
  follow_up_date: 'Follow-up date set in CRM',
  reason: 'Reason logged',
  info_requested: 'Info topic noted',
  main_interest_area: 'Interest area captured',
  email_confirmed: 'Email confirmed',
}

const DISP_STYLES = {
  demo_booked: { bar: 'bg-green-500', card: 'border-green-300 bg-green-50', text: 'text-green-800' },
  referral: { bar: 'bg-blue-500', card: 'border-blue-300 bg-blue-50', text: 'text-blue-800' },
  disposition_send_info: { bar: 'bg-violet-500', card: 'border-violet-300 bg-violet-50', text: 'text-violet-800' },
  not_now: { bar: 'bg-amber-500', card: 'border-amber-300 bg-amber-50', text: 'text-amber-800' },
  not_a_fit: { bar: 'bg-gray-400', card: 'border-gray-300 bg-gray-50', text: 'text-gray-700' },
}

function dispStyle(key) {
  if (!key) return DISP_STYLES.not_a_fit
  const normalized = key.replace(/^disposition_/, '')
  return (
    DISP_STYLES[key] ||
    DISP_STYLES[normalized] ||
    DISP_STYLES.not_a_fit
  )
}

// ── shared components ──────────────────────────────────────────────────────────

// Renders script text with [Placeholder] highlighted in amber
function ScriptText({ text }) {
  if (!text) return null
  const parts = text.split(/(\[[^\]]+\])/g)
  return (
    <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-900">
      {parts.map((part, i) =>
        /^\[.+\]$/.test(part) ? (
          <span key={i} className="rounded bg-amber-50 px-0.5 font-semibold text-amber-700">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  )
}

function DispositionCard({ dispKey }) {
  const disp = lookupDisposition(dispKey)
  if (!disp) return null
  const s = dispStyle(dispKey)
  return (
    <div className={`rounded-lg border p-4 ${s.card}`}>
      <div className={`text-sm font-semibold ${s.text}`}>
        Disposition: {disp.label}
      </div>
      {disp.required_fields && (
        <div className="mt-3 space-y-1.5">
          <div className={`text-xs font-medium uppercase tracking-wide opacity-60 ${s.text}`}>
            Log in CRM before hanging up
          </div>
          {disp.required_fields.map((f) => (
            <label key={f} className={`flex cursor-pointer items-start gap-2 text-sm ${s.text}`}>
              <input type="checkbox" className="mt-0.5 shrink-0 accent-current" />
              <span>{FIELD_LABELS[f] || f}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── reference panels (accordion) ──────────────────────────────────────────────

function RefVoicemail() {
  return (
    <div className="space-y-5">
      {Object.values(playbook.voicemails).map((vm) => (
        <div key={vm.id}>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{vm.label}</div>
          <ScriptText text={vm.script} />
        </div>
      ))}
    </div>
  )
}

function RefDiscovery() {
  const groups = [
    { label: 'Workflow', qs: playbook.discovery_questions.coach.workflow },
    { label: 'Pain', qs: playbook.discovery_questions.coach.pain },
    { label: 'Self-scout', qs: playbook.discovery_questions.coach.self_scout },
    { label: 'Timing', qs: playbook.discovery_questions.coach.timing },
  ]
  return (
    <div className="space-y-4">
      {groups.map(({ label, qs }) => (
        <div key={label}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
          <ul className="space-y-1">
            {qs.map((q, i) => <li key={i} className="text-sm text-gray-700">• {q}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}

function RefEmails() {
  return (
    <div className="space-y-5">
      {Object.values(playbook.follow_up_emails).map((e) => (
        <div key={e.id}>
          <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{e.label}</div>
          <div className="mb-2 text-xs text-gray-400">Subject: {e.subject}</div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{e.body}</p>
        </div>
      ))}
    </div>
  )
}

function RefSequence() {
  return (
    <ol className="space-y-3">
      {playbook.call_sequence.map((step) => (
        <li key={step.step} className="flex gap-3 text-sm">
          <span className="w-5 shrink-0 font-bold text-gray-400">{step.step}.</span>
          <div>
            <span className="font-semibold text-gray-900">{step.action}</span>
            <span className="text-gray-500"> — {step.goal}</span>
          </div>
        </li>
      ))}
    </ol>
  )
}

function RefLanguage() {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-700">✓ Use</div>
        <div className="flex flex-wrap gap-1">
          {playbook.language_rules.use.map((w) => (
            <span key={w} className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">{w}</span>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-600">✗ Avoid</div>
        <div className="flex flex-wrap gap-1">
          {playbook.language_rules.avoid.map((w) => (
            <span key={w} className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">{w}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

const REFS = [
  { key: 'voicemail', label: 'Voicemail Scripts', Component: RefVoicemail },
  { key: 'discovery', label: 'Discovery Questions', Component: RefDiscovery },
  { key: 'emails', label: 'Follow-up Email Templates', Component: RefEmails },
  { key: 'sequence', label: 'Call Sequence (6 steps)', Component: RefSequence },
  { key: 'language', label: 'Language Rules', Component: RefLanguage },
]

function ReferenceSection() {
  const [open, setOpen] = useState(null)
  return (
    <div className="space-y-1">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Reference</div>
      {REFS.map(({ key, label, Component }) => (
        <div key={key}>
          <button
            type="button"
            onClick={() => setOpen(open === key ? null : key)}
            className="flex w-full items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <span>{label}</span>
            <span className="text-xs text-gray-400">{open === key ? '▲' : '▼'}</span>
          </button>
          {open === key && (
            <div className="mt-1 rounded border border-gray-100 bg-gray-50 p-4">
              <Component />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── start screen ──────────────────────────────────────────────────────────────

function StartScreen({ onStart }) {
  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-0.5 text-2xl font-semibold text-gray-900">Call Playbook</h1>
      <p className="mb-8 text-sm text-gray-500">Pick who you're calling to load the right script.</p>

      {/* Persona cards */}
      <div className="mb-8 grid grid-cols-2 gap-3">
        {PERSONAS.map((p) => (
          <button
            key={p.openerNode}
            type="button"
            onClick={() => onStart(p.openerNode)}
            className={`rounded-lg border-2 p-5 text-left transition-all hover:shadow-sm ${
              p.accent === 'amber'
                ? 'border-amber-300 hover:border-amber-400 hover:bg-amber-50'
                : 'border-blue-300 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            <div className={`mb-1 text-xs font-bold uppercase tracking-wide ${p.accent === 'amber' ? 'text-amber-600' : 'text-blue-600'}`}>
              {p.label}
            </div>
            <div className="text-sm text-gray-600">{p.sublabel}</div>
          </button>
        ))}
      </div>

      {/* Quick links */}
      <div className="mb-8 space-y-1">
        <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Quick start</div>
        {QUICK_LINKS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onStart(id)}
            className="flex w-full items-center justify-between rounded border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            <span>{label}</span>
            <span className="text-gray-400">→</span>
          </button>
        ))}
      </div>

      <ReferenceSection />
    </div>
  )
}

// ── script screen ─────────────────────────────────────────────────────────────

function ScriptScreen({ nodeId, onNavigate, onBack, onReset }) {
  const node = NODES[nodeId]

  // Pure disposition terminal — no node body, just the outcome
  if (!node) {
    const disp = lookupDisposition(nodeId)
    return (
      <div className="mx-auto max-w-xl p-6">
        <div className="mb-6 flex items-center gap-3">
          <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
          <button type="button" onClick={onReset} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Start over</button>
        </div>
        {disp ? (
          <DispositionCard dispKey={nodeId} />
        ) : (
          <p className="text-sm text-gray-400 italic">End of script.</p>
        )}
      </div>
    )
  }

  const hasDisposition = Boolean(node.disposition)
  const hasBranches = node.branches?.length > 0

  return (
    <div className="mx-auto max-w-xl p-6">
      {/* Nav bar */}
      <div className="mb-5 flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900">← Back</button>
        <span className="min-w-0 flex-1 truncate text-xs text-gray-400">{node.label}</span>
        <button type="button" onClick={onReset} className="shrink-0 text-xs text-gray-400 hover:text-gray-600">Start over</button>
      </div>

      {/* Script card */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">{node.label}</div>
        <ScriptText text={node.script} />
        {node.note && (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-xs text-amber-700">💡 {node.note}</p>
          </div>
        )}
      </div>

      {/* Disposition outcome + CRM checklist */}
      {hasDisposition && <DispositionCard dispKey={node.disposition} />}

      {/* Branch buttons */}
      {hasBranches && (
        <div className={hasDisposition ? 'mt-4' : ''}>
          {!hasDisposition && (
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">They say…</div>
          )}
          <div className="space-y-2">
            {node.branches.map((branch, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onNavigate(branch.next)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-900 transition-colors hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100"
              >
                <span className="italic">"{branch.trigger}"</span>
                <span className="ml-3 shrink-0 text-gray-400">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No branches, no disposition — dead end */}
      {!hasBranches && !hasDisposition && (
        <p className="mt-3 text-sm italic text-gray-400">End of this branch.</p>
      )}
    </div>
  )
}

// ── main export ───────────────────────────────────────────────────────────────

export default function PlaybookView() {
  const [currentNodeId, setCurrentNodeId] = useState(null)
  const [history, setHistory] = useState([])

  function navigate(nextId) {
    if (!nextId) return
    setHistory((h) => [...h, currentNodeId].filter(Boolean))
    setCurrentNodeId(nextId)
  }

  function goBack() {
    if (history.length === 0) {
      setCurrentNodeId(null)
      return
    }
    const h = [...history]
    const prev = h.pop()
    setHistory(h)
    setCurrentNodeId(prev ?? null)
  }

  function reset() {
    setCurrentNodeId(null)
    setHistory([])
  }

  if (!currentNodeId) {
    return (
      <div className="min-h-screen bg-white">
        <StartScreen onStart={(id) => { setCurrentNodeId(id); setHistory([]) }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <ScriptScreen
        nodeId={currentNodeId}
        onNavigate={navigate}
        onBack={goBack}
        onReset={reset}
      />
    </div>
  )
}
