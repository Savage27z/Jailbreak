"use client";

export default function PlayError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 32 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p style={{ fontFamily: "var(--serif)", fontSize: "2rem", color: "var(--legendary)", marginBottom: 12 }}>
          Something broke.
        </p>
        <p style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--fg-3)", marginBottom: 8 }}>
          {error.message || "An unexpected error occurred"}
        </p>
        <p style={{ fontFamily: "var(--mono)", fontSize: "0.65rem", color: "var(--fg-3)", marginBottom: 32 }}>
          The Cosmos Hub API may be temporarily unavailable.
        </p>
        <button onClick={reset} className="btn-primary" style={{ margin: "0 auto" }}>
          try again
        </button>
      </div>
    </div>
  );
}
