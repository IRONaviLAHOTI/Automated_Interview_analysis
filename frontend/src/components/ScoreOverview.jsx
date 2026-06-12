import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

export default function ScoreOverview({ result }) {
  const total   = result.final_score || 0;
  const pct     = (total / 10) * 100;
  const r       = 66;
  const circ    = 2 * Math.PI * r;
  const offset  = circ * (1 - pct / 100);

  const radarData = [
    { subject: "Blink",   value: (result.blink_score || 0) * 100 },
    { subject: "Posture", value: (result.posture_score || 0) * 100 },
    { subject: "Pitch",   value: (result.pitch_score || 0) * 100 },
    { subject: "Volume",  value: (result.volume_score || 0) * 100 },
    { subject: "Speech",  value: (result.rate_score || 0) * 100 },
    { subject: "AI Eval", value: ((result.communication_score || 0) / 5) * 100 },
  ];

  const gradeColor = { A: "var(--accent-3)", B: "var(--accent-3)", C: "var(--warn)", D: "var(--accent)", F: "var(--accent)" };

  return (
    <div className="fade-up" style={{ marginBottom: 32 }}>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 32, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r={r} fill="none" stroke="var(--paper-2)" strokeWidth="12" />
            <circle cx="80" cy="80" r={r} fill="none" stroke={gradeColor[result.grade] || "var(--muted)"}
              strokeWidth="12" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
              transform="rotate(-90 80 80)"
              style={{ transition: "stroke-dashoffset 1s ease" }} />
            <text x="80" y="72" textAnchor="middle" fontFamily="var(--font-display)" fontSize="36" fill="var(--ink)">
              {total.toFixed(1)}
            </text>
            <text x="80" y="92" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--muted)">
              OUT OF 10
            </text>
          </svg>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 32, color: gradeColor[result.grade] }}>
            GRADE {result.grade || "—"}
          </span>
        </div>

        <div>
          <p className="section-eyebrow" style={{ marginBottom: 12 }}>Score Breakdown</p>
          {[
            { label: "Visual Score",        val: result.visual_score || 0,        max: 2 },
            { label: "Confidence Score",    val: result.confidence_score || 0,    max: 3 },
            { label: "Communication Score", val: result.communication_score || 0, max: 5 },
          ].map(({ label, val, max }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{typeof val === "number" ? val.toFixed ? val.toFixed(1) : val : 0} / {max}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: ((val / max) * 100) + "%" }} />
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            {result.phone_detected === 1    && <span className="pill pill-red">Phone detected</span>}
            {result.multiple_people === 1   && <span className="pill pill-red">Multiple people</span>}
            {(result.eye_contact_breaks || 0) > 0 && <span className="pill pill-amber">{result.eye_contact_breaks} gaze break{result.eye_contact_breaks > 1 ? "s" : ""}</span>}
            {(result.arms_crossed_pct || 0) > 50   && <span className="pill pill-amber">Arms crossed</span>}
            {result.plagiarism_status === "likely_copied" && <span className="pill pill-red">Likely copied</span>}
            {result.plagiarism_status === "original"      && <span className="pill pill-green">Original answer</span>}
            {result.llama_available   && <span className="pill pill-blue">AI evaluated</span>}
          </div>
        </div>

        <div style={{ width: 200, height: 200 }}>
          <p className="section-eyebrow" style={{ marginBottom: 6, textAlign: "center" }}>Performance Radar</p>
          <ResponsiveContainer width="100%" height="85%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--muted)" }} />
              <Radar dataKey="value" stroke="var(--ink)" fill="var(--ink)" fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
