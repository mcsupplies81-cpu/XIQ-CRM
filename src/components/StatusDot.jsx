const dotColors = {
  New: 'bg-gray-400',
  Emailed: 'bg-blue-500',
  Called: 'bg-amber-500',
  Responded: 'bg-purple-500',
  Closed: 'bg-green-500',
}

export default function StatusDot({ status }) {
  const label = status || 'New'
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColors[label] || 'bg-gray-400'}`} />
      <span className="text-[13px] text-gray-700">{label}</span>
    </span>
  )
}
