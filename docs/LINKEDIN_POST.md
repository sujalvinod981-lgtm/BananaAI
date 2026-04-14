# LinkedIn Post — BananaAI

---

Excited to share a project I built from scratch — **BananaAI**, a full-stack AI web app that classifies banana ripeness from a photo.

Here's what it does:

You upload a banana image → the AI model tells you whether it's **Ripe**, **Overripe**, or **Rotten**, along with a confidence score and a recommendation on what to do with it.

**Tech stack:**
- React (frontend dashboard with drag-and-drop upload)
- Node.js + Express (REST API, JWT-style token auth)
- SQLite (user accounts + scan history)
- Python + TensorFlow/Keras (MobileNetV2 model, trained on a custom banana dataset)
- Flask (persistent ML server — keeps the model loaded in memory for fast inference)

**A few things I'm proud of:**

The model runs through a persistent Flask server so predictions come back in ~1–2 seconds instead of the 10–15 seconds it took when spawning a new Python process every time. Node.js automatically falls back to the spawn method if the Flask server is offline.

Predictions below 40% confidence are withheld — the app shows a warning instead of a wrong answer.

The dashboard shows per-class probability bars, a confidence meter, and a full scan history per user.

**What I learned:**
- How to integrate a Python ML model into a Node.js backend
- Handling model cold-start latency with a persistent inference server
- Building a clean auth flow (register, login, token-based protected routes)
- Designing a UI that actually communicates AI output in a way that makes sense to a user

This was a great end-to-end exercise — from training the model to deploying a working web app around it.

Happy to answer questions if you're building something similar.

#MachineLearning #Python #TensorFlow #React #NodeJS #AIProject #ComputerVision #FullStack #StudentProject
