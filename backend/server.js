const express = require("express");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");


// ─── ML Prediction Helper ─────────────────────────────────────────────────────

const { spawn }    = require("child_process");
const http         = require("http");
const FormData     = require("form-data");

const PREDICT_SCRIPT = path.join(__dirname, "..", "banana-ripeness-ml", "predict.py");
const VENV_PYTHON    = path.join(__dirname, "..", "banana-ripeness-ml", "venv", "Scripts", "python.exe");
const PYTHON_BIN     = fs.existsSync(VENV_PYTHON) ? VENV_PYTHON : "python";
const ML_SERVER_URL  = "http://localhost:5001/predict";
const ML_HEALTH_URL  = "http://localhost:5001/health";

// Check once at startup whether the Flask ML server is reachable
let mlServerAvailable = false;
function checkMlServer() {
  http.get(ML_HEALTH_URL, (res) => {
    if (res.statusCode === 200) {
      if (!mlServerAvailable) console.log("✅ Flask ML server detected — fast inference enabled");
      mlServerAvailable = true;
    }
  }).on("error", () => {
    if (mlServerAvailable) console.log("⚠️  Flask ML server unreachable — falling back to spawn");
    mlServerAvailable = false;
  });
}
checkMlServer();
setInterval(checkMlServer, 15000);   // re-check every 15 s

// ── Fast path: send image directly to the persistent Flask ML server ──────────
function runPredictionFast(imagePath) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("image", fs.createReadStream(imagePath));

    const options = {
      method:  "POST",
      host:    "localhost",
      port:    5001,
      path:    "/predict",
      headers: form.getHeaders(),
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch {
          reject(new Error("Invalid JSON from ML server: " + body));
        }
      });
    });

    req.on("error", (err) => reject(new Error("ML server request failed: " + err.message)));
    form.pipe(req);
  });
}

// ── Slow path: spawn predict.py (used when Flask server is not running) ───────
function runPredictionSlow(imagePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [PREDICT_SCRIPT, imagePath]);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      const raw   = stdout.trim();
      const lines = raw.split("\n").filter(Boolean);
      const jsonLine = lines[lines.length - 1];
      try {
        const result = JSON.parse(jsonLine);
        if (result.error && !result.low_confidence && result.error !== "corrupted_image")
          return reject(new Error(result.error));
        resolve(result);
      } catch {
        reject(new Error(stderr.trim() || `predict.py exited with code ${code}. Output: ${raw}`));
      }
    });

    proc.on("error", (err) => reject(new Error(`Failed to start Python: ${err.message}`)));
  });
}

// ── Unified entry point — picks fast or slow automatically ───────────────────
function runPrediction(imagePath) {
  if (mlServerAvailable) {
    return runPredictionFast(imagePath).catch((err) => {
      console.warn("Fast path failed, falling back to spawn:", err.message);
      mlServerAvailable = false;
      return runPredictionSlow(imagePath);
    });
  }
  return runPredictionSlow(imagePath);
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);

// ─── SQLite Setup ─────────────────────────────────────────────────────────────

const DB_PATH = path.join(__dirname, "users.db");
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("❌ Failed to open SQLite database:", err.message);
    process.exit(1);
  }
  console.log("✅ Connected to SQLite:", DB_PATH);
});

// Enable WAL mode for better concurrency
db.run("PRAGMA journal_mode=WAL");

