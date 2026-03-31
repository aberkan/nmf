const MS_DAY = 86400000;
const MS_4H = 4 * 3600 * 1000;
const MS_WEEK = 7 * MS_DAY;
/** Matches planned Phase 4 enforcement (10h / 24h). */
const DAILY_LIMIT_MS = 10 * 3600 * 1000;

/**
 * Human-readable duration: e.g. "4h 12m", "1d 2h 5m", "45s".
 * @param {number} ms
 */
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  if (totalSec === 0) return "0s";

  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (days > 0) {
    const parts = [`${days}d`];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(" ");
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

function formatLimitPercent(dayMs) {
  if (!Number.isFinite(dayMs) || dayMs < 0) return "";
  const pct = (dayMs / DAILY_LIMIT_MS) * 100;
  return `${Math.round(pct)}%`;
}

function updateLimitBar(dayMs) {
  const fill = document.getElementById("limit-fill");
  const bar = document.getElementById("limit-bar");
  const pctEl = document.getElementById("limit-pct");
  if (!fill || !bar || !pctEl) return;

  const rawPct = Number.isFinite(dayMs) && dayMs >= 0 ? (dayMs / DAILY_LIMIT_MS) * 100 : 0;
  const widthPct = Math.min(100, Math.max(0, rawPct));
  fill.style.width = `${widthPct}%`;
  fill.classList.toggle("limit__fill--over", rawPct > 100);
  pctEl.textContent = formatLimitPercent(dayMs);
  bar.setAttribute("aria-valuenow", String(Math.round(widthPct)));
}

async function getUsageSince(sinceMs) {
  const res = await chrome.runtime.sendMessage({
    type: "GET_USAGE",
    sinceMs,
  });
  return typeof res?.ms === "number" ? res.ms : 0;
}

async function refresh() {
  const weekEl = document.getElementById("week-usage");
  const lastDayEl = document.getElementById("last-day-usage");
  const dayEl = document.getElementById("day-usage");
  if (!weekEl || !lastDayEl || !dayEl) return;

  try {
    const now = Date.now();
    const [weekMs, lastDayMs, fourHourMs] = await Promise.all([
      getUsageSince(now - MS_WEEK),
      getUsageSince(now - MS_DAY),
      getUsageSince(now - MS_4H),
    ]);
    weekEl.textContent = formatDuration(weekMs);
    lastDayEl.textContent = formatDuration(lastDayMs);
    dayEl.textContent = formatDuration(fourHourMs);
    updateLimitBar(lastDayMs);
  } catch {
    weekEl.textContent = "—";
    lastDayEl.textContent = "—";
    dayEl.textContent = "—";
    updateLimitBar(0);
  }
}

let pollId = null;

function startPolling() {
  if (pollId != null) return;
  pollId = window.setInterval(() => {
    void refresh();
  }, 15000);
}

function stopPolling() {
  if (pollId != null) {
    clearInterval(pollId);
    pollId = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    void refresh();
    startPolling();
  } else {
    stopPolling();
  }
});

void refresh();
startPolling();
