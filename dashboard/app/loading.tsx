export default function Loading() {
  return (
    <div className="pulse-loader-screen app-background">
      <div className="pulse-loader-mark">PulseOS</div>
      <div className="pulse-loader-dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <p>Getting your data ready…</p>
    </div>
  );
}
