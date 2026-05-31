const COLORS = [
  'bg-violet-500','bg-blue-500','bg-green-500','bg-amber-500',
  'bg-rose-500','bg-sky-500','bg-teal-500','bg-orange-500',
]
function colorForName(name) {
  const code = [...(name || '')].reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return COLORS[code % COLORS.length]
}
function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  return (name || '').slice(0, 2).toUpperCase() || '—'
}
export default function Avatar({ name, size = 'sm' }) {
  const sizeClass = size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
  return (
    <div className={`${sizeClass} ${colorForName(name)} flex shrink-0 items-center justify-center rounded-full font-semibold text-white`} aria-label={name ? `${name} avatar` : 'Avatar'}>
      {initials(name)}
    </div>
  )
}
