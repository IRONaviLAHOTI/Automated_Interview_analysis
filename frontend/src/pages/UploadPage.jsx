import { useState, useRef } from "react";
import axios from "axios";
import LiveAnalysis from "../components/LiveAnalysis.jsx";

const API      = "http://localhost:8000";
const ACCEPTED = [".mp4", ".mov", ".webm", ".avi", ".wav", ".mp3", ".m4a"];

export default function UploadPage({ onResult, onFile, onHistory }) {
  const [dragOver,  setDragOver]  = useState(false);
  const [fileInfo,  setFileInfo]  = useState(null);
  const [username,  setUsername]  = useState("");
  const [questions, setQuestions] = useState("");
  const [jobTitle,  setJobTitle]  = useState("");
  const [loading,   setLoading]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [stage,     setStage]     = useState("");
  const [error,     setError]     = useState(null);
  const [showLive,  setShowLive]  = useState(false);
  const inputRef = useRef();
  const fileRef  = useRef(null);

  const stages = [
    "Uploading file...",
    "Running visual analysis...",
    "Tracking iris and body language...",
    "Transcribing audio...",
    "Analysing speech metrics...",
    "Evaluating with AI...",
    "Saving to database...",
  ];

  function handleFile(f) {
    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError("Unsupported format. Accepted: " + ACCEPTED.join(", "));
      return;
    }
    setError(null);
    fileRef.current = f;
    setFileInfo({ name: f.name, size: (f.size / 1024 / 1024).toFixed(1) });
    onFile(f);
  }

  async function handleSubmit() {
    if (!fileRef.current) return;
    if (!username.trim()) { setError("Please enter your name."); return; }
    setLoading(true);
    setProgress(0);
    setStage(stages[0]);

    let idx = 0;
    const timer = setInterval(() => {
      idx = Math.min(idx + 1, stages.length - 1);
      setStage(stages[idx]);
    }, 3500);

    const fd = new FormData();
    fd.append("file",      fileRef.current);
    fd.append("username",  username.trim());
    fd.append("questions", questions);
    fd.append("job_title", jobTitle);

    try {
      const res = await axios.post(API + "/analyse", fd, {
        onUploadProgress: e => setProgress(Math.round(e.loaded * 100 / e.total)),
      });
      clearInterval(timer);
      onResult(res.data);
    } catch (err) {
      clearInterval(timer);
      setError((err.response && err.response.data && err.response.data.detail) || "Analysis failed. Is the backend running?");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {showLive && <LiveAnalysis onClose={() => setShowLive(false)} />}

      <header className="site-header">
        <div className="header-inner">
          <div className="logo"><span className="logo-dot" />INTERVIEWLENS</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn btn-ghost" style={{ fontSize: 13, padding: "8px 14px" }} onClick={onHistory}>
              History
            </button>
            <button className="btn btn-ghost" style={{ fontSize: 13, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setShowLive(true)}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
              LIVE
            </button>
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: "48px 24px" }}>
        <div className="container">
          <div className="fade-up" style={{ marginBottom: 48 }}>
            <p className="section-eyebrow">Whisper · MediaPipe · YOLOv8 · Llama 3 · PostgreSQL</p>
            <h1 style={{ fontSize: "clamp(48px,8vw,96px)", lineHeight: 0.9, marginBottom: 16 }}>
              ANALYSE<br /><span style={{ color: "var(--accent)" }}>YOUR</span><br />INTERVIEW
            </h1>
            <p style={{ fontSize: 16, color: "var(--muted)", maxWidth: 480, fontWeight: 300 }}>
              Upload a recorded interview. Get scored on visual behaviour, speech quality, and AI communication evaluation.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 28, alignItems: "start" }}>
            <div className="fade-up-1">
              <div className="card" style={{ marginBottom: 16 }}>
                <p className="section-eyebrow" style={{ marginBottom: 8 }}>Your Name (required)</p>
                <input value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Enter your name — used as session identifier"
                  style={{ width: "100%", fontFamily: "var(--font-body)", fontSize: 14, padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", background: "var(--paper-2)", outline: "none", color: "var(--ink)" }} />
              </div>

              <div className="card" style={{
                minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 16, cursor: loading ? "default" : "pointer",
                borderStyle: dragOver ? "solid" : "dashed",
                borderColor: dragOver ? "var(--accent)" : "var(--ink)",
                background: dragOver ? "var(--paper-2)" : "var(--paper)", textAlign: "center",
              }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => !loading && !fileInfo && inputRef.current && inputRef.current.click()}
              >
                <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} style={{ display: "none" }}
                  onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />

                {loading ? (
                  <>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid var(--paper-2)", borderTopColor: "var(--accent)", animation: "spin 0.8s linear infinite" }} />
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{stage}</p>
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>Upload: {progress}%</p>
                    <div style={{ width: 180 }}><div className="progress-track"><div className="progress-fill" style={{ width: progress + "%", background: "var(--accent)" }} /></div></div>
                  </>
                ) : fileInfo ? (
                  <>
                    <div style={{ fontSize: 40 }}>&#10003;</div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{fileInfo.name}</p>
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>{fileInfo.size} MB</p>
                    <button className="btn btn-ghost" style={{ fontSize: 13, padding: "6px 16px" }}
                      onClick={e => { e.stopPropagation(); setFileInfo(null); fileRef.current = null; }}>
                      x Remove
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 40 }}>&#8593;</div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>DROP YOUR FILE</p>
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>or click to browse</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                      {["MP4","MOV","WEBM","WAV","MP3","M4A"].map(f => (
                        <span key={f} className="pill pill-gray">{f}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {error && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "#fde8e4", border: "1.5px solid var(--accent)", borderRadius: "var(--radius)", fontSize: 13, color: "#8c1c08" }}>
                  {error}
                </div>
              )}

              <div className="card" style={{ marginTop: 14, background: "var(--ink)", color: "var(--paper)", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, padding: "18px 20px" }}
                onClick={() => setShowLive(true)}>
                <span style={{ fontSize: 24 }}>&#128249;</span>
                <div>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>LIVE ANALYSIS MODE</p>
                  <p style={{ fontSize: 11, color: "var(--paper-3)", fontWeight: 300 }}>Real-time iris tracking, phone and posture detection via webcam</p>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 18 }}>&#8594;</span>
              </div>
            </div>

            <div className="fade-up-2" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="card">
                <p className="section-eyebrow" style={{ marginBottom: 8 }}>Interview Questions</p>
                <textarea value={questions} onChange={e => setQuestions(e.target.value)}
                  placeholder="Tell me about yourself, What is your biggest strength..."
                  style={{ width: "100%", minHeight: 90, resize: "vertical", fontFamily: "var(--font-body)", fontSize: 13, padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", background: "var(--paper-2)", outline: "none", color: "var(--ink)" }} />
              </div>
              <div className="card">
                <p className="section-eyebrow" style={{ marginBottom: 8 }}>Job Title</p>
                <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                  placeholder="e.g. Software Engineer, Product Manager"
                  style={{ width: "100%", fontFamily: "var(--font-body)", fontSize: 13, padding: "10px 12px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", background: "var(--paper-2)", outline: "none", color: "var(--ink)" }} />
              </div>
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 20 }}
                onClick={handleSubmit} disabled={!fileInfo || loading}>
                {loading ? "ANALYSING..." : "RUN ANALYSIS"}
              </button>
              <div className="card card-sm" style={{ background: "var(--ink)", color: "var(--paper)" }}>
                <p className="section-eyebrow" style={{ color: "var(--paper-3)", marginBottom: 8 }}>What we analyse</p>
                {[
                  ["Blink rate and iris tracking"],
                  ["Posture, slouch and arms crossed"],
                  ["Phone detection via YOLO"],
                  ["Multi-person detection"],
                  ["Pitch, Volume and Speech rate"],
                  ["Full transcript via Whisper"],
                  ["AI evaluation via Llama 3"],
                  ["Saved to PostgreSQL"],
                ].map(([l]) => (
                  <div key={l} style={{ marginBottom: 5, fontSize: 12, color: "var(--paper-3)" }}>{l}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