// Create tables
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    UNIQUE NOT NULL,
      password   TEXT    NOT NULL,
      token      TEXT,
      created_at TEXT    DEFAULT (datetime('now'))
    )`,
    (err) => {
      if (err) console.error("❌ users table error:", err.message);
      else console.log("✅ users table ready");
    }
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS predictions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      image_name TEXT    NOT NULL,
      prediction TEXT    NOT NULL,
      confidence TEXT    NOT NULL,
      date       TEXT    DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    (err) => {
      if (err) console.error("❌ predictions table error:", err.message);
      else console.log("✅ predictions table ready");
    }
  );
});

// ─── DB Promise Helpers ───────────────────────────────────────────────────────

function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params || [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params || [], function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbAll(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params || [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ─── Uploads ─────────────────────────────────────────────────────────────────

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

// ─── Auth Middleware ──────────────────────────────────────────────────────────

async function auth(req, res, next) {
  const token = req.header("Authorization")?.replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "No token provided." });
  try {
    const user = await dbGet("SELECT * FROM users WHERE token = ?", [token]);
    if (!user) return res.status(401).json({ error: "Invalid token." });
    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ error: "Authentication failed." });
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.json({ message: "Banana Ripeness API is running", db: "SQLite" });
});

// POST /api/auth/register
app.post("/api/auth/register", async (req, res) => {
  console.log("📥 Register request body:", req.body);

  const { name, email, password } = req.body || {};

  // Validate
  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ error: "Full name is required." });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ error: "A valid email address is required." });
  }
  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const cleanName  = String(name).trim();
  const cleanEmail = String(email).toLowerCase().trim();

  try {
    // Check duplicate
    const existing = await dbGet("SELECT id FROM users WHERE email = ?", [cleanEmail]);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    // Hash + token
    const hashed = await bcrypt.hash(String(password), 10);
    const token  = crypto.randomBytes(32).toString("hex");

    // Insert
    const result = await dbRun(
      "INSERT INTO users (name, email, password, token) VALUES (?, ?, ?, ?)",
      [cleanName, cleanEmail, hashed, token]
    );

    console.log(`✅ Registered: ${cleanEmail} (id ${result.lastID})`);

    return res.status(201).json({
      message: "Account created successfully.",
      token,
      user: { id: result.lastID, name: cleanName, email: cleanEmail },
    });

  } catch (err) {
    console.error("❌ Registration error:", err.message);
    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    return res.status(500).json({ error: err.message || "Server error during registration." });
  }
});

// POST /register  (alias)
app.post("/register", (req, res) => {
  req.url = "/api/auth/register";
  app.handle(req, res);
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  try {
    const user = await dbGet("SELECT * FROM users WHERE email = ?", [String(email).toLowerCase().trim()]);
    if (!user) return res.status(401).json({ error: "Invalid email or password." });

    const match = await bcrypt.compare(String(password), user.password);
    if (!match) return res.status(401).json({ error: "Invalid email or password." });

    const token = crypto.randomBytes(32).toString("hex");
    await dbRun("UPDATE users SET token = ? WHERE id = ?", [token, user.id]);

    return res.json({
      message: "Login successful.",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    return res.status(500).json({ error: "Server error during login." });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", auth, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email } });
});

// POST /api/predict-ripeness
app.post("/api/predict-ripeness", auth, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Image file is required." });

  // Validate MIME type on the server side
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];
  if (!allowedMimes.includes(req.file.mimetype)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: "Invalid file type. Please upload a JPG, PNG, or WEBP image." });
  }

  const imagePath = req.file.path;

  try {
    const result = await runPrediction(imagePath);

    // ── corrupted image ───────────────────────────────────────────────────
    if (result.error === "corrupted_image") {
      return res.status(422).json({
        error: "corrupted_image",
        message: result.message || "The uploaded image appears to be corrupted or unreadable.",
      });
    }

    // ── low confidence ────────────────────────────────────────────────────
    if (result.low_confidence) {
      return res.status(422).json({
        low_confidence: true,
        confidence: result.confidence,
        all_probabilities: result.all_probabilities || {},
        message: result.message || "Unable to determine ripeness. Please upload a clearer banana image.",
      });
    }

    // ── successful prediction ─────────────────────────────────────────────
    await dbRun(
      "INSERT INTO predictions (user_id, image_name, prediction, confidence) VALUES (?, ?, ?, ?)",
      [req.user.id, req.file.originalname || req.file.filename, result.prediction, result.confidence]
    ).catch((e) => console.error("History save error:", e.message));

    res.json({
      prediction:        result.prediction,
      confidence:        result.confidence,
      all_probabilities: result.all_probabilities || {},
    });

  } catch (err) {
    console.error("❌ Prediction error:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(imagePath, () => {});
  }
});

// GET /api/history
app.get("/api/history", auth, async (req, res) => {
  try {
    const rows = await dbAll(
      "SELECT image_name, prediction, confidence, date FROM predictions WHERE user_id = ? ORDER BY date DESC LIMIT 20",
      [req.user.id]
    );
    res.json(rows.map((r) => ({
      imageName: r.image_name,
      prediction: r.prediction,
      confidence: r.confidence,
      date: r.date,
    })));
  } catch (err) {
    console.error("History fetch error:", err.message);
    res.status(500).json({ error: "Unable to load prediction history." });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
