import { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";

const WS_URL         = "ws://localhost:8000/live";
const API_URL        = "http://localhost:8000";
const FRAME_INTERVAL = 500;

const FLAG_CONFIG = {
  PHONE_DETECTED:    { label: "Phone Detected",    color: "#c8381a" },
  MULTIPLE_PEOPLE:   { label: "Multiple People",   color: "#c8381a" },
  EYE_CONTACT_BREAK: { label: "Eye Contact Break", color: "#d4821a" },
  HEAD_TURNED:       { label: "Head Turned",        color: "#d4821a" },
  ARMS_CROSSED:      { label: "Arms Crossed",       color: "#1a6bc8" },
  POOR_POSTURE:      { label: "Poor Posture",       color: "#1a6bc8" },
};

export default function LiveAnalysis({ onClose }) {
  const videoRef       = useRef(null);
  const canvasRef      = useRef(null);
  const wsRef          = useRef(null);
  const timerRef       = useRef(null);
  const mediaRecRef    = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const volumeTimerRef = useRef(null);
  const audioCtxRef    = useRef(null);
  const analyserRef    = useRef(null);

  const [camState,    setCamState]    = useState("idle");
  const [camError,    setCamError]    = useState(null);
  const [wsState,     setWsState]     = useState("closed");
  const [liveData,    setLiveData]    = useState(null);
  const [flagHistory, setFlagHistory] = useState([]);
  const [transcript,  setTranscript]  = useState("");
  const [interimText, setInterimText] = useState("");
  const [speechOk,    setSpeechOk]    = useState(true);
  const [audioResult, setAudioResult] = useState(null);
  const [audioLoad,   setAudioLoad]   = useState(false);
  const [liveVolume,  setLiveVolume]  = useState(0);
  const [sideTab,     setSideTab]     = useState("flags");

  const initSpeech = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSpeechOk(false); return null; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = (evt) => {
      let interim = "", final = "";
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const t = evt.results[i][0].transcript;
        if (evt.results[i].isFinal) final += t + " "; else interim += t;
      }
      if (final) setTranscript(prev => prev + final);
      setInterimText(interim);
    };
    rec.onerror = (e) => { if (e.error !== "no-speech") console.warn("SR:", e.error); };
    rec.onend = () => { if (recognitionRef.current === rec) { try { rec.start(); } catch(_){} } };
    return rec;
  }, []);

  const initVolume = useCallback((stream) => {
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an  = ctx.createAnalyser(); an.fftSize = 256;
      src.connect(an);
      audioCtxRef.current = ctx; analyserRef.current = an;
      const data = new Uint8Array(an.frequencyBinCount);
      volumeTimerRef.current = setInterval(() => {
        an.getByteFrequencyData(data);
        setLiveVolume(Math.round((data.reduce((a,b)=>a+b,0)/data.length/255)*100));
      }, 200);
    } catch(_) {}
  }, []);

  const start = useCallback(async () => {
    setCamState("starting"); setCamError(null);
    setTranscript(""); setInterimText(""); setAudioResult(null);
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360, facingMode: "user" }, audio: true });
      videoRef.current.srcObject = stream; videoRef.current.muted = true;
      await videoRef.current.play();
      setCamState("running");

      setWsState("connecting");
      const ws = new WebSocket(WS_URL);
      ws.binaryType = "arraybuffer"; wsRef.current = ws;
      ws.onopen  = () => setWsState("open");
      ws.onerror = () => setWsState("error");
      ws.onclose = () => setWsState("closed");
      ws.onmessage = (evt) => {
        try {
          const d = JSON.parse(evt.data); setLiveData(d);
          if (d.flags && d.flags.length > 0) {
            setFlagHistory(prev => [{ flags: d.flags, time: new Date().toLocaleTimeString() }, ...prev.slice(0,19)]);
          }
        } catch(_) {}
      };

      timerRef.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const v = videoRef.current; const c = canvasRef.current;
        if (!v || !c || v.readyState < 2) return;
        c.width = 640; c.height = 360;
        c.getContext("2d").drawImage(v, 0, 0, 640, 360);
        c.toBlob(blob => blob && ws.send(blob), "image/jpeg", 0.7);
      }, FRAME_INTERVAL);

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(1000); mediaRecRef.current = mr;

      const rec = initSpeech();
      if (rec) { recognitionRef.current = rec; try { rec.start(); } catch(_){} }
      initVolume(stream);
    } catch (err) {
      setCamState("error"); setCamError(err.message || "Camera/microphone access denied");
    }
  }, [initSpeech, initVolume]);

  const stop = useCallback(() => {
    clearInterval(timerRef.current); clearInterval(volumeTimerRef.current);
    if (wsRef.current) wsRef.current.close();
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch(_) {}
      recognitionRef.current = null;
    }
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    analyserRef.current = null;

    if (mediaRecRef.current && mediaRecRef.current.state !== "inactive") {
      mediaRecRef.current.onstop = async () => {
        const chunks = audioChunksRef.current;
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioLoad(true); setSideTab("audio");
        try {
          const fd = new FormData(); fd.append("file", blob, "session.webm");
          const res = await axios.post(API_URL + "/analyse/audio", fd);
          setAudioResult(res.data);
        } catch (err) { setAudioResult({ error: err.message }); }
        finally { setAudioLoad(false); }
      };
      mediaRecRef.current.stop();
    }

    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCamState("idle"); setWsState("closed"); setLiveData(null); setLiveVolume(0); setInterimText("");
  }, []);

  useEffect(() => () => stop(), [stop]);

  const activeFlags = (liveData && liveData.flags) || [];
  const irisOk      = liveData ? liveData.iris_deviation < 0.30 : null;
  const personCount = (liveData && liveData.person_count) || 0;
  const fullTx      = transcript + interimText;
  const wordCount   = transcript.trim().split(/\s+/).filter(Boolean).length;
  const wsColor     = { open: "var(--accent-3)", connecting: "var(--warn)", error: "var(--accent)", closed: "var(--muted)" }[wsState];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.85)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--paper)", borderRadius: "var(--radius-lg)", border: "2px solid var(--ink)", width: "100%", maxWidth: 1040, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "2px solid var(--ink)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: camState === "running" ? "var(--accent-3)" : "var(--muted)", display: "inline-block" }} />
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>LIVE ANALYSIS</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: wsColor }}>WS: {wsState}</span>
            {camState === "running" && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>{wordCount} words</span>}
          </div>
          <button className="btn btn-ghost" style={{ fontSize: 13, padding: "7px 16px" }} onClick={() => { stop(); onClose(); }}>Close</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", flex: 1 }}>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ position: "relative", borderRadius: "var(--radius)", overflow: "hidden", border: "2px solid var(--ink)", background: "#111", aspectRatio: "16/9" }}>
              <video ref={videoRef} muted playsInline style={{ width: "100%", display: "block", objectFit: "cover" }} />
              <canvas ref={canvasRef} style={{ display: "none" }} />

              {activeFlags.length > 0 && (
                <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {activeFlags.map((f, i) => {
                    const cfg = FLAG_CONFIG[f] || { label: f, color: "#c8381a" };
                    return <span key={i} style={{ background: cfg.color, color: "#fff", fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 8px", borderRadius: 3, fontWeight: 600 }}>{cfg.label}</span>;
                  })}
                </div>
              )}

              {liveData && (
                <div style={{ position: "absolute", bottom: 10, left: 10, background: "rgba(10,10,10,0.75)", borderRadius: 3, padding: "5px 8px", fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff", display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ color: irisOk ? "#4caf50" : "#f44336" }}>Iris: {liveData.iris_deviation && liveData.iris_deviation.toFixed(3)} {irisOk ? "OK" : "Break"}</span>
                  <span>EAR: {liveData.ear && liveData.ear.toFixed(3)}</span>
                  <span>People: {personCount}</span>
                </div>
              )}

              {camState === "running" && (
                <div style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(10,10,10,0.75)", borderRadius: 3, padding: "5px 8px", fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff", display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                  <span>Vol: {liveVolume}%</span>
                  <div style={{ width: 50, height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 2 }}>
                    <div style={{ width: liveVolume + "%", height: "100%", background: liveVolume > 20 ? "#4caf50" : "#f44336", borderRadius: 2, transition: "width 0.2s" }} />
                  </div>
                </div>
              )}

              {camState === "idle" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#fff" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>CAMERA OFF</p>
                </div>
              )}
              {camState === "error" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "#f44336" }}>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>ERROR</p>
                  <p style={{ fontSize: 11, color: "#ccc", textAlign: "center", maxWidth: 240 }}>{camError}</p>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {camState !== "running" ? (
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={start} disabled={camState === "starting"}>
                  {camState === "starting" ? "STARTING..." : "START LIVE ANALYSIS"}
                </button>
              ) : (
                <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={stop}>
                  STOP AND ANALYSE
                </button>
              )}
            </div>

            <div className="card" style={{ background: "var(--paper-2)", minHeight: 100 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p className="section-eyebrow" style={{ margin: 0 }}>Live Transcript</p>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {camState === "running" && speechOk && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />}
                  {transcript && <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => { setTranscript(""); setInterimText(""); }}>Clear</button>}
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.8, maxHeight: 120, overflowY: "auto" }}>
                {fullTx ? (
                  <><span>{transcript}</span><span style={{ color: "var(--muted)" }}>{interimText}</span></>
                ) : (
                  <span style={{ color: "var(--muted)" }}>{camState === "running" ? (speechOk ? "Listening..." : "Start session to transcribe") : "Transcript will appear here"}</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ borderLeft: "2px solid var(--ink)", display: "flex", flexDirection: "column", maxHeight: "calc(92vh - 60px)", overflow: "hidden" }}>
            <div style={{ display: "flex", borderBottom: "1.5px solid var(--border)" }}>
              {[["flags","Flags"],["transcript","Transcript"],["audio","Audio"]].map(([key,label]) => (
                <button key={key} onClick={() => setSideTab(key)} style={{ flex: 1, padding: "9px 4px", border: "none", cursor: "pointer", background: sideTab === key ? "var(--ink)" : "transparent", color: sideTab === key ? "var(--paper)" : "var(--muted)", fontFamily: "var(--font-display)", fontSize: 12 }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {sideTab === "flags" && (
                <>
                  {liveData && [
                    { label: "Eye Contact", value: irisOk ? "Good" : "Break", good: irisOk, detail: "Dev: " + (liveData.iris_deviation || 0).toFixed(3) },
                    { label: "Volume",      value: liveVolume > 20 ? "Good" : "Low", good: liveVolume > 20, detail: liveVolume + "%" },
                    { label: "People",      value: personCount === 1 ? "1 (OK)" : String(personCount), good: personCount === 1, detail: personCount > 1 ? "Multiple detected" : "Candidate only" },
                    { label: "Phone",       value: liveData.phone_detected ? "DETECTED" : "Clear", good: !liveData.phone_detected, detail: liveData.phone_detected ? "Device in frame" : "None visible" },
                    { label: "Arms",        value: liveData.arms_crossed ? "Crossed" : "Open",    good: !liveData.arms_crossed,   detail: liveData.arms_crossed ? "Defensive posture" : "Relaxed" },
                    { label: "Posture",     value: liveData.slouching ? "Poor" : "Good",           good: !liveData.slouching,      detail: liveData.slouching ? "Slouching" : "Upright" },
                  ].map(m => (
                    <div key={m.label} className="card card-sm" style={{ borderColor: m.good ? "var(--border)" : "var(--accent)", padding: "7px 10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "var(--font-display)", fontSize: 12 }}>{m.label}</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: m.good ? "var(--accent-3)" : "var(--accent)", fontWeight: 600 }}>{m.value}</span>
                      </div>
                      <p style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: 1 }}>{m.detail}</p>
                    </div>
                  ))}
                  {flagHistory.length > 0 && (
                    <>
                      <p className="section-eyebrow" style={{ marginTop: 4 }}>Event Log</p>
                      {flagHistory.map((e, i) => (
                        <div key={i} style={{ padding: "5px 9px", background: i === 0 ? "var(--ink)" : "var(--paper-2)", color: i === 0 ? "var(--paper)" : "var(--ink)", borderRadius: "var(--radius)", fontSize: 10, fontFamily: "var(--font-mono)" }}>
                          <div style={{ color: i === 0 ? "var(--paper-3)" : "var(--muted)", marginBottom: 2 }}>{e.time}</div>
                          {e.flags.map((f, j) => <div key={j}>{(FLAG_CONFIG[f] || { label: f }).label}</div>)}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              {sideTab === "transcript" && (
                <>
                  <p className="section-eyebrow">Live Transcript ({wordCount} words)</p>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.9, background: "var(--paper-2)", padding: 10, borderRadius: "var(--radius)", flex: 1, minHeight: 200 }}>
                    {fullTx ? (<><span>{transcript}</span><span style={{ color: "var(--muted)", fontStyle: "italic" }}>{interimText}</span></>) : (
                      <span style={{ color: "var(--muted)" }}>{camState === "running" ? "Listening..." : "Start session to see transcript"}</span>
                    )}
                  </div>
                  {transcript && (
                    <button className="btn btn-ghost" style={{ fontSize: 11, justifyContent: "center" }}
                      onClick={() => navigator.clipboard && navigator.clipboard.writeText(transcript)}>
                      Copy transcript
                    </button>
                  )}
                </>
              )}

              {sideTab === "audio" && (
                <>
                  {audioLoad && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 20, color: "var(--muted)" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--paper-2)", borderTopColor: "var(--accent)", animation: "spin 0.8s linear infinite" }} />
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>ANALYSING AUDIO...</p>
                    </div>
                  )}
                  {audioResult && !audioLoad && (
                    audioResult.error ? (
                      <div className="card card-sm" style={{ borderColor: "var(--accent)", background: "#fde8e4" }}>
                        <p style={{ fontSize: 11, color: "#8c1c08", fontFamily: "var(--font-mono)" }}>{audioResult.error}</p>
                      </div>
                    ) : (
                      <>
                        <p className="section-eyebrow">Post-Session Analysis</p>
                        {[
                          { label: "Words",       value: (audioResult.word_count || 0) + " words",      good: (audioResult.word_count || 0) > 30 },
                          { label: "Speech Rate", value: Math.round(audioResult.speech_rate_wpm || 0) + " WPM", good: (audioResult.rate_score || 0) === 1 },
                          { label: "Avg Pitch",   value: Math.round(audioResult.avg_pitch || 0) + " Hz",       good: (audioResult.pitch_score || 0) === 1 },
                          { label: "Plagiarism",  value: audioResult.plagiarism_status || "—",                 good: audioResult.plagiarism_status === "original" },
                          { label: "Comm Score",  value: (audioResult.communication_score || 0) + " / 5",      good: (audioResult.communication_score || 0) >= 3 },
                        ].map(m => (
                          <div key={m.label} className="card card-sm" style={{ borderColor: m.good ? "var(--border)" : "var(--accent)", padding: "7px 10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <span style={{ fontFamily: "var(--font-display)", fontSize: 12 }}>{m.label}</span>
                              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: m.good ? "var(--accent-3)" : "var(--accent)", fontWeight: 600 }}>{m.value}</span>
                            </div>
                          </div>
                        ))}
                        {audioResult.transcript && (
                          <>
                            <p className="section-eyebrow">Whisper Transcript</p>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.8, background: "var(--paper-2)", padding: 8, borderRadius: "var(--radius)", maxHeight: 120, overflowY: "auto" }}>
                              {audioResult.transcript}
                            </div>
                          </>
                        )}
                      </>
                    )
                  )}
                  {!audioResult && !audioLoad && (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--muted)", textAlign: "center", gap: 8, padding: 20 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>NO AUDIO YET</p>
                      <p style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>Stop the session to trigger full audio analysis.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
