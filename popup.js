const MS_DAY = 86400000;
const MS_WEEK = 7 * MS_DAY;

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${totalSec}s`;
}

async function getUsageSince(sinceMs) {
  const res = await chrome.runtime.sendMessage({
    type: "GET_USAGE",
    sinceMs,
  });
  return typeof res?.ms === "number" ? res.ms : 0;
}

async function refresh() {
  const now = Date.now();
  const [weekMs, dayMs] = await Promise.all([
    getUsageSince(now - MS_WEEK),
    getUsageSince(now - MS_DAY),
  ]);
  document.getElementById("week-usage").textContent = formatDuration(weekMs);
  document.getElementById("day-usage").textContent = formatDuration(dayMs);
}

void refresh();
