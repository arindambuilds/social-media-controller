export function CircuitBg({ className }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ""}`}
      aria-hidden
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.07 }}
      >
        <defs>
          <pattern
            id="circuit-pattern"
            x="0"
            y="0"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 40 30 M 40 50 L 40 80 M 0 40 L 30 40 M 50 40 L 80 40"
              stroke="#00E5FF"
              strokeWidth="0.6"
              fill="none"
            />
            <circle cx="40" cy="40" r="4" fill="none" stroke="#8B5CF6" strokeWidth="0.6" />
            <circle cx="40" cy="40" r="1.5" fill="#00E5FF" />
            <circle cx="0"  cy="0"  r="1.5" fill="#00E5FF" />
            <circle cx="80" cy="0"  r="1.5" fill="#FF6B9D" />
            <circle cx="0"  cy="80" r="1.5" fill="#8B5CF6" />
            <circle cx="80" cy="80" r="1.5" fill="#00E5FF" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#circuit-pattern)" />
      </svg>
    </div>
  );
}
