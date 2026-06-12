export default function PlagiarismPanel({ result }) {
  const score   = result.communication_score || 0;
  const pct     = (score / 5) * 100;
  const r       = 50;
  const circ    = 2 * Math.PI * r;
  const offset  = circ * (1 - pct / 100);

  const statusColor = {
    original:      "pill-green",
    likely_copied: "pill-red",
    uncertain:     "pill-amber",
  };

  return (
    <div className="fade-up-2">
      <div style={{ marginBottom: 14, display: "flex", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ fontSize: 26 }}>AI EVAL</h2>
        <span className={"pill " + (score >= 3 ? "pill-green" : score >= 2 ? "pill-amber" : "pill-red")}>
          {score.toFixed(1)}/5
        </span>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>
        Llama 3 · Groq API {!result.llama_available && <span style={{ color: "var(--warn)" }}>(rule-based)</span>}
      </p>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--paper-2)" strokeWidth="10" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--ink)"
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dashoffset 1s ease" }} />
          <text x="60" y="56" textAnchor="middle" fontFamily="var(--font-display)" fontSize="26" fill="var(--ink)">{score.toFixed(1)}</text>
          <text x="60" y="72" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--muted)">/ 5</text>
        </svg>
      </div>

      {result.plagiarism_status && (
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <span className={"pill " + (statusColor[result.plagiarism_status] || "pill-gray")}>
            {result.plagiarism_status.replace("_", " ")}
          </span>
        </div>
      )}

      {result.tone && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 14, flexWrap: "wrap" }}>
          <span className="pill pill-blue">Tone: {result.tone}</span>
          {result.answer_depth && <span className="pill pill-gray">Depth: {result.answer_depth}</span>}
        </div>
      )}

      {result.feedback && (
        <div className="card card-sm" style={{ marginBottom: 12, background: "var(--paper-2)" }}>
          <p className="section-eyebrow" style={{ marginBottom: 6 }}>Feedback</p>
          <p style={{ fontSize: 12, lineHeight: 1.7, color: "var(--ink)" }}>{result.feedback}</p>
        </div>
      )}

      {result.strengths && result.strengths.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p className="section-eyebrow" style={{ marginBottom: 6 }}>Strengths</p>
          {result.strengths.map((s, i) => (
            <p key={i} style={{ fontSize: 12, color: "var(--accent-3)", marginBottom: 3 }}>+ {s}</p>
          ))}
        </div>
      )}

      {result.improvements && result.improvements.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p className="section-eyebrow" style={{ marginBottom: 6 }}>To Improve</p>
          {result.improvements.map((s, i) => (
            <p key={i} style={{ fontSize: 12, color: "var(--accent)", marginBottom: 3 }}>- {s}</p>
          ))}
        </div>
      )}

      {result.skills_mentioned && result.skills_mentioned.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p className="section-eyebrow" style={{ marginBottom: 6 }}>Skills Mentioned</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {result.skills_mentioned.map((s, i) => <span key={i} className="pill pill-blue">{s}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
