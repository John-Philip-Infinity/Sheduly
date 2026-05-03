import express from "express";
import cors from "cors";
import morgan from "morgan";
import { v4 as uuid } from "uuid";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan("tiny"));

const users = [
  {
    id: uuid(),
    name: "Demo User",
    email: "demo@sheduley.com",
    password: "shedley123"
  }
];

const sessions = new Map();

const schedule = [
  {
    id: uuid(),
    ownerId: users[0].id,
    title: "Morning Standup",
    date: "2026-05-03",
    time: "08:30",
    status: "Active",
    details: "Align on priorities, blockers, and momentum."
  },
  {
    id: uuid(),
    ownerId: users[0].id,
    title: "Design Sprint Review",
    date: "2026-05-03",
    time: "11:00",
    status: "Planned",
    details: "Review UX flow and animation storyboards."
  },
  {
    id: uuid(),
    ownerId: users[0].id,
    title: "Client Demo",
    date: "2026-05-03",
    time: "15:15",
    status: "Confirmed",
    details: "Showcase the Shedley experience with motion-driven interface."
  }
];

function getToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function authenticate(req, res, next) {
  const token = getToken(req);
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const userId = sessions.get(token);
  const user = users.find((entry) => entry.id === userId);
  if (!user) {
    return res.status(401).json({ error: "Session invalid." });
  }

  req.user = { id: user.id, name: user.name, email: user.email };
  req.token = token;
  next();
}

app.post("/api/auth/signin", (req, res) => {
  const { email, password } = req.body;
  const user = users.find((entry) => entry.email === email && entry.password === password);

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = uuid();
  sessions.set(token, user.id);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  });
});

app.post("/api/auth/signout", authenticate, (req, res) => {
  sessions.delete(req.token);
  res.json({ message: "Signed out successfully." });
});

app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

function getUserSchedule(userId) {
  return schedule.filter((entry) => entry.ownerId === userId);
}

app.get("/api/schedule", authenticate, (req, res) => {
  res.json(getUserSchedule(req.user.id));
});

app.get("/api/schedule/daily", authenticate, (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: "Query parameter date is required." });
  }
  const items = getUserSchedule(req.user.id).filter((entry) => entry.date === date);
  res.json(items);
});

app.get("/api/schedule/monthly", authenticate, (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) {
    return res.status(400).json({ error: "Query parameters year and month are required." });
  }

  const monthString = month.padStart(2, "0");
  const items = getUserSchedule(req.user.id).filter((entry) => entry.date.startsWith(`${year}-${monthString}-`));
  res.json(items);
});

app.post("/api/schedule", authenticate, (req, res) => {
  const { title, time, date, details, status } = req.body;
  if (!title || !time || !date) {
    return res.status(400).json({ error: "Title, time, and date are required." });
  }

  const entry = {
    id: uuid(),
    ownerId: req.user.id,
    title,
    date,
    time,
    status: status || "Planned",
    details: details || "No additional details provided."
  };
  schedule.unshift(entry);
  res.status(201).json(entry);
});

app.put("/api/schedule/:id", authenticate, (req, res) => {
  const { id } = req.params;
  const item = schedule.find((entry) => entry.id === id && entry.ownerId === req.user.id);
  if (!item) {
    return res.status(404).json({ error: "Schedule item not found." });
  }

  const { title, time, date, details, status } = req.body;
  if (title) item.title = title;
  if (time) item.time = time;
  if (date) item.date = date;
  if (details) item.details = details;
  if (status) item.status = status;

  res.json(item);
});

app.delete("/api/schedule/:id", authenticate, (req, res) => {
  const { id } = req.params;
  const index = schedule.findIndex((entry) => entry.id === id && entry.ownerId === req.user.id);
  if (index === -1) {
    return res.status(404).json({ error: "Schedule item not found." });
  }
  const [removed] = schedule.splice(index, 1);
  res.json({ removed });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.listen(PORT, () => {
  console.log(`Shedley backend listening on http://localhost:${PORT}`);
});
