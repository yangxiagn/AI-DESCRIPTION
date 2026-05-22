const APP_TITLE = "番茄钟";
const MODES = {
  work: { label: "专注时间" },
  short: { label: "短休息" },
  long: { label: "长休息" },
};
const DEFAULT_MINUTES = { work: 25, short: 5, long: 15 };
const RING_CIRCUMFERENCE = 2 * Math.PI * 88;
const LEGACY_STORAGE_KEY = "pomodoro-state-v1";
const SAVE_DEBOUNCE_MS = 500;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const timeEl = $("#time");
const modeLabelEl = $("#mode-label");
const ringProgress = $(".ring-progress");
const btnStart = $("#btn-start");
const btnPause = $("#btn-pause");
const btnReset = $("#btn-reset");
const pomodorosEl = $("#pomodoros");
const sessionsEl = $("#sessions");
const workMinInput = $("#work-min");
const shortMinInput = $("#short-min");
const longMinInput = $("#long-min");
const soundOnInput = $("#sound-on");
const autoNextInput = $("#auto-next");
const taskForm = $("#task-form");
const taskInput = $("#task-input");
const taskListEl = $("#task-list");
const taskEmptyEl = $("#task-empty");
const activeTaskHint = $("#active-task-hint");
const btnToggleTasks = $("#btn-toggle-tasks");

let mode = "work";
let totalSeconds = DEFAULT_MINUTES.work * 60;
let remainingSeconds = totalSeconds;
let timerId = null;
let pomodorosToday = 0;
let cycleCount = 0;
let tasks = [];
let activeTaskId = null;
let saveTimer = null;
let hydrated = false;

const api = window.pomodoroAPI;

function getDurations() {
  const parse = (input, fallback) =>
    Math.max(1, parseInt(input.value, 10) || fallback) * 60;
  return {
    work: parse(workMinInput, DEFAULT_MINUTES.work),
    short: parse(shortMinInput, DEFAULT_MINUTES.short),
    long: parse(longMinInput, DEFAULT_MINUTES.long),
  };
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function todayString() {
  return new Date().toDateString();
}

function findTask(id) {
  return tasks.find((t) => t.id === id);
}

function pickNextActiveTaskId() {
  const next = tasks.find((t) => !t.done);
  return next ? next.id : null;
}

function syncModeTabs() {
  $$(".mode-tab").forEach((tab) => {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active);
  });
}

function syncStatsUI() {
  pomodorosEl.textContent = String(pomodorosToday);
  sessionsEl.textContent = String(cycleCount);
}

function applyDurationForMode(resetRemaining = true) {
  const durations = getDurations();
  totalSeconds = durations[mode];
  if (resetRemaining) remainingSeconds = totalSeconds;
}

function updateTimerUI() {
  timeEl.textContent = formatTime(remainingSeconds);
  ringProgress.style.strokeDashoffset = String(
    RING_CIRCUMFERENCE * (1 - (totalSeconds > 0 ? remainingSeconds / totalSeconds : 0))
  );
  document.title = `${formatTime(remainingSeconds)} · ${APP_TITLE}`;
}

function updateDisplay() {
  modeLabelEl.textContent = MODES[mode].label;
  updateTimerUI();
}

function setMode(newMode, resetTime = true) {
  mode = newMode;
  document.body.dataset.mode = mode;
  syncModeTabs();
  if (resetTime) applyDurationForMode(true);
  updateDisplay();
  scheduleSave();
}

function playBell() {
  if (!soundOnInput.checked) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + duration);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    };
    playTone(523.25, 0, 0.15);
    playTone(659.25, 0.2, 0.2);
    playTone(783.99, 0.45, 0.35);
  } catch {
    /* AudioContext 不可用时跳过 */
  }
}

async function notifyComplete() {
  playBell();
  const body = `${MODES[mode].label}结束`;
  if (api?.notify) {
    await api.notify(APP_TITLE, body);
  }
}

