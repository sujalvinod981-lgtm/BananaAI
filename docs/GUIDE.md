# 🍌 BananaAI — Simple Guide

> **Who is this for?** Anyone who wants to understand how this project works —
> whether you're a student, a teacher reviewing it, or a developer picking it up
> for the first time. No deep technical knowledge required.

---

## What does this app do?

You take a photo of a banana, upload it to the website, and the app tells you:

- **Is it ripe?** (ready to eat)
- **Is it overripe?** (use it for smoothies or baking)
- **Is it rotten?** (throw it away)

It also tells you **how confident** it is in that answer (e.g. "94% sure it's ripe").

---

## How does it work? (The Big Picture)

Think of it like a three-layer sandwich:

```
┌─────────────────────────────────────────┐
│  🖥️  FRONTEND  (what you see)           │
│     Website running in your browser     │
│     Built with React                    │
└──────────────────┬──────────────────────┘
                   │  sends your photo
                   ▼
┌─────────────────────────────────────────┐
│  ⚙️  BACKEND  (the middleman)           │
│     Receives your photo                 │
│     Checks your login                   │
│     Saves your results                  │
│     Built with Node.js                  │
└──────────────────┬──────────────────────┘
                   │  passes photo to AI
                   ▼
┌─────────────────────────────────────────┐
│  🧠  AI MODEL  (the brain)              │
│     Looks at the photo                  │
│     Decides the ripeness                │
│     Built with Python + TensorFlow      │
└─────────────────────────────────────────┘
```

---

## Step-by-step: What happens when you upload a photo?

```
You pick a photo
      │
      ▼
① Browser checks the file
  • Is it a JPG/PNG/WEBP? ✓
  • Is it under 10 MB?    ✓
  • If not → shows error, stops here
      │
      ▼
② Photo is sent to the server
  • Server checks you are logged in
  • If not logged in → rejects the request
      │
      ▼
③ Server saves the photo temporarily
  • Stored in the uploads/ folder
  • Will be deleted automatically after analysis
      │
      ▼
④ Server asks the AI to analyse it
  • Runs the Python script: predict.py
      │
      ▼
⑤ AI runs 4 safety checks:

  Check 1 — Is the file readable?
    └─ Broken/corrupted file? → "Image is corrupted"

  Check 2 — Does it look like a banana?
    └─ Checks colour (yellow/green/brown)
    └─ Checks shape (elongated, not round)
    └─ Checks colour variation (not a flat balloon)
    └─ Fails? → "This is not a banana"

  Check 3 — Run the AI model
    └─ Resizes photo to 160×160 pixels
    └─ Feeds it through MobileNetV2 neural network
    └─ Gets 3 scores: overripe / ripe / rotten

  Check 4 — Is the AI confident enough?
    └─ Below 60% confidence? → "Image too unclear"
    └─ Above 60%? → Return the result ✓
      │
      ▼
⑥ Result sent back to your browser
  • Shows: Ripe / Overripe / Rotten
  • Shows: Confidence percentage
  • Shows: Recommendation (eat now / use for baking / discard)
  • Saves result to your history
      │
      ▼
⑦ Temporary photo deleted from server
```

---

## The AI Model — explained simply

The AI was **trained** to recognise banana ripeness by looking at thousands of banana photos.

Think of it like teaching a child:
- Show them 400 overripe bananas → "this is overripe"
- Show them 500 ripe bananas → "this is ripe"
- Show them 400 rotten bananas → "this is rotten"

After seeing enough examples, the child (AI) can look at a new banana and make a good guess.

### What model is used?

The app uses **MobileNetV2** — a well-known AI model originally trained to recognise 1000 different objects (cats, cars, chairs, etc.). We took that model and added a small extra layer on top to teach it specifically about banana ripeness.

This technique is called **Transfer Learning** — reusing knowledge from one task to solve another. It's much faster than training from scratch.

```
MobileNetV2 (already knows about shapes, colours, textures)
      +
Small custom layer (trained to classify banana ripeness)
      =
Our banana ripeness model
```

