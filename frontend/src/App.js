import { useState, useEffect, useCallback, useRef } from "react";
import "./App.css";
import Login from "./Login";
import Signup from "./Signup";

/* ── Ripeness metadata ───────────────────────────────────────────────────── */
const RIPENESS = {
  raw:      { color: "#34d399", status: "Not Ripe",    suggestion: "Wait 2–3 days before consuming. Store at room temperature." },
  ripe:     { color: "#F5C518", status: "Ripe",        suggestion: "Optimal for consumption. Best taste and nutritional value." },
  overripe: { color: "#fb923c", status: "Overripe",    suggestion: "Suitable for smoothies, baking, or banana bread. Use promptly." },
  rotten:   { color: "#f87171", status: "Spoiled",     suggestion: "Not safe for consumption. Discard immediately." },
};

function getMeta(prediction) {
  if (!prediction) return null;
  return RIPENESS[prediction.toLowerCase()] || { color: "#F5C518", status: prediction, suggestion: "" };
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];
const MAX_SIZE_MB   = 10;

function fmtBytes(b) {
  if (b < 1024)        return `${b} B`;
  if (b < 1048576)     return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}

/* ── SVG icons (inline, no dependency) ──────────────────────────────────── */
const Icon = {
  Upload: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  Results: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  History: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Check: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Alert: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Change: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
    </svg>
  ),
  /* Banana shape used as brand mark (small, fills parent) */
  BananaLogo: () => (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
      <path d="M6 26 C6 26 4 18 10 12 C16 6 26 6 28 8 C28 8 20 8 15 14 C10 20 12 28 12 28 Z" fill="#111" />
      <path d="M28 8 C28 8 30 10 28 14 C26 18 20 20 16 22 C12 24 12 28 12 28 C12 28 10 20 15 14 C20 8 28 8 28 8 Z" fill="#111" opacity="0.5"/>
    </svg>
  ),
  Scan: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9V5a2 2 0 0 1 2-2h4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M21 15v4a2 2 0 0 1-2 2h-4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/>
    </svg>
  ),
  Warn: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
};