function incrementTaskPomodoro() {
  const task = activeTaskId ? findTask(activeTaskId) : null;
  if (task && !task.done) {
    task.pomodoros = (task.pomodoros || 0) + 1;
    renderTasks();
  }
}

function onTimerComplete() {
  pause();
  notifyComplete();

  if (mode === "work") {
    pomodorosToday += 1;
    cycleCount += 1;
    syncStatsUI();
    incrementTaskPomodoro();
  }

  if (!autoNextInput.checked) {
    scheduleSave(true);
    return;
  }

  if (mode === "work") {
    const nextMode = cycleCount > 0 && cycleCount % 4 === 0 ? "long" : "short";
    setMode(nextMode);
    start();
  } else {
    setMode("work");
    start();
  }
  scheduleSave(true);
}

function tick() {
  if (remainingSeconds <= 0) {
    onTimerComplete();
    return;
  }
  remainingSeconds -= 1;
  updateTimerUI();
}

function start() {
  if (timerId) return;
  btnStart.hidden = true;
  btnPause.hidden = false;
  timerId = setInterval(tick, 1000);
  scheduleSave(true);
}

function pause() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  btnStart.hidden = false;
  btnPause.hidden = true;
  scheduleSave(true);
}

function reset() {
  pause();
  applyDurationForMode(true);
  updateDisplay();
  scheduleSave(true);
}

function buildPersistedState() {
  return {
    timer: {
      date: todayString(),
      mode,
      remainingSeconds,
      totalSeconds,
      pomodorosToday,
      cycleCount,
    },
    tasks,
    activeTaskId,
    settings: {
      work: workMinInput.value,
      short: shortMinInput.value,
      long: longMinInput.value,
      sound: soundOnInput.checked,
      autoNext: autoNextInput.checked,
      tasksCollapsed: document.body.classList.contains("tasks-collapsed"),
    },
  };
}

function scheduleSave(immediate = false) {
  if (!hydrated) return;
  clearTimeout(saveTimer);
  if (immediate) {
    persistState();
    return;
  }
  saveTimer = setTimeout(persistState, SAVE_DEBOUNCE_MS);
}

async function persistState() {
  const payload = buildPersistedState();
  if (api?.setState) {
    await api.setState(payload);
  } else {
    try {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("localStorage 保存失败", err);
    }
  }
}

function applySettings(settings) {
  workMinInput.value = settings.work ?? DEFAULT_MINUTES.work;
  shortMinInput.value = settings.short ?? DEFAULT_MINUTES.short;
  longMinInput.value = settings.long ?? DEFAULT_MINUTES.long;
  soundOnInput.checked = settings.sound !== false;
  autoNextInput.checked = settings.autoNext !== false;
  if (settings.tasksCollapsed) {
    document.body.classList.add("tasks-collapsed");
  }
}

function applyTimer(timer) {
  if (!timer) return;
  if (timer.date === todayString()) {
    pomodorosToday = timer.pomodorosToday ?? 0;
    cycleCount = timer.cycleCount ?? 0;
    syncStatsUI();
  }
  if (timer.mode && MODES[timer.mode]) {
    mode = timer.mode;
    document.body.dataset.mode = mode;
    syncModeTabs();
    totalSeconds = timer.totalSeconds ?? getDurations()[mode];
    remainingSeconds = Math.min(timer.remainingSeconds ?? totalSeconds, totalSeconds);
    updateDisplay();
  }
}

function migrateLegacyLocalStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.tasks) return null;
    return {
      timer: {
        date: data.date,
        mode: data.mode,
        remainingSeconds: data.remainingSeconds,
        totalSeconds: data.totalSeconds,
        pomodorosToday: data.pomodorosToday,
        cycleCount: data.cycleCount,
      },
      tasks: [],
      activeTaskId: null,
      settings: data.settings || {},
    };
  } catch {
    return null;
  }
}

