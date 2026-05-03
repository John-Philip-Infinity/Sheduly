import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";

const api = axios.create({ baseURL: "http://localhost:4000/api" });
const statuses = ["Active", "Planned", "Confirmed"];
const plannerViews = [
  { id: "planner", icon: "📅", label: "Planner" },
  { id: "weekly", icon: "📊", label: "Weekly" },
  { id: "stats", icon: "📈", label: "Stats" },
  { id: "exams", icon: "🎓", label: "Exams" },
  { id: "pomodoro", icon: "⏱️", label: "Pomodoro" },
  { id: "ai-coach", icon: "✨", label: "AI Coach", badge: "NEW" }
];

const heroVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatCalendarLabel(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getWeekDays(date = new Date()) {
  const current = new Date(date);
  const first = current.getDate() - current.getDay();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(current.setDate(first + i));
    days.push(day.toISOString().slice(0, 10));
  }
  return days;
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [view, setView] = useState("planner");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [theme, setTheme] = useState("dark");
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroSessions, setPomodoroSessions] = useState(0);
  const [exams, setExams] = useState([]);
  const [examForm, setExamForm] = useState({ title: "", date: getToday(), subject: "", duration: "120" });
  const [scheduleForm, setScheduleForm] = useState({ title: "", date: getToday(), time: "09:00", details: "", status: "Planned" });
  const [authForm, setAuthForm] = useState({ email: "demo@sheduley.com", password: "shedley123" });
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("shedley-token");
    const storedTheme = localStorage.getItem("shedley-theme") || "dark";
    setTheme(storedTheme);
    document.documentElement.setAttribute("data-theme", storedTheme);
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    async function restoreSession() {
      if (!token) return;
      setLoading(true);
      try {
        const response = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data.user);
        await refreshSchedule(token);
      } catch {
        setToken("");
        setUser(null);
        localStorage.removeItem("shedley-token");
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, [token]);

  useEffect(() => {
    if (!pomodoroActive) return;
    const interval = setInterval(() => {
      setPomodoroTime((prev) => {
        if (prev <= 1) {
          setPomodoroActive(false);
          setPomodoroSessions((s) => s + 1);
          setPomodoroTime(25 * 60);
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomodoroActive]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  async function refreshSchedule(currentToken) {
    try {
      const response = await api.get("/schedule", {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setSchedule(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  const handleSignIn = async (event) => {
    event.preventDefault();
    setAuthError("");
    try {
      const response = await api.post("/auth/signin", authForm);
      setToken(response.data.token);
      localStorage.setItem("shedley-token", response.data.token);
      setUser(response.data.user);
      setView("planner");
      await refreshSchedule(response.data.token);
    } catch (error) {
      setAuthError(error?.response?.data?.error || "Unable to sign in.");
    }
  };

  const handleSignOut = async () => {
    try {
      await api.post("/auth/signout", {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      console.warn("Sign out error", error);
    }
    setToken("");
    setUser(null);
    setSchedule([]);
    localStorage.removeItem("shedley-token");
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("shedley-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const dailyItems = useMemo(
    () => schedule.filter((entry) => entry.date === selectedDate),
    [schedule, selectedDate]
  );

  const weekDays = useMemo(() => getWeekDays(new Date(selectedDate)), [selectedDate]);
  const weeklyItems = useMemo(
    () => schedule.filter((entry) => weekDays.includes(entry.date)),
    [schedule, weekDays]
  );

  const monthStats = useMemo(() => {
    const [year, month] = selectedDate.split("-");
    const filtered = schedule.filter((entry) => entry.date.startsWith(`${year}-${month}-`));
    const counts = filtered.reduce((acc, item) => {
      acc[item.date] = (acc[item.date] || 0) + 1;
      return acc;
    }, {});
    return { year: Number(year), month: Number(month), counts, entries: filtered };
  }, [schedule, selectedDate]);

  const calendarDays = useMemo(() => {
    const { year, month, counts } = monthStats;
    const dayCount = new Date(year, month, 0).getDate();
    const days = [];
    for (let day = 1; day <= dayCount; day += 1) {
      const dayKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({ day, date: dayKey, count: counts[dayKey] || 0 });
    }
    return days;
  }, [monthStats]);

  const metrics = useMemo(
    () => ({
      total: schedule.length,
      active: schedule.filter((item) => item.status === "Active").length,
      planned: schedule.filter((item) => item.status === "Planned").length,
      confirmed: schedule.filter((item) => item.status === "Confirmed").length,
      completion: schedule.length > 0 ? Math.round((schedule.filter((i) => i.status === "Confirmed").length / schedule.length) * 100) : 0
    }),
    [schedule]
  );

  const pomodoroMinutes = Math.floor(pomodoroTime / 60);
  const pomodoroSeconds = pomodoroTime % 60;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!scheduleForm.title || !scheduleForm.time || !scheduleForm.date) return;

    try {
      const response = await api.post(
        "/schedule",
        {
          title: scheduleForm.title,
          time: scheduleForm.time,
          date: scheduleForm.date,
          details: scheduleForm.details,
          status: scheduleForm.status
        },
        { headers: authHeaders }
      );
      setSchedule((prev) => [response.data, ...prev]);
      setScheduleForm({ title: "", date: selectedDate, time: "09:00", details: "", status: "Planned" });
    } catch (error) {
      console.error(error);
    }
  };

  const handleExamSubmit = (event) => {
    event.preventDefault();
    if (!examForm.title || !examForm.date) return;
    const exam = {
      id: Date.now().toString(),
      ...examForm,
      durationMinutes: Number(examForm.duration)
    };
    setExams((prev) => [exam, ...prev]);
    setExamForm({ title: "", date: getToday(), subject: "", duration: "120" });
  };

  const removeItem = async (id) => {
    try {
      await api.delete(`/schedule/${id}`, { headers: authHeaders });
      setSchedule((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const handleDayNavigation = (offset) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + offset);
    setSelectedDate(next.toISOString().slice(0, 10));
  };

  const renderContent = () => {
    if (view === "weekly") {
      return (
        <div className="weekly-view">
          <h2>Weekly Overview</h2>
          <div className="week-grid">
            {weekDays.map((day) => {
              const dayItems = schedule.filter((entry) => entry.date === day);
              return (
                <div key={day} className="week-day">
                  <h4>{formatCalendarLabel(day)}</h4>
                  <div className="day-items">
                    {dayItems.length === 0 ? (
                      <p className="empty-text">No plans</p>
                    ) : (
                      dayItems.map((item) => (
                        <div key={item.id} className="mini-card">
                          <span className={`pill pill-${item.status.toLowerCase()}`}>{item.time}</span>
                          <p>{item.title}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (view === "stats") {
      return (
        <div className="stats-view">
          <h2>Your Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <p>Completion Rate</p>
              <strong>{metrics.completion}%</strong>
            </div>
            <div className="stat-card">
              <p>Pomodoro Sessions</p>
              <strong>{pomodoroSessions}</strong>
            </div>
            <div className="stat-card">
              <p>Total Exams</p>
              <strong>{exams.length}</strong>
            </div>
            <div className="stat-card">
              <p>Scheduled Items</p>
              <strong>{metrics.total}</strong>
            </div>
          </div>
        </div>
      );
    }

    if (view === "exams") {
      return (
        <div className="exams-view">
          <h2>Exam Prep</h2>
          <form className="exam-form" onSubmit={handleExamSubmit}>
            <input
              type="text"
              placeholder="Exam title"
              value={examForm.title}
              onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
            />
            <input
              type="text"
              placeholder="Subject"
              value={examForm.subject}
              onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })}
            />
            <input
              type="date"
              value={examForm.date}
              onChange={(e) => setExamForm({ ...examForm, date: e.target.value })}
            />
            <input
              type="number"
              placeholder="Duration (minutes)"
              value={examForm.duration}
              onChange={(e) => setExamForm({ ...examForm, duration: e.target.value })}
            />
            <button type="submit" className="primary-button">Add Exam</button>
          </form>
          <div className="exams-list">
            {exams.map((exam) => (
              <div key={exam.id} className="exam-card">
                <h3>{exam.title}</h3>
                <p>{exam.subject}</p>
                <p className="exam-date">{exam.date} · {exam.durationMinutes} min</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (view === "pomodoro") {
      return (
        <div className="pomodoro-view">
          <h2>Pomodoro Timer</h2>
          <div className="pomodoro-display">
            <div className="timer-circle">
              <span className="time">{String(pomodoroMinutes).padStart(2, "0")}:{String(pomodoroSeconds).padStart(2, "0")}</span>
            </div>
            <p>Sessions completed: {pomodoroSessions}</p>
            <div className="pomodoro-controls">
              <button className="primary-button" onClick={() => setPomodoroActive(!pomodoroActive)}>
                {pomodoroActive ? "Pause" : "Start"}
              </button>
              <button className="ghost-button" onClick={() => { setPomodoroTime(25 * 60); setPomodoroActive(false); }}>
                Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (view === "ai-coach") {
      return (
        <div className="ai-coach-view">
          <h2>✨ AI Coach</h2>
          <div className="ai-card">
            <p>Your AI Coach analyzes your schedule patterns and productivity metrics to provide personalized recommendations.</p>
            <div className="coach-tips">
              <h4>Today's Tips:</h4>
              <ul>
                <li>✓ You have {dailyItems.length} items scheduled for today.</li>
                <li>✓ Complete {metrics.planned} planned items to boost productivity.</li>
                <li>✓ Try a Pomodoro session to stay focused.</li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="schedule-list">
        {schedule.length === 0 ? (
          <div className="empty-state">No schedule items yet. Add a plan to launch your workflow.</div>
        ) : (
          <AnimatePresence>
            {dailyItems.length === 0 ? (
              <div className="empty-state">No items for {formatCalendarLabel(selectedDate)}. Add one to get started.</div>
            ) : (
              dailyItems.map((item) => (
                <motion.article
                  key={item.id}
                  className="schedule-card"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="card-heading">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.time}</p>
                    </div>
                    <span className={`pill pill-${item.status.toLowerCase()}`}>{item.status}</span>
                  </div>
                  <p>{item.details}</p>
                  <button className="ghost-button" onClick={() => removeItem(item.id)}>
                    Remove slot
                  </button>
                </motion.article>
              ))
            )}
          </AnimatePresence>
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="page-shell">
        <motion.header className="hero" variants={heroVariants} initial="hidden" animate="visible">
          <div className="hero-glow" />
          <div className="hero-content">
            <p className="eyebrow">Scheduly</p>
            <h1>Sign in to unlock the full planner experience.</h1>
            <p className="hero-copy">
              Access weekly views, statistics, exam prep, Pomodoro timer, and AI-powered coaching.
            </p>
          </div>
        </motion.header>

        <section className="auth-card">
          <div className="panel-header">
            <div>
              <h2>Sign in</h2>
              <p>Demo: demo@sheduley.com / shedley123</p>
            </div>
          </div>

          <form className="schedule-form" onSubmit={handleSignIn}>
            <label>
              Email
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                placeholder="Enter your password"
              />
            </label>
            <button type="submit" className="primary-button">
              Sign in
            </button>
            {authError && <p className="error-text">{authError}</p>}
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <header className="top-header">
        <div className="header-left">
          <h1 className="logo">📅 Scheduly</h1>
        </div>

        <nav className="nav-tabs">
          {plannerViews.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab ${view === tab.id ? "active" : ""}`}
              onClick={() => setView(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && <span className="badge">{tab.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="header-right">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button className="user-btn" onClick={handleSignOut}>
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </button>
        </div>
      </header>

      <section className="metrics-grid">
        {[
          { label: "Total plans", value: metrics.total, accent: "#c67cff" },
          { label: "Active", value: metrics.active, accent: "#55c7ff" },
          { label: "Planned", value: metrics.planned, accent: "#ffb547" },
          { label: "Confirmed", value: metrics.confirmed, accent: "#5af9b3" }
        ].map((metric) => (
          <motion.article
            key={metric.label}
            className="metric-card"
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 250, damping: 18 }}
          >
            <div className="metric-icon" style={{ background: metric.accent }} />
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
          </motion.article>
        ))}
      </section>

      <main className="layout-grid">
        <motion.div className="schedule-panel" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
          <div className="panel-header">
            <div>
              <h2>{plannerViews.find((option) => option.id === view)?.label}</h2>
              {view === "planner" && (
                <div className="date-controls">
                  <button className="ghost-button" onClick={() => handleDayNavigation(-1)}>
                    ← Prev
                  </button>
                  <span>{formatCalendarLabel(selectedDate)}</span>
                  <button className="ghost-button" onClick={() => handleDayNavigation(1)}>
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>

          {loading ? <div className="loading-state">Loading dashboard...</div> : renderContent()}
        </motion.div>

        <motion.aside className="form-panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
          <div className="panel-header">
            <div>
              <h2>New plan</h2>
              <p>Add a date-based item to your schedule.</p>
            </div>
            <span className="status-badge status-soft">Create</span>
          </div>

          <form onSubmit={handleSubmit} className="schedule-form">
            <label>
              Title
              <input
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                placeholder="Write your next session"
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={scheduleForm.date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
              />
            </label>
            <label>
              Time
              <input
                type="time"
                value={scheduleForm.time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
              />
            </label>
            <label>
              Status
              <select
                value={scheduleForm.status}
                onChange={(e) => setScheduleForm({ ...scheduleForm, status: e.target.value })}
              >
                {statuses.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Details
              <textarea
                value={scheduleForm.details}
                onChange={(e) => setScheduleForm({ ...scheduleForm, details: e.target.value })}
                placeholder="Describe the plan or goal."
                rows="4"
              />
            </label>
            <button type="submit" className="primary-button">
              Add schedule
            </button>
          </form>

          <motion.div className="glow-panel" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 4 }}>
            <p>Stay productive with Scheduly — plan, track, and achieve your goals.</p>
          </motion.div>
        </motion.aside>
      </main>
    </div>
  );
}

export default App;


const heroVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatCalendarLabel(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [schedule, setSchedule] = useState([]);
  const [view, setView] = useState("board");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [scheduleForm, setScheduleForm] = useState({ title: "", date: getToday(), time: "09:00", details: "", status: "Planned" });
  const [authForm, setAuthForm] = useState({ email: "demo@sheduley.com", password: "shedley123" });
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("shedley-token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    async function restoreSession() {
      if (!token) return;
      setLoading(true);
      try {
        const response = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUser(response.data.user);
        await refreshSchedule(token);
      } catch {
        setToken("");
        setUser(null);
        localStorage.removeItem("shedley-token");
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, [token]);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  async function refreshSchedule(currentToken) {
    try {
      const response = await api.get("/schedule", {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      setSchedule(response.data);
    } catch (error) {
      console.error(error);
    }
  }

  const handleSignIn = async (event) => {
    event.preventDefault();
    setAuthError("");
    try {
      const response = await api.post("/auth/signin", authForm);
      setToken(response.data.token);
      localStorage.setItem("shedley-token", response.data.token);
      setUser(response.data.user);
      setView("board");
      await refreshSchedule(response.data.token);
    } catch (error) {
      setAuthError(error?.response?.data?.error || "Unable to sign in.");
    }
  };

  const handleSignOut = async () => {
    try {
      await api.post(
        "/auth/signout",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.warn("Sign out error", error);
    }
    setToken("");
    setUser(null);
    setSchedule([]);
    localStorage.removeItem("shedley-token");
  };

  const dailyItems = useMemo(
    () => schedule.filter((entry) => entry.date === selectedDate),
    [schedule, selectedDate]
  );

  const monthStats = useMemo(() => {
    const [year, month] = selectedDate.split("-");
    const filtered = schedule.filter((entry) => entry.date.startsWith(`${year}-${month}-`));
    const counts = filtered.reduce((acc, item) => {
      acc[item.date] = (acc[item.date] || 0) + 1;
      return acc;
    }, {});
    return { year: Number(year), month: Number(month), counts, entries: filtered };
  }, [schedule, selectedDate]);

  const calendarDays = useMemo(() => {
    const { year, month, counts } = monthStats;
    const dayCount = new Date(year, month, 0).getDate();
    const days = [];
    for (let day = 1; day <= dayCount; day += 1) {
      const dayKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      days.push({ day, date: dayKey, count: counts[dayKey] || 0 });
    }
    return days;
  }, [monthStats]);

  const metrics = useMemo(
    () => ({
      total: schedule.length,
      active: schedule.filter((item) => item.status === "Active").length,
      planned: schedule.filter((item) => item.status === "Planned").length,
      confirmed: schedule.filter((item) => item.status === "Confirmed").length
    }),
    [schedule]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!scheduleForm.title || !scheduleForm.time || !scheduleForm.date) return;

    try {
      const response = await api.post(
        "/schedule",
        {
          title: scheduleForm.title,
          time: scheduleForm.time,
          date: scheduleForm.date,
          details: scheduleForm.details,
          status: scheduleForm.status
        },
        { headers: authHeaders }
      );
      setSchedule((prev) => [response.data, ...prev]);
      setScheduleForm({ title: "", date: selectedDate, time: "09:00", details: "", status: "Planned" });
      setView("board");
    } catch (error) {
      console.error(error);
    }
  };

  const removeItem = async (id) => {
    try {
      await api.delete(`/schedule/${id}`, { headers: authHeaders });
      setSchedule((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const handleDayNavigation = (offset) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + offset);
    setSelectedDate(next.toISOString().slice(0, 10));
  };

  const renderPlannerPanel = () => {
    if (view === "daily") {
      return (
        <div className="daily-planner">
          <div className="daily-header">
            <div>
              <h3>Daily Planner</h3>
              <p>{formatCalendarLabel(selectedDate)}</p>
            </div>
            <div className="date-controls">
              <button className="ghost-button" onClick={() => handleDayNavigation(-1)}>
                Previous
              </button>
              <button className="ghost-button" onClick={() => handleDayNavigation(1)}>
                Next
              </button>
            </div>
          </div>

          {dailyItems.length === 0 ? (
            <div className="empty-state">No plans for this day. Add one to get started.</div>
          ) : (
            <AnimatePresence>
              {dailyItems.map((item) => (
                <motion.article
                  key={item.id}
                  className="schedule-card"
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  whileHover={{ scale: 1.01 }}
                >
                  <div className="card-heading">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.time}</p>
                    </div>
                    <span className={`pill pill-${item.status.toLowerCase()}`}>{item.status}</span>
                  </div>
                  <p>{item.details}</p>
                  <button className="ghost-button" onClick={() => removeItem(item.id)}>
                    Remove slot
                  </button>
                </motion.article>
              ))}
            </AnimatePresence>
          )}
        </div>
      );
    }

    if (view === "monthly") {
      return (
        <div className="monthly-planner">
          <div className="daily-header">
            <div>
              <h3>Monthly Planner</h3>
              <p>{new Date(selectedDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
            </div>
            <div className="month-summary">
              <span>{calendarDays.filter((day) => day.count > 0).length} active days</span>
              <span>{monthStats.entries.length} total plans</span>
            </div>
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day) => (
              <button
                key={day.date}
                type="button"
                className={`calendar-day ${day.date === selectedDate ? "selected" : ""} ${day.count > 0 ? "has-events" : ""}`}
                onClick={() => setSelectedDate(day.date)}
              >
                <span>{day.day}</span>
                {day.count > 0 && <small>{day.count} plan{day.count > 1 ? "s" : ""}</small>}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="schedule-list">
        {schedule.length === 0 ? (
          <div className="empty-state">No schedule items yet. Add a plan to launch your workflow.</div>
        ) : (
          <AnimatePresence>
            {schedule.map((item) => (
              <motion.article
                key={item.id}
                className="schedule-card"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
                whileHover={{ scale: 1.01 }}
              >
                <div className="card-heading">
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.date} · {item.time}</p>
                  </div>
                  <span className={`pill pill-${item.status.toLowerCase()}`}>{item.status}</span>
                </div>
                <p>{item.details}</p>
                <button className="ghost-button" onClick={() => removeItem(item.id)}>
                  Remove slot
                </button>
              </motion.article>
            ))}
          </AnimatePresence>
        )}
      </div>
    );
  };

  if (!user) {
    return (
      <div className="page-shell">
        <motion.header className="hero" variants={heroVariants} initial="hidden" animate="visible">
          <div className="hero-glow" />
          <div className="hero-content">
            <p className="eyebrow">Shedley</p>
            <h1>Sign in to unlock the Shedley planner experience.</h1>
            <p className="hero-copy">
              Use the demo account below or sign in with your own credentials to access daily and monthly planning.
            </p>
          </div>
        </motion.header>

        <section className="auth-card">
          <div className="panel-header">
            <div>
              <h2>Sign in</h2>
              <p>Demo: demo@sheduley.com / shedley123</p>
            </div>
          </div>

          <form className="schedule-form" onSubmit={handleSignIn}>
            <label>
              Email
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                placeholder="Enter your password"
              />
            </label>
            <button type="submit" className="primary-button">
              Sign in
            </button>
            {authError && <p className="error-text">{authError}</p>}
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <motion.header className="hero" variants={heroVariants} initial="hidden" animate="visible">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-topbar">
            <p className="eyebrow">Shedley</p>
            <div className="hero-actions">
              <span className="user-chip">Signed in as {user.name}</span>
              <button className="ghost-button" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          </div>
          <h1>Plan your month, own your day.</h1>
          <p className="hero-copy">
            Monthly and daily planners combine with an animated scheduler and secure sign in/out workflow.
          </p>
        </div>
      </motion.header>

      <section className="metrics-grid">
        {[
          { label: "Total plans", value: metrics.total, accent: "#c67cff" },
          { label: "Active", value: metrics.active, accent: "#55c7ff" },
          { label: "Planned", value: metrics.planned, accent: "#ffb547" },
          { label: "Confirmed", value: metrics.confirmed, accent: "#5af9b3" }
        ].map((metric) => (
          <motion.article
            key={metric.label}
            className="metric-card"
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 250, damping: 18 }}
          >
            <div className="metric-icon" style={{ background: metric.accent }} />
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
          </motion.article>
        ))}
      </section>

      <main className="layout-grid">
        <motion.div className="schedule-panel" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
          <div className="panel-header">
            <div>
              <h2>{plannerViews.find((option) => option.id === view)?.label}</h2>
              <p>Use the planner tab controls to switch between board, daily, and monthly views.</p>
            </div>
            <div className="tab-row">
              {plannerViews.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`tab-button ${option.id === view ? "active" : ""}`}
                  onClick={() => setView(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? <div className="loading-state">Loading dashboard...</div> : renderPlannerPanel()}
        </motion.div>

        <motion.aside className="form-panel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
          <div className="panel-header">
            <div>
              <h2>New plan</h2>
              <p>Add a schedule item to your daily or monthly planner.</p>
            </div>
            <span className="status-badge status-soft">Create</span>
          </div>

          <form onSubmit={handleSubmit} className="schedule-form">
            <label>
              Title
              <input
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                placeholder="Write your next session"
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={scheduleForm.date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
              />
            </label>
            <label>
              Time
              <input
                type="time"
                value={scheduleForm.time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
              />
            </label>
            <label>
              Status
              <select
                value={scheduleForm.status}
                onChange={(e) => setScheduleForm({ ...scheduleForm, status: e.target.value })}
              >
                {statuses.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Details
              <textarea
                value={scheduleForm.details}
                onChange={(e) => setScheduleForm({ ...scheduleForm, details: e.target.value })}
                placeholder="Describe the plan or goal."
                rows="4"
              />
            </label>
            <button type="submit" className="primary-button">
              Add schedule
            </button>
          </form>

          <motion.div className="glow-panel" animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 4 }}>
            <p>Every interaction in Shedley is designed to feel alive — from button hover shimmer to motion-driven cards.</p>
          </motion.div>
        </motion.aside>
      </main>
    </div>
  );
}

export default App;
