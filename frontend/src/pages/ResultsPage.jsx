import ScoreOverview   from "../components/ScoreOverview.jsx";
import VisualPanel     from "../components/VisualPanel.jsx";
import AudioPanel      from "../components/AudioPanel.jsx";
import PlagiarismPanel from "../components/PlagiarismPanel.jsx";
import FlagPanel       from "../components/FlagPanel.jsx";

export default function ResultsPage({ result, file, onReset }) {
  const totalFlags    = (result.flags || []).length;
  const criticalFlags = (result.flags || []).filter(f =>
    f.type === "PHONE_DETECTED" || f.type === "MULTIPLE_PEOPLE"
  ).length;

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="site-header">
        <div className="header-inner">
          <div className="logo"><span className="logo-dot" />INTERVIEWLENS</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="pill pill-green">Analysis complete</span>
            {criticalFlags > 0 && <span className="pill pill-red">{criticalFlags} critical flag{criticalFlags > 1 ? "s" : ""}</span>}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
              {result.processing_time_s}s
            </span>
            <button className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 14 }} onClick={onReset}>
              New Analysis
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: "36px 24px" }}>
        <div className="container">
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 18px", background: "var(--ink)", borderRadius: "var(--radius)", marginBottom: 32, color: "var(--paper)", fontFamily: "var(--font-mono)", fontSize: 12, flexWrap: "wrap" }}>
            <span>{result.file_type === "video" ? "Video" : "Audio"}</span>
            <span>{result.file_name}</span>
            <span style={{ color: "var(--paper-3)" }}>Session saved for: {result.username}</span>
            <span style={{ marginLeft: "auto", color: "var(--paper-3)" }}>{result.word_count} words</span>
            {totalFlags > 0 && <span style={{ color: "#f4a261" }}>{totalFlags} flag{totalFlags > 1 ? "s" : ""} raised</span>}
          </div>

          <ScoreOverview result={result} />
          <hr className="divider" style={{ margin: "36px 0" }} />
          <FlagPanel flags={result.flags || []} />
          <hr className="divider" style={{ margin: "36px 0" }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 22 }}>
            <VisualPanel    result={result} file={file} />
            <AudioPanel     result={result} />
            <PlagiarismPanel result={result} />
          </div>

          {result.transcript && (
            <>
              <hr className="divider" style={{ margin: "36px 0" }} />
              <div className="fade-up">
                <p className="section-eyebrow" style={{ marginBottom: 10 }}>Full Transcript</p>
                <div className="card" style={{ background: "var(--paper-2)" }}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                    {result.transcript}
                  </p>
                  <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="pill pill-blue">Language: {(result.language || "en").toUpperCase()}</span>
                    <span className="pill pill-gray">{result.word_count} words</span>
                    <span className="pill pill-gray">{Math.round(result.speech_rate_wpm || 0)} WPM</span>
                    {result.plagiarism_status && (
                      <span className={"pill " + (result.plagiarism_status === "original" ? "pill-green" : "pill-amber")}>
                        {result.plagiarism_status.replace("_", " ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
