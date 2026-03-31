const MS_DAY = 86400000;
const MS_4H = 4 * 3600 * 1000;
const MS_WEEK = 7 * MS_DAY;
/** Matches enforcement thresholds. */
const LIMIT_4H_MS = 1 * 3600 * 1000;
const LIMIT_24H_MS = 4 * 3600 * 1000;

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

function formatLimitPercent(last4hMs, last24hMs) {
  if (
    !Number.isFinite(last4hMs) ||
    !Number.isFinite(last24hMs) ||
    last4hMs < 0 ||
    last24hMs < 0
  ) {
    return "";
  }
  const pct4h = (last4hMs / LIMIT_4H_MS) * 100;
  const pct24h = (last24hMs / LIMIT_24H_MS) * 100;
  return `${Math.round(Math.max(pct4h, pct24h))}%`;
}

function updateLimitBar(last4hMs, last24hMs) {
  const fill = document.getElementById("limit-fill");
  const bar = document.getElementById("limit-bar");
  const pctEl = document.getElementById("limit-pct");
  if (!fill || !bar || !pctEl) return;

  const pct4h = Number.isFinite(last4hMs) && last4hMs >= 0 ? (last4hMs / LIMIT_4H_MS) * 100 : 0;
  const pct24h =
    Number.isFinite(last24hMs) && last24hMs >= 0 ? (last24hMs / LIMIT_24H_MS) * 100 : 0;
  const rawPct = Math.max(pct4h, pct24h);
  const widthPct = Math.min(100, Math.max(0, rawPct));
  fill.style.width = `${widthPct}%`;
  fill.classList.toggle("limit__fill--over", rawPct > 100);
  pctEl.textContent = formatLimitPercent(last4hMs, last24hMs);
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
    updateLimitBar(fourHourMs, lastDayMs);
  } catch {
    weekEl.textContent = "—";
    lastDayEl.textContent = "—";
    dayEl.textContent = "—";
    updateLimitBar(0, 0);
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
