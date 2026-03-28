export default function Loading() {
  return (
    <div className="page-shell">
      <div className="panel" style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <div className="spinner" aria-label="Loading page" />
      </div>
      <div className="skeleton" style={{ height: 120, marginTop: 16 }} />
      <div className="skeleton" style={{ height: 200, marginTop: 16 }} />
    </div>
  );
}
