import React, { useEffect, useRef, useState } from "react";

/**
 * Dashcam Vision dashboard
 * - Video feed (pass `videoSrc`, or set `useWebcam` to stream from a camera)
 * - Weather chip + fps chip on the feed
 * - Right panel: driver speed, road conditions, stop signs missed, close calls
 *
 * AI overlays and trip events are intentionally not included yet.
 * All panel data comes in through props so you can wire it up later.
 */

const DEFAULTS = {
  trip: { camera: "Front camera", date: "2024-11-02", time: "08:54" },
  weather: { temp: -2, summary: "Partly cloudy", note: "Low sun · glare risk · Black ice possible" },
  fps: 30,
  latencyMs: 12,
  speed: {
    current: 0,
    limit: 30,
    avg: 24,
    max: 36,
    overLimit: "1:12",
    history: [18, 22, 25, 21, 28, 30, 26, 22, 24, 31, 27, 20, 23, 29, 34, 28, 22, 18, 24, 26],
  },
  road: [
    { label: "Surface", value: "Wet asphalt" },
    { label: "Shoulders", value: "Snow cover" },
    { label: "Traction", value: "Moderate", tone: "warn" },
    { label: "Visibility", value: "Good", tone: "good" },
    { label: "Lane markings", value: "Faded · none" },
  ],
  stopSigns: {
    missed: 1,
    total: 14,
    fullStops: 13,
    compliance: 93,
    events: [{ time: "08:51", label: "Rolling stop", detail: "11 km/h" }],
  },
  closeCalls: {
    count: 2,
    events: [
      { time: "08:47", label: "Cyclist · 1.2 m", detail: "TTC 1.4 s" },
      { time: "08:52", label: "Vehicle cut-in", detail: "TTC 0.9 s" },
    ],
  },
};

const css = `
.dv-root{--bg:#0b1118;--panel:#111a24;--panel-2:#0e161f;--line:#1f2b38;--text:#e6edf3;--muted:#8a99a8;
  --accent:#2f81f7;--good:#3fb950;--warn:#f0a020;--bad:#f85149;--teal:#4cc9c0;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--bg);color:var(--text);
  display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px;padding:12px;min-height:100vh;box-sizing:border-box}
.dv-root *{box-sizing:border-box}
.dv-main{border:1px solid var(--accent);border-radius:6px;background:var(--panel-2);display:flex;flex-direction:column;overflow:hidden}
.dv-header{display:flex;align-items:center;gap:12px;padding:10px 14px}
.dv-logo{width:28px;height:28px;border:1.5px solid var(--teal);border-radius:6px;display:grid;place-items:center;color:var(--teal)}
.dv-title{font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-weight:700;font-size:18px;line-height:1.1}
.dv-sub{font-size:11px;color:var(--muted);margin-top:2px}
.dv-live{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--bad);
  background:rgba(248,81,73,.12);border:1px solid rgba(248,81,73,.35);padding:3px 8px;border-radius:4px;margin-left:8px}
.dv-live i{width:7px;height:7px;border-radius:50%;background:var(--bad);animation:dv-pulse 1.4s infinite}
@keyframes dv-pulse{50%{opacity:.3}}
.dv-feed{position:relative;flex:1;min-height:360px;background:#000;margin:0 12px 12px;border-radius:4px;overflow:hidden}
.dv-feed video{width:100%;height:100%;object-fit:cover;display:block}
.dv-empty{position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-size:13px;text-align:center;padding:16px}
.dv-chip{position:absolute;background:rgba(11,17,24,.78);border:1px solid var(--line);border-radius:6px;backdrop-filter:blur(4px)}
.dv-weather{top:10px;left:10px;padding:8px 12px;display:flex;gap:10px;align-items:center}
.dv-weather b{font-family:system-ui,sans-serif;font-size:14px;font-weight:600}
.dv-weather small{display:block;font-size:10px;color:var(--muted);margin-top:2px}
.dv-fps{top:10px;right:10px;padding:4px 8px;font-size:11px;color:var(--muted)}
.dv-side{display:flex;flex-direction:column;gap:12px}
.dv-card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:14px}
.dv-card h3{margin:0 0 12px;font-size:11px;letter-spacing:.08em;color:var(--muted);font-weight:500;text-transform:uppercase}
.dv-speed-top{display:flex;justify-content:space-between;align-items:flex-start}
.dv-speed-num{font-family:system-ui,sans-serif;font-size:44px;font-weight:700;line-height:1}
.dv-speed-num span{font-size:12px;color:var(--muted);font-weight:400;margin-left:6px}
.dv-limit{width:44px;height:44px;border-radius:50%;background:#fff;border:5px solid #d7263d;color:#111;
  display:grid;place-items:center;font-family:system-ui,sans-serif;font-weight:800;font-size:16px}
.dv-speed-foot{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px}
.dv-speed-foot .over{color:var(--warn)}
.dv-rows{display:flex;flex-direction:column;gap:9px}
.dv-row{display:flex;justify-content:space-between;font-size:12px}
.dv-row span:first-child{color:var(--muted)}
.dv-row .warn{color:var(--warn)}.dv-row .good{color:var(--good)}
.dv-head{display:flex;justify-content:space-between;align-items:baseline}
.dv-head small{font-size:10px;color:var(--muted)}
.dv-stat{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.dv-stat b{font-family:system-ui,sans-serif;font-size:30px;font-weight:700;line-height:1}
.dv-stat p{margin:0;font-size:11px;color:var(--muted)}
.dv-ev{display:flex;justify-content:space-between;font-size:11px;background:var(--panel-2);border:1px solid var(--line);
  border-radius:4px;padding:7px 9px;margin-top:6px}
.dv-ev time{margin-right:8px}
.dv-perm{display:flex;flex-direction:column;align-items:center;gap:10px;max-width:320px}
.dv-perm svg{width:32px;height:32px;color:var(--teal)}
.dv-perm p{margin:0;color:var(--text)}
.dv-perm small{font-size:11px;color:var(--muted)}
.dv-btn{font:inherit;font-size:12px;font-weight:600;color:#fff;background:var(--accent);border:0;border-radius:4px;
  padding:8px 14px;cursor:pointer}
.dv-btn:hover{filter:brightness(1.1)}
.dv-btn:focus-visible{outline:2px solid var(--teal);outline-offset:2px}
@media (max-width:900px){.dv-root{grid-template-columns:1fr}}
`;

