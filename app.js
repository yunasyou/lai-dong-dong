const STORAGE_KEY = "daily-video-checkin:v1";
const SETTINGS_KEY = "daily-video-checkin:settings:v1";
const TZ = "Asia/Taipei";
const DEFAULT_SETTINGS = {
  morningUrl: "https://www.youtube.com/watch?v=cacwri2wio4&t=2s",
  nightUrl: "https://www.youtube.com/watch?v=gOkCJ57IvNg"
};

const encouragements = [
  "今天的你有回到自己身邊。",
  "小小的一次完成，也是在照顧未來的你。",
  "不用完美，穩穩回來就很好。",
  "你正在把這件事變成自己的節奏。",
  "有做就算數，今天也被你接住了。",
  "慢慢來，但不要放掉自己。",
  "你又替自己存下一點力氣。",
  "這不是意志力考試，是溫柔的累積。"
];

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  encouragement: document.querySelector("#encouragement"),
  completionPercent: document.querySelector("#completionPercent"),
  completionRing: document.querySelector(".completion-ring"),
  morningButton: document.querySelector("#morningButton"),
  nightButton: document.querySelector("#nightButton"),
  morningState: document.querySelector("#morningState"),
  nightState: document.querySelector("#nightState"),
  fullDays: document.querySelector("#fullDays"),
  streakDays: document.querySelector("#streakDays"),
  monthDays: document.querySelector("#monthDays"),
  historyList: document.querySelector("#historyList"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsForm: document.querySelector("#settingsForm"),
  morningUrl: document.querySelector("#morningUrl"),
  nightUrl: document.querySelector("#nightUrl"),
  resetTodayButton: document.querySelector("#resetTodayButton"),
  rangeButtons: document.querySelectorAll("[data-range]"),
  confettiCanvas: document.querySelector("#confettiCanvas")
};

let records = loadJSON(STORAGE_KEY, {});
let storedSettings = loadJSON(SETTINGS_KEY, {});
let settings = {
  morningUrl: storedSettings.morningUrl || DEFAULT_SETTINGS.morningUrl,
  nightUrl: storedSettings.nightUrl || DEFAULT_SETTINGS.nightUrl
};
let lastCelebratedStreak = Number(localStorage.getItem("daily-video-checkin:lastCelebratedStreak") || 0);
let historyRange = 7;

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const pick = (type) => parts.find((part) => part.type === type).value;
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function formatDate(key) {
  const date = new Date(`${key}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-Hant-TW", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function addDays(key, amount) {
  const date = new Date(`${key}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function ensureToday() {
  const key = todayKey();
  records[key] = records[key] || { morning: false, night: false };
  return key;
}

function isFullDay(record) {
  return Boolean(record?.morning && record?.night);
}

function calculateStats(today) {
  const keys = Object.keys(records).sort();
  const fullDays = keys.filter((key) => isFullDay(records[key]));
  const currentMonth = today.slice(0, 7);
  let cursor = today;
  let streak = 0;

  while (isFullDay(records[cursor])) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    full: fullDays.length,
    streak,
    month: fullDays.filter((key) => key.startsWith(currentMonth)).length
  };
}

function render() {
  const today = ensureToday();
  const todayRecord = records[today];
  const completed = Number(todayRecord.morning) + Number(todayRecord.night);
  const percent = completed * 50;
  const stats = calculateStats(today);

  els.todayLabel.textContent = `完成 ${completed}/2`;
  els.encouragement.textContent = `${formatDate(today)}。${encouragements[Math.floor(Math.random() * encouragements.length)]}`;
  els.completionPercent.textContent = `${percent}%`;
  els.completionRing.style.setProperty("--progress", `${percent * 3.6}deg`);

  updateVideoButton(els.morningButton, els.morningState, todayRecord.morning);
  updateVideoButton(els.nightButton, els.nightState, todayRecord.night);

  els.fullDays.textContent = stats.full;
  els.streakDays.textContent = stats.streak;
  els.monthDays.textContent = stats.month;

  renderHistory(today);
  saveRecords();

  if (stats.streak >= 3 && stats.streak > lastCelebratedStreak) {
    lastCelebratedStreak = stats.streak;
    localStorage.setItem("daily-video-checkin:lastCelebratedStreak", String(lastCelebratedStreak));
    launchConfetti();
  }
}

function updateVideoButton(button, label, done) {
  button.classList.toggle("done", done);
  label.textContent = done ? "已完成" : "尚未完成";
}

function renderHistory(today) {
  els.rangeButtons.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.range) === historyRange);
  });

  const days = Array.from({ length: historyRange }, (_, index) => addDays(today, -index)).reverse();
  els.historyList.innerHTML = days.map((key) => {
    const record = records[key] || {};
    return `
      <div class="history-item">
        <div class="history-date">
          <span>${formatShortDate(key)}</span>
          <small>${formatWeekday(key)}</small>
        </div>
        <div class="badges" aria-label="${key} 完成狀態">
          <button class="badge ${record.morning ? "done" : ""}" type="button" data-date="${key}" data-period="morning">早</button>
          <button class="badge ${record.night ? "done" : ""}" type="button" data-date="${key}" data-period="night">晚</button>
        </div>
      </div>
    `;
  }).join("");
}

