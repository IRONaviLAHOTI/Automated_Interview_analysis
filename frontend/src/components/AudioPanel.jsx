import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function AudioPanel({ result }) {
  const pitchData  = (result.pitch_over_time  || []).map((v, i) => ({ i, v: Math.round(v) }));
  const volumeData = (result.volume_over_time || []).map((v, i) => ({ i, v: parseFloat(v.toFixed(4)) }));

  const metrics = [
    { label: "Avg Pitch",    value: Math.round(result.avg_pitch || 0) + " Hz",      good: (result.pitch_score  || 0) === 1, note: "85–255 Hz normal" },
    { label: "Avg Volume",   value: (result.avg_volume || 0).toFixed(4),             good: (result.volume_score || 0) === 1, note: "RMS energy" },
    { label: "Speech Rate",  value: Math.round(result.speech_rate_wpm || 0) + " WPM", good: (result.rate_score || 0) === 1,  note: "130–170 WPM ideal" },
    { label: "Word Count",   value: result.word_count || 0,                           good: (result.word_count || 0) >= 50,  note: "Total transcribed" },
    { label: "Volume Stability", value: (result.volume_stability || 0).toFixed(4),   good: (result.volume_stability || 0) < 0.05, note: "Low = consistent" },
    { label: "Language",     value: (result.language || "en").toUpperCase(),          good: true, note: "Auto-detected" },
  ];

  return (
    <div className="fade-up-1">
      <div style={{ marginBottom: 14, display: "flex", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ fontSize: 26 }}>AUDIO</h2>
        <span className={"pill " + ((result.confidence_score || 0) >= 2 ? "pill-green" : "pill-amber")}>
          {result.confidence_score || 0}/3
        </span>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>Whisper · Librosa · pyin</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {metrics.map(m => (
          <div key={m.label} className="card card-sm" style={{ borderColor: m.good ? "var(--border)" : "var(--accent)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>{m.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: m.good ? "var(--accent-3)" : "var(--accent)" }}>
                {String(m.value)}
              </span>
            </div>
            <p style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>{m.note}</p>
          </div>
        ))}
      </div>

      {pitchData.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p className="section-eyebrow" style={{ marginBottom: 6 }}>Pitch Over Time (Hz)</p>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={pitchData}>
              <XAxis dataKey="i" hide />
              <YAxis domain={["auto", "auto"]} hide />
              <Tooltip formatter={v => [v + " Hz", "Pitch"]} contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
              <Line type="monotone" dataKey="v" stroke="var(--ink)" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {volumeData.length > 0 && (
        <div>
          <p className="section-eyebrow" style={{ marginBottom: 6 }}>Volume Over Time (RMS)</p>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={volumeData}>
              <XAxis dataKey="i" hide />
              <YAxis domain={[0, "auto"]} hide />
              <Tooltip formatter={v => [v, "RMS"]} contentStyle={{ fontFamily: "var(--font-mono)", fontSize: 11 }} />
              <Line type="monotone" dataKey="v" stroke="var(--accent-2)" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
