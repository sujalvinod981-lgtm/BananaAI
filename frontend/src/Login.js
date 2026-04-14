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

export default function Login({ onLogin, onSwitchToSignup }) {
  const [form, setForm]         = useState({ email: "", password: "" });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showPw, setShowPw]     = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res  = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed.");
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
            <h1>Sign in</h1>
            <p>Enter your credentials to access your dashboard.</p>
          </div>

          <form className="auth-form" onSubmit={onSubmit}>
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
                  placeholder="Enter your password"
                  autoComplete="current-password" required
                />
                <button type="button" className="eye-toggle" onClick={() => setShowPw(v => !v)} aria-label="Toggle password visibility">
                  <EyeIcon open={showPw} />
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
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="auth-switch">
            Don't have an account?
            <button onClick={onSwitchToSignup}>Create account</button>
          </div>
        </div>
      </div>
    </div>
  );
}