function formatShortDate(key) {
  const date = new Date(`${key}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-Hant-TW", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric"
  }).format(date);
}

function formatWeekday(key) {
  const date = new Date(`${key}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-Hant-TW", {
    timeZone: TZ,
    weekday: "short"
  }).format(date);
}

function handleVideo(period) {
  const url = settings[`${period}Url`];
  if (!url) {
    openSettings();
    return;
  }

  const today = ensureToday();
  records[today][period] = true;
  saveRecords();
  render();
  window.open(url, "_blank", "noopener,noreferrer");
}

function openSettings() {
  els.morningUrl.value = settings.morningUrl || "";
  els.nightUrl.value = settings.nightUrl || "";
  els.settingsDialog.showModal();
}

function launchConfetti() {
  const canvas = els.confettiCanvas;
  const context = canvas.getContext("2d");
  const colors = ["#f2bd5a", "#426a8f", "#6d8d6c", "#d97965", "#fffaf1"];
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * window.innerWidth,
    y: -20 - Math.random() * window.innerHeight * 0.4,
    size: 5 + Math.random() * 8,
    speed: 2 + Math.random() * 4,
    drift: -1.4 + Math.random() * 2.8,
    rotation: Math.random() * 360,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));
  let frame = 0;

  function resize() {
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  }

  function draw() {
    frame += 1;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    pieces.forEach((piece) => {
      piece.y += piece.speed;
      piece.x += piece.drift;
      piece.rotation += piece.speed * 3;
      context.save();
      context.translate(piece.x, piece.y);
      context.rotate((piece.rotation * Math.PI) / 180);
      context.fillStyle = piece.color;
      context.fillRect(-piece.size / 2, -piece.size / 3, piece.size, piece.size * 0.66);
      context.restore();
    });

    if (frame < 170) {
      requestAnimationFrame(draw);
    } else {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  resize();
  draw();
}

els.morningButton.addEventListener("click", () => handleVideo("morning"));
els.nightButton.addEventListener("click", () => handleVideo("night"));
els.settingsButton.addEventListener("click", openSettings);
els.resetTodayButton.addEventListener("click", () => {
  records[todayKey()] = { morning: false, night: false };
  saveRecords();
  render();
});

els.historyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-date][data-period]");
  if (!button) return;
  const { date, period } = button.dataset;
  records[date] = records[date] || { morning: false, night: false };
  records[date][period] = !records[date][period];
  saveRecords();
  render();
});

els.rangeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    historyRange = Number(button.dataset.range);
    render();
  });
});

els.settingsForm.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") {
    return;
  }
  settings = {
    morningUrl: els.morningUrl.value.trim() || DEFAULT_SETTINGS.morningUrl,
    nightUrl: els.nightUrl.value.trim() || DEFAULT_SETTINGS.nightUrl
  };
  saveSettings();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

render();
