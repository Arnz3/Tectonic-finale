import { useId } from 'react'

/** Generic four-point sparkle with a blue–purple–pink gradient (assistant style, no brand logo). */
export function Sparkle({ size = 18 }: { size?: number }) {
  const id = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="sparkle">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f7cf6" />
          <stop offset="0.55" stopColor="#8a5cf6" />
          <stop offset="1" stopColor="#e85c9b" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 2c.6 4.6 2.9 7.4 8 8.2v1.6c-5.1.8-7.4 3.6-8 8.2h-1.6c-.6-4.6-2.9-7.4-8-8.2v-1.6c5.1-.8 7.4-3.6 8-8.2z"
      />
      <path fill={`url(#${id})`} d="M19 15.5c.3 1.9 1.2 3 3 3.3v.7c-1.8.3-2.7 1.4-3 3.3h-.7c-.3-1.9-1.2-3-3-3.3v-.7c1.8-.3 2.7-1.4 3-3.3z" />
    </svg>
  )
}
