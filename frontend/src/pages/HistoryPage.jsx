import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";

export default function HistoryPage({ onBack }) {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    axios.get(API + "/sessions?limit=100")
      .then(r => { setSessions(r.data); setLoading(false); })
      .catch(e => { setError("Could not load sessions. Is the backend running?"); setLoading(false); });
  }, []);

  async function handleDelete(id) {
    if (!window.confirm("Delete this session?")) return;
    try {
      await axios.delete(API + "/sessions/" + id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      alert("Delete failed.");
    }
  }

  const gradeColor = { A: "pill-green", B: "pill-green", C: "pill-amber", D: "pill-red", F: "pill-red" };

  const filtered = sessions.filter(s =>
    s.username.toLowerCase().includes(search.toLowerCase()) ||
    (s.file_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="site-header">
        <div className="header-inner">
          <div className="logo"><span className="logo-dot" />INTERVIEWLENS</div>
          <button className="btn btn-ghost" style={{ fontSize: 14, padding: "8px 16px" }} onClick={onBack}>
            Back
          </button>
        </div>
      </header>

      <main style={{ padding: "36px 24px" }}>
        <div className="container">
          <div style={{ marginBottom: 28, display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
            <div>
              <h2 style={{ fontSize: 40, fontFamily: "var(--font-display)" }}>SESSION HISTORY</h2>
              <p style={{ color: "var(--muted)", fontSize: 13 }}>{sessions.length} interviews stored in PostgreSQL</p>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or file..."
              style={{ padding: "9px 14px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", fontFamily: "var(--font-body)", fontSize: 13, background: "var(--paper-2)", outline: "none", width: 240 }} />
          </div>

          {loading && <p style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>Loading sessions...</p>}
          {error   && <p style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{error}</p>}

          {!loading && !error && filtered.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 22, marginBottom: 8 }}>NO SESSIONS YET</p>
              <p style={{ color: "var(--muted)", fontSize: 13 }}>Run your first analysis to see results here.</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(s => (
              <div key={s.id} className="card card-sm" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 28, minWidth: 36, color: "var(--accent)" }}>
                  {s.final_score ? s.final_score.toFixed(1) : "0.0"}
                </span>
                <span className={"pill " + (gradeColor[s.grade] || "pill-gray")} style={{ fontSize: 13 }}>
                  {s.grade || "—"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{s.username}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                    {s.file_name || "—"} &nbsp;·&nbsp; {s.word_count || 0} words &nbsp;·&nbsp;
                    {new Date(s.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px", borderColor: "var(--accent)", color: "var(--accent)" }}
                  onClick={() => handleDelete(s.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
