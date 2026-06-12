const FLAG_META = {
  PHONE_DETECTED:        { label: "Phone Detected",        severity: "critical", desc: "Cell phone visible in frame." },
  MULTIPLE_PEOPLE:       { label: "Multiple People",        severity: "critical", desc: "More than one person detected." },
  EYE_CONTACT_BREAK:     { label: "Eye Contact Break",      severity: "warning",  desc: "Sustained gaze away from camera." },
  HEAD_TURNED:           { label: "Head Turned Away",       severity: "warning",  desc: "Head turned from camera." },
  ARMS_CROSSED:          { label: "Arms Crossed",           severity: "info",     desc: "Defensive posture detected." },
  POOR_POSTURE_SUSTAINED:{ label: "Poor Posture Sustained", severity: "info",     desc: "Slouching detected across session." },
  EXCESSIVE_HEAD_MOVEMENT:{ label:"Excessive Head Movement",severity: "warning",  desc: "Head frequently turned away." },
};

const SEV_STYLE = {
  critical: { border: "var(--accent)",   bg: "#fde8e4", color: "#8c1c08"  },
  warning:  { border: "var(--warn)",     bg: "#fdf3e4", color: "#7a4a08"  },
  info:     { border: "var(--accent-2)", bg: "#e4eef9", color: "#0a3a6b"  },
};

function fmt(ts) {
  if (!ts || ts < 0) return null;
  const m = Math.floor(ts / 60);
  const s = Math.floor(ts % 60).toString().padStart(2, "0");
  return m > 0 ? m + "m " + s + "s" : s + "s";
}

export default function FlagPanel({ flags }) {
  if (!flags || flags.length === 0) {
    return (
      <div className="fade-up" style={{ marginBottom: 28 }}>
        <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 style={{ fontSize: 26 }}>FLAGS</h2>
          <span className="pill pill-green">None raised</span>
        </div>
        <div className="card card-sm" style={{ textAlign: "center", padding: "28px 20px" }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--accent-3)" }}>NO FLAGS RAISED</p>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>No integrity or behavioural issues detected.</p>
        </div>
      </div>
    );
  }

  const groups = [
    { label: "Critical",    items: flags.filter(f => (FLAG_META[f.type] || {}).severity === "critical"), pillClass: "pill-red" },
    { label: "Warnings",    items: flags.filter(f => (FLAG_META[f.type] || {}).severity === "warning"),  pillClass: "pill-amber" },
    { label: "Behavioural", items: flags.filter(f => {
      const s = (FLAG_META[f.type] || {}).severity;
      return s === "info" || !s;
    }), pillClass: "pill-blue" },
  ].filter(g => g.items.length > 0);

  return (
    <div className="fade-up" style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 14, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 26 }}>FLAGS</h2>
        <span className={flags.some(f => (FLAG_META[f.type] || {}).severity === "critical") ? "pill pill-red" : "pill pill-amber"}>
          {flags.length} raised
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {groups.map(g => (
          <div key={g.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <p className="section-eyebrow" style={{ margin: 0 }}>{g.label}</p>
              <span className={"pill " + g.pillClass} style={{ fontSize: 10 }}>{g.items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {g.items.map((flag, i) => {
                const meta = FLAG_META[flag.type] || { label: flag.type, severity: "info", desc: flag.detail || "" };
                const sty  = SEV_STYLE[meta.severity] || SEV_STYLE.info;
                const ts   = fmt(flag.timestamp_s);
                return (
                  <div key={i} className="card card-sm" style={{ borderColor: sty.border, background: sty.bg, display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: sty.color }}>{meta.label}</span>
                        {ts && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>@ {ts}</span>}
                      </div>
                      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                        {flag.detail || meta.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