async function loadState() {
  let data = api?.getState ? await api.getState() : null;
  if (!data?.timer && !data?.tasks?.length) {
    const migrated = migrateLegacyLocalStorage();
    if (migrated) {
      data = migrated;
      if (api?.setState) await api.setState(migrated);
    }
  }
  if (data) {
    applySettings(data.settings || {});
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    activeTaskId = data.activeTaskId ?? null;
    applyTimer(data.timer);
    renderTasks();
  } else {
    setMode("work");
  }
  hydrated = true;
  updateDisplay();
}

function getActiveTaskHint() {
  if (tasks.length === 0) return "点击任务设为当前专注项";
  const active = activeTaskId ? findTask(activeTaskId) : null;
  if (active && !active.done) return `当前专注：${active.title}`;
  if (activeTaskId) return "当前任务已完成，请选择其他任务";
  return "点击任务设为当前专注项";
}

function renderTasks() {
  taskListEl.innerHTML = "";
  const activeTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  activeTaskHint.textContent = getActiveTaskHint();
  if (tasks.length === 0) {
    taskEmptyEl.classList.remove("hidden");
    return;
  }
  taskEmptyEl.classList.add("hidden");

  const appendTask = (task) => {
    const li = document.createElement("li");
    li.className = "task-item";
    li.dataset.id = task.id;
    if (task.id === activeTaskId) li.classList.add("active");
    if (task.done) li.classList.add("done");

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task-check";
    check.checked = !!task.done;
    check.title = task.done ? "标记为未完成" : "标记为完成";
    check.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleTaskDone(task.id);
    });

    const body = document.createElement("div");
    body.className = "task-body";
    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;
    const meta = document.createElement("div");
    meta.className = "task-meta";
    const pomo = document.createElement("span");
    pomo.className = "task-pomo";
    pomo.textContent = String(task.pomodoros || 0);
    meta.append(pomo, document.createTextNode(" 个番茄"));
    body.append(title, meta);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "task-delete";
    del.textContent = "×";
    del.title = "删除";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });

    li.append(check, body, del);
    li.addEventListener("click", () => selectTask(task.id));
    taskListEl.appendChild(li);
  };

  activeTasks.forEach(appendTask);
  doneTasks.forEach(appendTask);
}

function addTask(title) {
  const trimmed = title.trim();
  if (!trimmed) return;
  const task = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: trimmed,
    pomodoros: 0,
    done: false,
  };
  tasks.unshift(task);
  if (!activeTaskId) activeTaskId = task.id;
  taskInput.value = "";
  renderTasks();
  scheduleSave(true);
}

function selectTask(id) {
  const task = findTask(id);
  if (!task || task.done) return;
  activeTaskId = id;
  renderTasks();
  scheduleSave(true);
}

function toggleTaskDone(id) {
  const task = findTask(id);
  if (!task) return;
  task.done = !task.done;
  if (task.done && activeTaskId === id) {
    activeTaskId = pickNextActiveTaskId();
  } else if (!task.done && !activeTaskId) {
    activeTaskId = id;
  }
  renderTasks();
  scheduleSave(true);
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  if (activeTaskId === id) activeTaskId = pickNextActiveTaskId();
  renderTasks();
  scheduleSave(true);
}

$$(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    pause();
    setMode(tab.dataset.mode);
  });
});

btnStart.addEventListener("click", start);
btnPause.addEventListener("click", pause);
btnReset.addEventListener("click", reset);

taskForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addTask(taskInput.value);
});

btnToggleTasks.addEventListener("click", () => {
  document.body.classList.toggle("tasks-collapsed");
  scheduleSave(true);
});

[workMinInput, shortMinInput, longMinInput].forEach((input) => {
  input.addEventListener("change", () => {
    if (!timerId) reset();
    scheduleSave(true);
  });
});

[soundOnInput, autoNextInput].forEach((input) => {
  input.addEventListener("change", () => scheduleSave(true));
});

window.addEventListener("beforeunload", () => {
  if (hydrated) persistState();
});

ringProgress.style.strokeDasharray = String(RING_CIRCUMFERENCE);
document.body.dataset.mode = "work";

loadState().catch(() => {
  hydrated = true;
  setMode("work");
});