function Sparkline({ data, width = 270, height = 40, color = "var(--teal)" }) {
  if (!data?.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - 4 - ((v - min) / range) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CloudSunIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f5c542" strokeWidth="1.6">
      <circle cx="9" cy="8" r="3" />
      <path d="M9 2v1.5M3 8h1.5M4.8 3.8l1 1M13.2 3.8l-1 1" />
      <path d="M8 19h9a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.5A2.8 2.8 0 0 0 8 19z" stroke="#cfd8e3" fill="#0b1118" />
    </svg>
  );
}

/**
 * Camera permission states:
 *  "checking"    – reading current permission on mount
 *  "prompt"      – not decided yet → show "Allow camera" button
 *  "requesting"  – browser permission dialog is open
 *  "granted"     – stream is live
 *  "denied"      – user (or browser policy) blocked the camera
 *  "unsupported" – no getUserMedia (old browser or non-HTTPS page)
 *  "error"       – no camera found, camera busy, etc.
 */
function useCameraPermission(enabled) {
  const [status, setStatus] = useState("checking");
  const [error, setError] = useState(null);
  const [stream, setStream] = useState(null);
  const streamRef = useRef(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  };

  const request = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { ideal: "environment" }, // rear camera on phones
        audio: false,
      });
      stop();
      streamRef.current = s;
      setStream(s);
      setStatus("granted");
    } catch (e) {
      if (e.name === "NotAllowedError" || e.name === "SecurityError") {
        setStatus("denied");
      } else {
        setStatus("error");
        setError(
          e.name === "NotFoundError"
            ? "No camera found on this device"
            : e.name === "NotReadableError"
            ? "Camera is in use by another app"
            : e.message || "Camera unavailable"
        );
      }
    }
  };

  // On mount: ask for the camera straight away (opens the browser's permission prompt),
  // unless the user has already blocked it.
  useEffect(() => {
    if (!enabled) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    // Page embedded in an iframe without allow="camera" → browser never shows a prompt.
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (policy?.allowsFeature && !policy.allowsFeature("camera")) {
      setStatus("error");
      setError('This page is inside a frame that blocks the camera. Open it in its own tab, or add allow="camera" to the iframe.');
      return;
    }
    let cancelled = false;
    let permStatus;
    const onChange = () => {
      if (permStatus.state === "denied") { stop(); setStatus("denied"); }
      else if (permStatus.state === "prompt") { stop(); setStatus("prompt"); }
    };
    if (!navigator.permissions?.query) {
      request();
    } else {
      navigator.permissions
        .query({ name: "camera" })
        .then((p) => {
          if (cancelled) return;
          permStatus = p;
          p.addEventListener("change", onChange);
          if (p.state === "denied") setStatus("denied");
          else request(); // "prompt" → browser shows its permission popup; "granted" → starts immediately
        })
        .catch(() => !cancelled && request()); // some browsers don't support querying "camera"
    }
    return () => {
      cancelled = true;
      permStatus?.removeEventListener("change", onChange);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { status, error, stream, request };
}

function VideoFeed({ videoSrc, useWebcam }) {
  const ref = useRef(null);
  const cam = useCameraPermission(useWebcam);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = cam.stream;
  }, [cam.stream]);

  if (useWebcam) {
    return (
      <>
        <video ref={ref} autoPlay muted playsInline />
        {cam.status !== "granted" && (
          <div className="dv-empty">
            <CameraPrompt {...cam} />
          </div>
        )}
      </>
    );
  }

  return videoSrc ? (
    <video src={videoSrc} autoPlay muted loop playsInline />
  ) : (
    <div className="dv-empty">No video source connected</div>
  );
}

