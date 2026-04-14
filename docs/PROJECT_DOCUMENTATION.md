# BananaAI — Full Project Documentation

> **Version:** 3.0
> **Last Updated:** April 2026
> **Author:** Sujal Shinde
> **Stack:** React 19 · Node.js / Express 5 · SQLite · Python 3 · TensorFlow / Keras · Flask

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Project Structure](#2-project-structure)
3. [Tech Stack](#3-tech-stack)
4. [Architecture Diagram](#4-architecture-diagram)
5. [How to Run](#5-how-to-run)
6. [ML Module](#6-ml-module)
7. [Prediction Pipeline](#7-prediction-pipeline)
8. [Backend API](#8-backend-api)
9. [Database Schema](#9-database-schema)
10. [API Reference](#10-api-reference)
11. [Frontend](#11-frontend)
12. [Authentication System](#12-authentication-system)
13. [Error Handling](#13-error-handling)
14. [Performance — Fast vs Slow Path](#14-performance--fast-vs-slow-path)
15. [Known Limitations](#15-known-limitations)
16. [Future Improvements](#16-future-improvements)

---

## 1. Project Overview

**BananaAI** is a full-stack AI web application that classifies banana ripeness from uploaded photographs. A user registers, uploads a banana image, and receives an instant AI-powered ripeness classification with a confidence score, per-class probability breakdown, and a consumption recommendation.

### Key Capabilities

| Capability | Detail |
|---|---|
| Ripeness classification | Overripe · Ripe · Rotten (3 classes) |
| Confidence gating | Predictions below 40% confidence are withheld |
| Image integrity check | Corrupted or unreadable files are caught before inference |
| Fast inference | Persistent Flask ML server keeps model in memory (~1–2 s per prediction) |
| Fallback inference | If Flask server is offline, Node.js spawns predict.py automatically |
| Scan history | Last 20 predictions per user stored in SQLite |
| Auth | Token-based registration and login with bcrypt password hashing |

---

## 2. Project Structure

```
banana-ripeness-project/
│
├── frontend/                        # React 19 SPA (port 3000)
│   └── src/
│       ├── App.js                   # Main dashboard — upload, results, history
│       ├── App.css                  # Dashboard styles (design tokens, gradients)
│       ├── Login.js                 # Sign-in page (split-panel layout)
│       ├── Signup.js                # Registration page + password strength meter
│       └── Auth.css                 # Auth page styles
│
├── backend/                         # Node.js + Express 5 API (port 5000)
│   ├── server.js                    # All routes, middleware, DB setup, ML bridge
│   ├── users.db                     # SQLite database
│   ├── uploads/                     # Temporary image storage (auto-deleted)
│   └── package.json
│
├── banana-ripeness-ml/              # Python ML module
│   ├── ml_server.py                 # ★ Persistent Flask ML server (port 5001)
│   ├── predict.py                   # Fallback: CLI inference script
│   ├── train.py                     # Model training script
│   ├── requirements.txt             # Python dependencies
│   └── model/
│       ├── banana_model.h5          # Trained Keras model
│       ├── best_model.h5            # Best checkpoint by val_accuracy
│       ├── classes.json             # Ordered class label list
│       └── training_history.png     # Accuracy / loss plot
│
├── Banana Ripeness Classification Dataset/
│   ├── train/  (overripe · ripe · rotten)
│   └── test/   (overripe · ripe · rotten)
│
└── docs/
    ├── PROJECT_DOCUMENTATION.md     # This file (technical reference)
    └── GUIDE.md                     # Beginner-friendly plain-language guide
```

---

## 3. Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend | React | 19.2 | SPA UI |
| Frontend styling | Plain CSS | — | Design tokens, gradients, animations |
| Backend runtime | Node.js | 18+ | API server |
| Backend framework | Express | 5.2 | HTTP routing |
| Database | SQLite (sqlite3) | 5.1 | User accounts + prediction history |
| Password hashing | bcrypt | 5.1 | Secure credential storage |
| File upload | Multer | 2.1 | Multipart form handling |
| ML server | Flask | 3.x | Persistent HTTP inference server |
| ML framework | TensorFlow / Keras | 2.x | Model training and inference |
| Base model | MobileNetV2 | ImageNet weights | Transfer learning backbone |
| Image processing | Pillow (PIL) | 10+ | Image loading, resizing, validation |
| Python runtime | Python | 3.10+ | ML inference |
| Numerical computing | NumPy | 1.x | Array operations |

---

## 4. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Browser  (port 3000)                      │
│  Login / Signup  ·  Upload Card  ·  Result Card  ·  History  │
└───────────────────────────┬──────────────────────────────────┘
                            │  REST / JSON  +  FormData
                            ▼
┌──────────────────────────────────────────────────────────────┐
│               Express API  (port 5000)                       │
│                                                              │
│  Auth middleware  ·  Multer  ·  SQLite  ·  ML bridge         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  runPrediction()                                    │    │
│  │                                                     │    │
│  │  mlServerAvailable?                                 │    │
│  │    YES → HTTP POST to localhost:5001/predict  ──┐   │    │
│  │    NO  → spawn python predict.py  ─────────────┤   │    │
│  │                                                 │   │    │
│  │  Auto-fallback if Flask request fails  ◄────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────┬────────────────────────────┬─────────────────────┘
           │ HTTP multipart             │ child_process spawn
           ▼                            ▼
┌──────────────────────┐    ┌──────────────────────────────────┐
│  Flask ML Server     │    │  predict.py  (fallback)          │
│  (port 5001)         │    │                                  │
│                      │    │  1. PIL verify()                 │
│  Model loaded ONCE   │    │  2. Preprocess 160×160           │
│  at startup          │    │  3. model.predict()              │
│                      │    │  4. Confidence gate ≥ 40%        │
│  ~1–2 s per request  │    │  Prints JSON to stdout           │
│                      │    │                                  │
│  /health  GET        │    │  ~10–15 s per request            │
│  /predict POST       │    │  (cold-start every time)         │
└──────────────────────┘    └──────────────────────────────────┘
```

---

## 5. How to Run

### Prerequisites

| Tool | Minimum version |
|---|---|
| Node.js | 18 |
| npm | 9 |
| Python | 3.10 |
| pip | 23 |

---

### Step 1 — Train the model (one-time only)

```bash
cd banana-ripeness-ml

python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux

pip install -r requirements.txt
python train.py
```

Output files created:
- `model/banana_model.h5`
- `model/best_model.h5`
- `model/classes.json`
- `model/training_history.png`

Training time: ~5–20 minutes on CPU.

---

### Step 2 — Start the Flask ML server ★ (recommended for fast predictions)

Open a dedicated terminal and keep it running:

```bash
cd banana-ripeness-ml
venv\Scripts\activate
python ml_server.py
```

Expected output:
```
Loading model...
✅ Model ready — classes: ['overripe', 'ripe', 'rotten']
🚀 ML server running on http://localhost:5001
```

> **This step is optional but strongly recommended.** Without it, each prediction takes 10–15 seconds. With it, predictions take 1–2 seconds.

---

### Step 3 — Start the backend

```bash
cd backend
npm install
node server.js
```

Expected output:
```
✅ Connected to SQLite
✅ users table ready
✅ predictions table ready
✅ Flask ML server detected — fast inference enabled   ← if ml_server.py is running
🚀 Server running on http://localhost:5000
```

---

### Step 4 — Start the frontend

```bash
cd frontend
npm install
npm start
```

Opens at **http://localhost:3000**

---

### Terminal layout (recommended)

```
Terminal 1: python ml_server.py      ← keep open
Terminal 2: node server.js           ← keep open
Terminal 3: npm start  (frontend)    ← keep open
```

---

## 6. ML Module

### Model Architecture

```
Input: 160 × 160 × 3  (RGB, normalised 0–1)
  │
  ▼
MobileNetV2  (pretrained ImageNet, ALL layers frozen)
  │
  ▼
GlobalAveragePooling2D
  │
  ▼
Dense(128, relu)
  │
  ▼
Dropout(0.3)
  │
  ▼
Dense(3, softmax)   →   overripe · ripe · rotten
```

Only the classification head is trained. The MobileNetV2 backbone is fully frozen, making training fast on CPU.

### Training Configuration (`train.py`)

| Parameter | Value |
|---|---|
| Input size | 160 × 160 px |
| Batch size | 16 |
| Max epochs | 10 |
| Optimizer | Adam (lr = 1e-3) |
| Loss | Categorical Crossentropy |
| Early stopping | patience = 3, monitors `val_loss` |
| LR reduction | factor = 0.5, patience = 2, min_lr = 1e-6 |
| Best checkpoint | `model/best_model.h5`, monitors `val_accuracy` |

### Data Augmentation (training only)

| Augmentation | Value |
|---|---|
| Rotation | ±20° |
| Zoom | 20% |
| Width / height shift | 10% |
| Horizontal flip | Yes |
| Fill mode | Nearest |

### Confidence Threshold

Both `ml_server.py` and `predict.py` use `CONFIDENCE_THRESHOLD = 0.40`.

If `max(softmax probabilities) < 0.40`, the prediction is withheld and a `low_confidence` response is returned instead.

---

## 7. Prediction Pipeline

### Fast path (Flask ML server running)

```
1.  User selects image in browser
2.  Client-side validation: MIME type + 10 MB size limit
3.  FormData POST → /api/predict-ripeness
4.  Express auth middleware validates Bearer token
5.  Multer saves file to backend/uploads/<uuid>
6.  Server-side MIME type check
7.  Node.js sends multipart POST to http://localhost:5001/predict
8.  Flask: PIL verify() → corrupted image check
9.  Flask: preprocess → resize 160×160, normalise, expand dims
10. Flask: model.predict() → softmax array (model already in memory)
11. Flask: confidence gate → low_confidence if < 40%
12. Flask returns JSON to Node.js
13. Node.js saves result to predictions table
14. Node.js returns result to frontend
15. Uploaded file deleted from disk
16. React renders result card
```

**Total time: ~1–2 seconds**

### Slow path (fallback, no Flask server)

Steps 1–6 same, then:

```
7.  Node.js spawns: python predict.py <image_path>
8.  Python: TensorFlow loads (~5 s)
9.  Python: model loads from disk (~5 s)
10. Python: PIL verify, preprocess, predict, confidence gate
11. Python prints JSON to stdout
12. Node.js parses stdout JSON
13–16. Same as fast path
```

**Total time: ~10–15 seconds**

---

## 8. Backend API

**File:** `backend/server.js`
**Port:** 5000

### ML Bridge Logic

```
checkMlServer()  runs on startup + every 15 seconds
  → pings http://localhost:5001/health
  → sets mlServerAvailable = true / false

runPrediction(imagePath)
  → if mlServerAvailable: runPredictionFast()
      → HTTP POST multipart to Flask
      → on failure: fallback to runPredictionSlow()
  → else: runPredictionSlow()
      → spawn python predict.py
```

### Middleware Stack

```
express.json()
express.urlencoded()
cors({ origin: ["http://localhost:3000", "http://localhost:3001"] })
multer({ dest: "uploads/" })    ← per-route
auth()                          ← custom token middleware
```

### Database Helpers

| Helper | SQLite call | Use |
|---|---|---|
| `dbGet(sql, params)` | `db.get` | Fetch single row |
| `dbRun(sql, params)` | `db.run` | INSERT / UPDATE |
| `dbAll(sql, params)` | `db.all` | Fetch multiple rows |

---

## 9. Database Schema

**Engine:** SQLite 3 · WAL journal mode
**File:** `backend/users.db`

```sql
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    UNIQUE NOT NULL,
  password   TEXT    NOT NULL,          -- bcrypt hash, 10 rounds
  token      TEXT,                      -- 32-byte hex session token
  created_at TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS predictions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  image_name TEXT    NOT NULL,
  prediction TEXT    NOT NULL,          -- e.g. "Ripe"
  confidence TEXT    NOT NULL,          -- e.g. "94.2%"
  date       TEXT    DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 10. API Reference

Base URL: `http://localhost:5000`

### POST `/api/auth/register`

Register a new account.

**Body (JSON)**
```json
{ "name": "Sujal Shinde", "email": "sujal@example.com", "password": "mypassword" }
```

**Validation:** name non-empty · email valid format · password ≥ 6 chars

**201 Success**
```json
{ "message": "Account created successfully.", "token": "<64-char hex>", "user": { "id": 1, "name": "...", "email": "..." } }
```

| Status | Condition |
|---|---|
| 400 | Missing / invalid fields |
| 409 | Email already registered |
| 500 | Server error |

---

### POST `/api/auth/login`

**Body (JSON)**
```json
{ "email": "sujal@example.com", "password": "mypassword" }
```

**200 Success**
```json
{ "message": "Login successful.", "token": "<64-char hex>", "user": { ... } }
```

> Each login **rotates the token** — the previous token is invalidated.

| Status | Condition |
|---|---|
| 400 | Missing fields |
| 401 | Wrong credentials |

---

### GET `/api/auth/me`

**Headers:** `Authorization: Bearer <token>`

**200** → `{ "user": { "id": 1, "name": "...", "email": "..." } }`

---

### POST `/api/predict-ripeness`

Upload a banana image and receive a ripeness classification.

**Headers:** `Authorization: Bearer <token>`
**Body:** `multipart/form-data`, field name `image`
**Accepted types:** `image/jpeg` · `image/png` · `image/webp` · `image/gif` · `image/bmp`

**200 Success**
```json
{
  "prediction": "Ripe",
  "confidence": "94.2%",
  "all_probabilities": { "overripe": 2.1, "ripe": 94.2, "rotten": 3.7 }
}
```

**422 — Corrupted image**
```json
{ "error": "corrupted_image", "message": "The uploaded image appears to be corrupted or unreadable." }
```

**422 — Low confidence**
```json
{
  "low_confidence": true,
  "confidence": "38.5%",
  "all_probabilities": { "overripe": 38.5, "ripe": 31.2, "rotten": 30.3 },
  "message": "Unable to determine ripeness. Please upload a clearer banana image."
}
```

| Status | Condition |
|---|---|
| 400 | No file / invalid MIME type |
| 401 | Missing or invalid token |
| 422 | Corrupted image or low confidence |
| 500 | Python / Flask error or model not found |

---

### GET `/api/history`

**Headers:** `Authorization: Bearer <token>`

**200**
```json
[
  { "imageName": "banana.jpg", "prediction": "Ripe", "confidence": "94.2%", "date": "2026-04-13 10:22:05" }
]
```

Returns last 20 predictions for the authenticated user, newest first.

---

## 11. Frontend

### Pages

| Page | File | Shown when |
|---|---|---|
| Sign In | `Login.js` | `authMode === "login"` and not authenticated |
| Create Account | `Signup.js` | `authMode === "signup"` and not authenticated |
| Dashboard | `App.js` | Authenticated |

### Dashboard Sections

**Upload Card**
- Drag-and-drop zone or click-to-browse
- Client-side validation: MIME type + 10 MB limit before any network request
- Image preview via `FileReader`
- File name + formatted size shown after selection
- Gradient "Run Analysis" button

**Result Card — states**

| State | Trigger | Display |
|---|---|---|
| Idle | No analysis run | Placeholder |
| Scanning | Request in flight | Animated pulse rings |
| Low confidence | `data.low_confidence` | Amber card + probability bars + retry |
| Success | Valid prediction | Status row · confidence bar · probabilities · recommendation |

**Scan History Table**
- Columns: File · Result · Confidence · Date
- Colour-coded result dots per ripeness class
- Refreshed after every successful scan

**Stats Strip**
- Total Scans · Ripe Results · Last Scan date — derived live from history array

### Auth Pages

Split-panel layout: branding on the left, form on the right.

Signup extras:
- Live 4-bar password strength meter (Weak / Fair / Good / Strong)
- Confirm password field turns red on mismatch
- Show/hide eye toggle on all password fields

### Consumption Advice

| Prediction | Colour | Status | Suggestion |
|---|---|---|---|
| Raw | `#34d399` green | Not Ripe | Wait 2–3 days |
| Ripe | `#F5C518` yellow | Ripe | Eat now |
| Overripe | `#fb923c` orange | Overripe | Smoothies / baking |
| Rotten | `#f87171` red | Spoiled | Discard |

---

## 12. Authentication System

- Tokens: **64-character hex** via `crypto.randomBytes(32)`
- Passwords: **bcrypt, 10 salt rounds**
- Token stored in `users` table + browser `localStorage`
- Every login **rotates the token** — previous token immediately invalid
- `auth()` middleware does a DB lookup on every protected request
- Logout clears `localStorage` and resets all React state

---

## 13. Error Handling

### Frontend

| Scenario | Handling |
|---|---|
| Wrong file type | Inline error before upload |
| File > 10 MB | Inline error before upload |
| Corrupted file | Error from server shown inline |
| Low confidence | Amber validation card with probability breakdown |
| Session expired (401) | Auto-logout + redirect to login |
| Network error | "Unable to reach the server" message |

### Backend

| Scenario | Status | Response |
|---|---|---|
| No file | 400 | `{ "error": "Image file is required." }` |
| Invalid MIME | 400 | `{ "error": "Invalid file type..." }` |
| No token | 401 | `{ "error": "No token provided." }` |
| Bad token | 401 | `{ "error": "Invalid token." }` |
| Corrupted image | 422 | `{ "error": "corrupted_image", "message": "..." }` |
| Low confidence | 422 | `{ "low_confidence": true, ... }` |
| Python / Flask crash | 500 | `{ "error": "<message>" }` |

---

## 14. Performance — Fast vs Slow Path

| | Fast path (Flask) | Slow path (spawn) |
|---|---|---|
| Model load | Once at startup | Every request |
| TF init | Once at startup | Every request |
| Prediction time | ~1–2 seconds | ~10–15 seconds |
| Requires | `ml_server.py` running | Nothing extra |
| Auto-fallback | Yes — if Flask fails | — |

### How the backend decides which path to use

```
On startup:
  checkMlServer() → GET http://localhost:5001/health
  → 200 OK  : mlServerAvailable = true  → use fast path
  → error   : mlServerAvailable = false → use slow path

Every 15 seconds:
  checkMlServer() runs again
  → detects if Flask comes online or goes offline
  → switches path automatically, logs to console

On each prediction request:
  runPrediction(imagePath)
    → fast path: HTTP POST to Flask
        → if Flask request fails: fallback to slow path
    → slow path: spawn python predict.py
```

### Flask ML server endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Returns `{ "status": "ok", "classes": [...] }` |
| `/predict` | POST | Accepts `multipart/form-data` with `image` field, returns prediction JSON |

---

## 15. Known Limitations

| Limitation | Detail |
|---|---|
| Slow without Flask server | Without `ml_server.py`, each prediction takes 10–15 s due to Python cold-start |
| CPU only | No GPU acceleration on native Windows (TF ≥ 2.11). Use WSL2 for GPU support |
| Single active session | Each login invalidates the previous token |
| 3 classes only | Model classifies overripe / ripe / rotten only |
| Dataset path hardcoded | `train.py` has an absolute path — must be updated on a different machine |
| Flask not auto-started | `ml_server.py` must be started manually before the backend |

---

## 16. Future Improvements

| Improvement | Benefit |
|---|---|
| Auto-start Flask server from Node.js | One-command startup |
| Fine-tune MobileNetV2 top layers | Higher accuracy |
| Add `unripe` / `slightly ripe` classes | More granular classification |
| GPU support via WSL2 or DirectML | 10× faster inference |
| Refresh token mechanism | Multi-device sessions |
| Image thumbnails in history | Visual scan history |
| Cloud deployment | Railway / Render (backend + ML) + Vercel (frontend) |
| Export predictions as CSV | Data download |
| Unit and integration tests | Reliability |

---

*Last updated: April 2026 — v3.0*