### Training settings

| Setting | Value | What it means |
|---|---|---|
| Image size | 160 × 160 px | Each photo is resized to this before analysis |
| Batch size | 16 | Processes 16 photos at a time during training |
| Max epochs | 10 | Trains for up to 10 full passes through the dataset |
| Early stopping | Yes | Stops automatically if it stops improving |
| Confidence threshold | 60% | Won't give a result if less than 60% sure |

---

## The Banana Validation — why it matters

Without validation, if you uploaded a photo of an apple or a yellow balloon, the AI would still try to classify it as a banana. That would give a wrong answer.

So before running the expensive AI model, we run a **fast colour + shape check**:

```
Does the image have enough yellow/green/brown pixels?
      │
      ├─ No  → Reject immediately (not a banana)
      │
      └─ Yes → Is the shape elongated (not round like a balloon)?
                    │
                    ├─ No  → Reject (probably a balloon or ball)
                    │
                    └─ Yes → Does the colour vary naturally?
                                  │
                                  ├─ No  → Reject (solid flat colour = not a banana)
                                  │
                                  └─ Yes → Looks like a banana, run the AI ✓
```

This check runs in milliseconds and saves time by not loading the heavy AI model for obviously wrong images.

---

## Folder Structure — what each folder does

```
banana-ripeness-project/
│
├── 🖥️  frontend/          ← The website (what users see)
│   └── src/
│       ├── App.js         ← Main page: upload + results + history
│       ├── Login.js       ← Sign in page
│       ├── Signup.js      ← Create account page
│       └── *.css          ← Visual styling
│
├── ⚙️  backend/           ← The server (handles requests)
│   ├── server.js          ← All the server logic in one file
│   ├── users.db           ← Database (stores users + scan history)
│   └── uploads/           ← Temporary photo storage
│
├── 🧠  banana-ripeness-ml/ ← The AI brain
│   ├── train.py           ← Run this ONCE to train the model
│   ├── predict.py         ← Run automatically for each prediction
│   └── model/
│       ├── banana_model.h5  ← The trained AI (generated by train.py)
│       └── classes.json     ← The 3 class names
│
└── 📄  docs/              ← Documentation (you are here)
```

---

## User Accounts — how login works

```
Sign Up
  → You enter name, email, password
  → Password is scrambled (hashed) before saving
  → A random secret key (token) is created for you
  → Token saved in database + your browser

Every request after login
  → Your browser sends the token with every request
  → Server checks: "is this token in the database?"
  → Yes → allowed   No → rejected

Sign Out
  → Token deleted from your browser
  → You need to log in again to get a new token
```

Your password is **never stored as plain text**. It's converted into a scrambled string using bcrypt, so even if someone accessed the database they couldn't read your password.

---

## The Database — what gets saved

Two tables are stored in a file called `users.db`:

**Users table** — one row per account
```
id | name         | email              | password (scrambled) | token
1  | Sujal Shinde | sujal@example.com  | $2b$10$...           | a3f9...
```

**Predictions table** — one row per scan
```
id | user_id | image_name   | prediction | confidence | date
1  | 1       | banana.jpg   | Ripe       | 94.2%      | 2026-04-13 10:22
2  | 1       | photo2.jpg   | Overripe   | 87.5%      | 2026-04-13 10:45
```

---

## API Endpoints — what the server can do

Think of these as the "buttons" the frontend can press on the server:

| Action | Method + URL | Who can use it |
|---|---|---|
| Create account | `POST /api/auth/register` | Anyone |
| Log in | `POST /api/auth/login` | Anyone |
| Get my profile | `GET /api/auth/me` | Logged-in users |
| Analyse a banana | `POST /api/predict-ripeness` | Logged-in users |
| Get scan history | `GET /api/history` | Logged-in users |

### Example: Analysing a banana

**You send:**
```
POST /api/predict-ripeness
Authorization: Bearer your-secret-token
Body: image file (JPG/PNG)
```