/* ── App ─────────────────────────────────────────────────────────────────── */
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser]               = useState(null);
  const [authMode, setAuthMode]       = useState("login");
  const [image, setImage]             = useState(null);
  const [preview, setPreview]         = useState(null);
  const [fileName, setFileName]       = useState("");
  const [fileSize, setFileSize]       = useState(0);
  const [isDragOver, setIsDragOver]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const [prediction, setPrediction]   = useState("");
  const [confidence, setConfidence]   = useState("");
  const [allProbs, setAllProbs]       = useState(null);
  const [history, setHistory]         = useState([]);
  const [error, setError]             = useState("");
  const [resultVisible, setResultVisible] = useState(false);
  const [resultType, setResultType]   = useState("success");
  const fileInputRef = useRef(null);

  /* auth persistence */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const saved = localStorage.getItem("user");
    if (!token || !saved) return;
    try { setUser(JSON.parse(saved)); setIsAuthenticated(true); }
    catch { localStorage.removeItem("token"); localStorage.removeItem("user"); }
  }, []);

  /* reset result on new image */
  useEffect(() => {
    if (image) {
      setError(""); setPrediction(""); setConfidence("");
      setAllProbs(null); setResultVisible(false); setResultType("success");
    }
  }, [image]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token"); localStorage.removeItem("user");
    setUser(null); setIsAuthenticated(false);
    setImage(null); setPreview(null); setFileName(""); setFileSize(0);
    setPrediction(""); setConfidence(""); setAllProbs(null);
    setHistory([]); setError(""); setResultVisible(false); setResultType("success");
  }, []);

  const authHeaders = () => {
    const t = localStorage.getItem("token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:5000/api/history", {
        mode: "cors", headers: { Accept: "application/json", ...authHeaders() },
      });
      if (!res.ok) { if (res.status === 401) handleLogout(); return; }
      setHistory(await res.json());
    } catch {}
  }, [handleLogout]);

  useEffect(() => { if (isAuthenticated) fetchHistory(); }, [isAuthenticated, fetchHistory]);

  /* file handling */
  const loadFile = (file) => {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) { setError("Unsupported file type. Please upload a JPG, PNG, or WEBP image."); return; }
    if (file.size > MAX_SIZE_MB * 1048576)  { setError(`File exceeds the ${MAX_SIZE_MB} MB limit.`); return; }
    setImage(file); setFileName(file.name); setFileSize(file.size);
    const reader = new FileReader();
    reader.onload  = (e) => setPreview(e.target.result);
    reader.onerror = ()  => setError("Failed to read the file. It may be corrupted.");
    reader.readAsDataURL(file);
  };

  const handleChange = (e) => loadFile(e.target.files[0]);
  const handleDrop   = (e) => { e.preventDefault(); setIsDragOver(false); loadFile(e.dataTransfer.files[0]); };

  /* predict */
  const handleAnalyze = async () => {
    if (!image) { setError("Please select an image first."); return; }
    setLoading(true); setError(""); setResultVisible(false); setResultType("success");
    const fd = new FormData();
    fd.append("image", image);
    try {
      const res  = await fetch("http://localhost:5000/api/predict-ripeness", {
        method: "POST", mode: "cors",
        headers: { Accept: "application/json", ...authHeaders() },
        body: fd,
      });
      const data = await res.json();
      if (res.status === 401) { handleLogout(); throw new Error("Session expired. Please sign in again."); }
      if (data.error === "corrupted_image") { setError(data.message || "The image appears to be corrupted."); return; }
      if (data.low_confidence)        { setResultType("low_confidence"); setConfidence(data.confidence || ""); setAllProbs(data.all_probabilities || null); setTimeout(() => setResultVisible(true), 50); return; }
      if (!res.ok || data.error)      throw new Error(data.error || "Prediction failed. Please try again.");
      setPrediction(data.prediction || ""); setConfidence(data.confidence || ""); setAllProbs(data.all_probabilities || null);
      setResultType("success"); setTimeout(() => setResultVisible(true), 50);
      await fetchHistory();
    } catch (err) {
      setError(err.message || "Unable to reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* auth gate */
  if (!isAuthenticated) {
    return authMode === "login"
      ? <Login    onLogin={(u)  => { setUser(u); setIsAuthenticated(true); }} onSwitchToSignup={() => setAuthMode("signup")} />
      : <Signup   onSignup={(u) => { setUser(u); setIsAuthenticated(true); }} onSwitchToLogin={() => setAuthMode("login")} />;
  }

  const meta    = getMeta(prediction);
  const confNum = parseFloat(confidence) || 0;
  const ripeCount    = history.filter(h => h.prediction?.toLowerCase() === "ripe").length;
  const lastScanDate = history[0] ? new Date(history[0].date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";

  return (
    <div className="dashboard">

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="brand-mark"><Icon.BananaLogo /></div>
          BananaAI
        </div>
        <div className="navbar-right">
          <div className="nav-user-info">
            <span className="nav-user-name">{user?.name}</span>
            <span className="nav-user-email">{user?.email}</span>
          </div>
          <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <button className="btn-signout" onClick={handleLogout}>Sign out</button>
        </div>
      </nav>

      <main className="main">

        {/* Page header */}
        <div className="page-header">
          <div className="page-header-text">
            <h1>Ripeness Analysis</h1>
            <p>Upload a banana image to receive an AI-powered ripeness classification.</p>
          </div>
          <div className="page-header-right">
            <div className="stats-row">
              <div className="stat-cell">
                <span className="stat-num">{history.length}</span>
                <span className="stat-lbl">Total Scans</span>
              </div>
              <div className="stat-cell">
                <span className="stat-num">{ripeCount}</span>
                <span className="stat-lbl">Ripe Results</span>
              </div>
              <div className="stat-cell">
                <span className="stat-num">{lastScanDate}</span>
                <span className="stat-lbl">Last Scan</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid">

          {/* Upload card */}
          <div className="card">
            <div className="card-title">
              <Icon.Upload />
              Image Upload
            </div>

            <label
              htmlFor="file-input"
              className={`drop-zone ${isDragOver ? "drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef} id="file-input" type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
                onChange={handleChange} style={{ display: "none" }}
              />
              {preview ? (
                <div className="preview-wrap">
                  <img src={preview} alt="Selected" className="preview-img" />
                  <div className="preview-overlay">
                    <Icon.Change /> Replace image
                  </div>
                </div>
              ) : (
                <div className="drop-idle">
                  <div className="drop-icon-box"><Icon.Upload /></div>
                  <p className="drop-primary">Drop image here or click to browse</p>
                  <p className="drop-secondary">Supports JPG, PNG, WEBP</p>
                  <span className="drop-formats">Max 10 MB</span>
                </div>
              )}
            </label>

            {fileName && (
              <div className="file-meta">
                <span className="file-meta-icon"><Icon.Check /></span>
                <span className="file-meta-name">{fileName}</span>
                <span className="file-meta-size">{fmtBytes(fileSize)}</span>
              </div>
            )}

            <button className="btn-analyze" onClick={handleAnalyze} disabled={!image || loading}>
              {loading ? <><span className="spinner" /> Processing…</> : <><Icon.Scan /> Run Analysis</>}
            </button>

            {loading && (
              <div className="processing-hint">
                <div className="dot-row"><span /><span /><span /></div>
                <p>Model inference in progress — this may take a few seconds.</p>
              </div>
            )}

            {error && (
              <div className="alert-error">
                <Icon.Alert />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Result card */}
          <div className={`card result-card ${resultVisible ? "visible" : ""}`}>

            {/* Idle */}
            {!resultVisible && !loading && (
              <div className="result-idle">
                <div className="idle-icon"><Icon.Results /></div>
                <p className="idle-title">No analysis yet</p>
                <p className="idle-sub">Upload an image and run the analysis to see results here.</p>
              </div>
            )}

            {/* Scanning */}
            {loading && (
              <div className="result-scanning">
                <div className="scan-rings">
                  <div className="scan-ring" />
                  <div className="scan-ring scan-ring-2" />
                  <div className="scan-inner"><Icon.Scan /></div>
                </div>
                <p className="scanning-title">Analyzing image</p>
                <p className="scanning-sub">Running AI classification model…</p>
              </div>
            )}

            {/* Low confidence */}
            {resultVisible && resultType === "low_confidence" && (
              <div className="result-validation state-uncertain">
                <div className="val-icon amber-bg"><Icon.Warn /></div>
                <p className="val-title">Insufficient Confidence</p>
                <p className="val-body">
                  The model confidence{confidence ? ` (${confidence})` : ""} is below the required threshold. The image may be blurry, poorly lit, or partially obscured.
                </p>
                <p className="val-hint">Try a clearer, well-lit photograph.</p>
                {allProbs && (
                  <div className="probs-block" style={{ width: "100%", marginTop: "14px", textAlign: "left" }}>
                    <p className="block-label">Probability Distribution</p>
                    {Object.entries(allProbs).sort((a, b) => b[1] - a[1]).map(([cls, pct]) => (
                      <div key={cls} className="prob-row">
                        <span className="prob-name">{cls}</span>
                        <div className="prob-track"><div className="prob-fill" style={{ width: `${pct}%` }} /></div>
                        <span className="prob-pct">{pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn-retry" onClick={() => fileInputRef.current?.click()}>Upload different image</button>
              </div>
            )}

            {/* Success */}
            {resultVisible && resultType === "success" && prediction && (
              <div className="result-success">
                <div className="card-title" style={{ marginBottom: "16px" }}>
                  <Icon.Results />
                  Analysis Result
                </div>

                {/* Status row */}
                <div className="status-row" style={{ "--status-color": meta?.color }}>
                  <div className="status-dot" />
                  <div className="status-info">
                    <div className="status-label">Classification</div>
                    <div className="status-value">{prediction}</div>
                  </div>
                  <div className="status-conf">{confidence}</div>
                </div>

                {/* Confidence bar */}
                <div className="conf-block">
                  <div className="conf-row">
                    <span>Confidence Score</span>
                    <span>{confidence}</span>
                  </div>
                  <div className="conf-track">
                    <div className="conf-fill" style={{ width: `${confNum}%`, "--status-color": meta?.color }} />
                  </div>
                </div>

                {/* Probabilities */}
                {allProbs && (
                  <div className="probs-block">
                    <p className="block-label">Class Probabilities</p>
                    {Object.entries(allProbs).sort((a, b) => b[1] - a[1]).map(([cls, pct]) => (
                      <div key={cls} className="prob-row">
                        <span className="prob-name">{cls}</span>
                        <div className="prob-track"><div className="prob-fill" style={{ width: `${pct}%` }} /></div>
                        <span className="prob-pct">{pct}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendation */}
                {meta && (
                  <div className="recommendation">
                    <p className="rec-label">Recommendation</p>
                    <p className="rec-status">{meta.status}</p>
                    <p className="rec-suggestion">{meta.suggestion}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="card">
            <div className="history-header">
              <Icon.History />
              <h2>Scan History</h2>
              <span className="history-badge">{history.length} records</span>
            </div>
            <table className="history-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Result</th>
                  <th>Confidence</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, i) => {
                  const m = getMeta(item.prediction);
                  return (
                    <tr key={i}>
                      <td className="h-file">{item.imageName}</td>
                      <td>
                        <div className="h-pred-cell">
                          <span className="h-status-dot" style={{ background: m?.color }} />
                          <span className="h-pred-text" style={{ color: m?.color }}>{item.prediction}</span>
                        </div>
                      </td>
                      <td className="h-conf">{item.confidence}</td>
                      <td className="h-date">{new Date(item.date).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
