/** Graffify wordmark: a small line graph, like the original logo, drawn as SVG so it stays sharp. */
export function Logo() {
  return (
    <span className="logo">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
        <path d="M5 16l4.5-6.5M12.5 9.5l3 4.5M17.5 13l2-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <circle cx="4.5" cy="17" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="11" cy="8" r="2.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16.5" cy="15" r="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="20" cy="7.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3 21h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="logo-word">graffify</span>
    </span>
  )
}