**You get back (if successful):**
```json
{
  "prediction": "Ripe",
  "confidence": "94.2%",
  "all_probabilities": {
    "overripe": 2.1,
    "ripe": 94.2,
    "rotten": 3.7
  }
}
```

**You get back (if not a banana):**
```json
{
  "not_banana": true,
  "message": "This does not appear to be a banana."
}
```

---

## What each ripeness result means

| Result | Colour | What it means | What to do |
|---|---|---|---|
| 🟢 Raw / Unripe | Green | Not ready yet | Wait 2–3 days |
| 🟡 Ripe | Yellow | Perfect to eat | Eat now |
| 🟠 Overripe | Orange | Past peak but still usable | Make smoothies or banana bread |
| 🔴 Rotten | Red | Spoiled | Throw it away |

---

## How to run the project

### What you need installed first

| Tool | Why you need it | Download |
|---|---|---|
| Node.js (v18+) | Runs the backend server | nodejs.org |
| Python (3.10+) | Runs the AI model | python.org |
| npm | Installs JavaScript packages | Comes with Node.js |

### Step 1 — Train the AI (only needed once)

```bash
# Go into the ML folder
cd banana-ripeness-ml

# Create a Python environment (keeps packages separate)
python -m venv venv

# Activate it (Windows)
venv\Scripts\activate

# Install required Python packages
pip install -r requirements.txt

# Train the model (takes 5–20 minutes)
python train.py
```

When done, you'll see these new files:
- `model/banana_model.h5` — the trained AI
- `model/classes.json` — the class names

### Step 2 — Start the backend server

```bash
cd backend
npm install
node server.js
```

You should see:
```
✅ Connected to SQLite
✅ users table ready
✅ predictions table ready
🚀 Server running on http://localhost:5000
```

### Step 3 — Start the website

```bash
cd frontend
npm install
npm start
```

The website opens automatically at **http://localhost:3000**

---

## Common problems and fixes

| Problem | Likely cause | Fix |
|---|---|---|
| "Model not found" error | `train.py` hasn't been run yet | Run `python train.py` first |
| Website can't connect to server | Backend isn't running | Run `node server.js` in the backend folder |
| "Invalid file type" error | Uploaded a non-image file | Use JPG, PNG, or WEBP only |
| Prediction takes 15+ seconds | Normal — Python loads fresh each time | Wait, or set up a persistent Flask server |
| "This is not a banana" on a real banana | Photo is blurry or poorly lit | Take a clearer photo with good lighting |
| Login stops working on another device | Each login creates a new token | Log in again on the new device |

---

## Things to know about limitations

- **Slow predictions** — Each analysis takes 8–20 seconds because the AI model loads from scratch every time. This is a known limitation.
- **3 categories only** — The model only knows overripe, ripe, and rotten. It can't detect "slightly unripe" or other stages.
- **One session at a time** — Logging in on a new device logs you out of the previous one.
- **CPU only** — The AI runs on your computer's CPU, not a GPU. A GPU would be 10× faster.
- **Dataset path is hardcoded** — If you move the project to a different computer, you need to update the dataset path in `train.py`.

---

## Technologies used — in plain English

| Technology | What it is | Used for |
|---|---|---|
| **React** | A JavaScript library for building websites | The user interface |
| **Node.js** | JavaScript running on a server (not a browser) | The backend API |
| **Express** | A framework that makes Node.js easier to use | Handling web requests |
| **SQLite** | A simple database stored as a single file | Saving users and scan history |
| **bcrypt** | A password scrambling algorithm | Keeping passwords safe |
| **Python** | A programming language popular for AI | Running the AI model |
| **TensorFlow / Keras** | AI/ML libraries for Python | Building and running the neural network |
| **MobileNetV2** | A pre-trained image recognition model | The base of our banana classifier |
| **Pillow (PIL)** | A Python image processing library | Loading and resizing photos |
| **NumPy** | A Python maths library | Fast number crunching for the colour check |
| **Multer** | A Node.js file upload handler | Receiving photo uploads |

---

*Last updated: April 2026*