function CameraPrompt({ status, error, request }) {
  switch (status) {
    case "checking":
      return <p>Checking camera access…</p>;
    case "prompt":
      return (
        <div className="dv-perm">
          <CameraIcon />
          <p>Dashcam Vision needs your camera to show the live road feed.</p>
          <button className="dv-btn" onClick={request}>Allow camera access</button>
          <small>Video stays on this device.</small>
        </div>
      );
    case "requesting":
      return <p>Waiting for permission… check your browser's prompt.</p>;
    case "denied":
      return (
        <div className="dv-perm">
          <p>Camera access is blocked.</p>
          <small>
            Click the camera or lock icon in the address bar, set Camera to "Allow", then retry.
          </small>
          <button className="dv-btn" onClick={request}>Try again</button>
        </div>
      );
    case "unsupported":
      return (
        <div className="dv-perm">
          <p>Camera isn't available here.</p>
          <small>Open the dashboard over HTTPS (or localhost) in a recent browser.</small>
        </div>
      );
    default:
      return (
        <div className="dv-perm">
          <p>Camera error: {error}</p>
          <button className="dv-btn" onClick={request}>Retry</button>
        </div>
      );
  }
}

export default function DashcamVision({
  videoSrc,
  useWebcam = !videoSrc, // no video file passed → use the webcam
  live = true,
  trip = DEFAULTS.trip,
  weather = DEFAULTS.weather,
  fps = DEFAULTS.fps,
  latencyMs = DEFAULTS.latencyMs,
  speed = DEFAULTS.speed,
  road = DEFAULTS.road,
  stopSigns = DEFAULTS.stopSigns,
  closeCalls = DEFAULTS.closeCalls,
}) {
  return (
    <div className="dv-root">
      <style>{css}</style>

      {/* Main feed */}
      <section className="dv-main">
        <header className="dv-header">
          <div className="dv-logo"><CameraIcon /></div>
          <div>
            <div className="dv-title">Dashcam Vision</div>
            <div className="dv-sub">{trip.camera} · Trip {trip.date} · {trip.time}</div>
          </div>
          {live && <div className="dv-live"><i />LIVE</div>}
        </header>

        <div className="dv-feed">
          <VideoFeed videoSrc={videoSrc} useWebcam={useWebcam} />

          <div className="dv-chip dv-weather">
            <CloudSunIcon />
            <div>
              <b>{weather.temp} °C · {weather.summary}</b>
              <small>{weather.note}</small>
            </div>
          </div>

          <div className="dv-chip dv-fps">{fps} fps · {latencyMs} ms</div>
        </div>
      </section>

      {/* Side panel */}
      <aside className="dv-side">
        <div className="dv-card">
          <h3>Driver speed</h3>
          <div className="dv-speed-top">
            <div className="dv-speed-num">{speed.current}<span>km/h</span></div>
            <div className="dv-limit">{speed.limit}</div>
          </div>
          <Sparkline data={speed.history} />
          <div className="dv-speed-foot">
            <span>Avg {speed.avg}</span>
            <span>Max {speed.max}</span>
            <span className="over">Over limit {speed.overLimit}</span>
          </div>
        </div>

        <div className="dv-card">
          <h3>Road conditions</h3>
          <div className="dv-rows">
            {road.map((r) => (
              <div className="dv-row" key={r.label}>
                <span>{r.label}</span>
                <span className={r.tone || ""}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dv-card">
          <div className="dv-head">
            <h3>Stop signs missed</h3>
            <small>of {stopSigns.total}</small>
          </div>
          <div className="dv-stat">
            <b style={{ color: "var(--warn)" }}>{stopSigns.missed}</b>
            <p>{stopSigns.fullStops} full stops · {stopSigns.compliance}% compliance</p>
          </div>
          {stopSigns.events.map((e, i) => (
            <div className="dv-ev" key={i}>
              <span><time style={{ color: "var(--warn)" }}>{e.time}</time>{e.label}</span>
              <span>{e.detail}</span>
            </div>
          ))}
        </div>

        <div className="dv-card">
          <h3>Close collisions</h3>
          <div className="dv-stat">
            <b style={{ color: "var(--bad)" }}>{closeCalls.count}</b>
            <p>near misses this trip</p>
          </div>
          {closeCalls.events.map((e, i) => (
            <div className="dv-ev" key={i}>
              <span><time style={{ color: "var(--bad)" }}>{e.time}</time>{e.label}</span>
              <span>{e.detail}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}