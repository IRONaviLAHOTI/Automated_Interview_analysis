export default function VisualPanel({ result, file }) {
  const videoUrl = file && file.type && file.type.startsWith("video") ? URL.createObjectURL(file) : null;

  const metrics = [
    { label: "Blink Rate",      value: (result.blink_rate || 0) + " /min",         good: (result.blink_score || 0) === 1,    note: (result.blink_score || 0) === 1 ? "Normal range" : "Above 21/min" },
    { label: "Posture",         value: (result.posture_score || 0) === 1 ? "Good" : "Poor", good: (result.posture_score || 0) === 1, note: (result.posture_score || 0) === 1 ? "Shoulders level" : "Tilt detected" },
    { label: "Head Movement",   value: (result.head_movement_pct || 0) + "%",       good: (result.head_movement_pct || 0) < 30, note: (result.head_movement_pct || 0) < 30 ? "Facing camera" : "Frequent off-camera" },
    { label: "Phone Detection", value: result.phone_detected === 1 ? "DETECTED" : "None", good: result.phone_detected !== 1, note: result.phone_detected === 1 ? "Phone seen by YOLO" : "No phone visible" },
    { label: "Multiple People", value: result.multiple_people === 1 ? "DETECTED" : "None", good: result.multiple_people !== 1, note: result.multiple_people === 1 ? "More than one person" : "Candidate only" },
    { label: "Eye Contact Breaks", value: result.eye_contact_breaks || 0, good: (result.eye_contact_breaks || 0) === 0, note: (result.eye_contact_breaks || 0) === 0 ? "Consistent gaze" : "Gaze breaks logged" },
    { label: "Iris Deviation",  value: (result.avg_iris_deviation || 0).toFixed(3), good: (result.avg_iris_deviation || 0) < 0.30, note: (result.avg_iris_deviation || 0) < 0.30 ? "Centred" : "High deviation" },
    { label: "Arms Crossed",    value: (result.arms_crossed_pct || 0) + "%",        good: (result.arms_crossed_pct || 0) <= 50, note: (result.arms_crossed_pct || 0) > 50 ? "Defensive posture" : "Open posture" },
    { label: "Slouch %",        value: (result.slouch_pct || 0) + "%",              good: (result.slouch_pct || 0) <= 40, note: (result.slouch_pct || 0) > 40 ? "Slouching detected" : "Upright" },
  ];

  return (
    <div className="fade-up-1">
      <div style={{ marginBottom: 14, display: "flex", alignItems: "baseline", gap: 10 }}>
        <h2 style={{ fontSize: 26 }}>VISUAL</h2>
        <span className={"pill " + ((result.visual_score || 0) >= 1 ? "pill-green" : "pill-red")}>
          {result.visual_score || 0}/2
        </span>
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14 }}>MediaPipe FaceMesh · Pose · YOLOv8</p>

      {videoUrl && (
        <div style={{ marginBottom: 14, border: "1.5px solid var(--border)", borderRadius: "var(--radius)" }}>
          <video src={videoUrl} controls style={{ width: "100%", borderRadius: "var(--radius)", display: "block" }} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
    </div>
  );
}
