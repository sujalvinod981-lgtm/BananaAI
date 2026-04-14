import { useState } from "react";
import "./Auth.css";

const EyeIcon = ({ open }) => open ? (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
) : (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const LogoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#111" stroke="none">
    <path d="M12 2C8 2 5 6 5 10c0 5 4 10 7 12 3-2 7-7 7-12 0-4-3-8-7-8z"/>
  </svg>
);

function pwStrength(pw) {
  if (!pw) return { score: 0, label: "", cls: "" };
  let s = 0;
  if (pw.length >= 8)            s++;
  if (/[A-Z]/.test(pw))         s++;
  if (/[0-9]/.test(pw))         s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const cls    = ["", "s-weak", "s-fair", "s-good", "s-strong"];
  return { score: s, label: labels[s], cls: cls[s] };
}

export default function Signup({ onSignup, onSwitchToLogin }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showCf, setShowCf]       = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res  = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed.");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onSignup(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const strength = pwStrength(form.password);
  const mismatch = form.confirm && form.confirm !== form.password;

  return (
    <div className="auth-page">
      {/* Left branding panel */}
      <div className="auth-panel-left">
        <div className="auth-brand">
          <div className="auth-brand-mark"><LogoIcon /></div>
          <span className="auth-brand-name">BananaAI</span>
        </div>
        <div className="auth-panel-copy">
          <h2>AI-powered banana ripeness classification</h2>
          <p>Upload a photograph and receive an instant, accurate ripeness assessment powered by a MobileNetV2 deep learning model.</p>
        </div>
        <div className="auth-panel-features">
          <div className="auth-feature"><span className="auth-feature-dot" />Instant AI classification</div>
          <div className="auth-feature"><span className="auth-feature-dot" />Confidence scoring</div>
          <div className="auth-feature"><span className="auth-feature-dot" />Consumption recommendations</div>
          <div className="auth-feature"><span className="auth-feature-dot" />Full scan history</div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-panel-right">
        <div className="auth-form-wrap">
          <div className="auth-form-header">
            <h1>Create account</h1>
            <p>Fill in the details below to get started.</p>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input
                id="name" name="name" type="text"
                value={form.name} onChange={onChange}
                placeholder="Your full name"
                autoComplete="name" required
              />
            </div>

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email" name="email" type="email"
                value={form.email} onChange={onChange}
                placeholder="you@example.com"
                autoComplete="email" required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="field-input-wrap">
                <input
                  id="password" name="password"
                  type={showPw ? "text" : "password"}
                  value={form.password} onChange={onChange}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password" minLength="6" required
                />
                <button type="button" className="eye-toggle" onClick={() => setShowPw(v => !v)} aria-label="Toggle password visibility">
                  <EyeIcon open={showPw} />
                </button>
              </div>
              {form.password && (
                <div className="pw-meter">
                  <div className="pw-bars">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`pw-bar ${strength.score >= i ? strength.cls : ""}`} />
                    ))}
                  </div>
                  <span className={`pw-text ${strength.cls}`}>{strength.label}</span>
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="confirm">Confirm password</label>
              <div className="field-input-wrap">
                <input
                  id="confirm" name="confirm"
                  type={showCf ? "text" : "password"}
                  value={form.confirm} onChange={onChange}
                  placeholder="Repeat your password"
                  autoComplete="new-password" minLength="6" required
                  className={mismatch ? "is-error" : ""}
                />
                <button type="button" className="eye-toggle" onClick={() => setShowCf(v => !v)} aria-label="Toggle password visibility">
                  <EyeIcon open={showCf} />
                </button>
              </div>
            </div>

            {error && (
              <div className="auth-error-msg">
                <AlertIcon />
                {error}
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <div className="auth-switch">
            Already have an account?
            <button onClick={onSwitchToLogin}>Sign in</button>
          </div>
        </div>
      </div>
    </div>
  );
}
