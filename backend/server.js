const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");
const { runAgent } = require("./agent");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serves public/index.html at "/"

const SCRIPT_PATH = path.join(__dirname, "server-stats.sh");
const HISTORY_LIMIT = 100;
const history = []; // in-memory ring buffer of { timestamp, raw }

function getCurrentStats() {
  return new Promise((resolve, reject) => {
    exec(`sh ${SCRIPT_PATH}`, { timeout: 10000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      const snapshot = { timestamp: new Date().toISOString(), raw: stdout };
      history.push(snapshot);
      if (history.length > HISTORY_LIMIT) history.shift();
      resolve(stdout);
    });
  });
}

function getHistory(limit = 10) {
  return history.slice(-limit);
}

// Plain stats endpoint — the Vue dashboard polls this
app.get("/api/stats", async (req, res) => {
  try {
    const raw = await getCurrentStats();
    res.json({ timestamp: new Date().toISOString(), raw });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recent history — used for simple trend display
app.get("/api/history", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 20;
  res.json(getHistory(limit));
});

// Ask the AI agent a question about server health
app.post("/api/agent/ask", async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "question is required" });
  try {
    const answer = await runAgent(question, { getCurrentStats, getHistory });
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server monitor API listening on :${PORT}`));
