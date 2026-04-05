interface ErrorStateProps {
  message?: string;
  detail?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went sideways", detail, onRetry }: ErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "64px 24px",
        textAlign: "center"
      }}
    >
      <div style={{ fontSize: "2rem", marginBottom: "16px" }}>⚠️</div>
      <h3 style={{ color: "var(--white)", fontWeight: 600, marginBottom: "8px" }}>{message}</h3>
      {detail ? (
        <details style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginBottom: "20px" }}>
          <summary style={{ cursor: "pointer" }}>Technical detail</summary>
          <p style={{ marginTop: "8px", fontFamily: "monospace" }}>{detail}</p>
        </details>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            border: "1px solid var(--accent-cyan)",
            color: "var(--accent-cyan)",
            background: "transparent",
            borderRadius: "8px",
            padding: "10px 20px",
            cursor: "pointer",
            fontSize: "0.875rem"
          }}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
