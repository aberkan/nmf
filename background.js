const STORAGE_KEY = "intervals";
const ACTIVE_SEGMENT_KEY = "activeOpenSegment";
/** When `true`, tab-close enforcement is off; tracking continues. */
const ENFORCEMENT_DISABLED_KEY = "enforcementDisabled";
const PRUNE_MS = 8 * 24 * 60 * 60 * 1000;
const CHECKPOINT_ALARM = "checkpoint";
const CHECKPOINT_PERIOD_MIN = 1;

/** Rolling windows used by enforcement logic. */
const MS_4H = 4 * 3600 * 1000;
const MS_DAY = 86400000;
/** Strict `>` thresholds for Phase 4 enforcement. */
const LIMIT_4H_MS = 1 * 3600 * 1000;
const LIMIT_24H_MS = 4 * 3600 * 1000;

/** @type {{ startMs: number, tabId: number } | null} */
let activeSegment = null;

/** Whether some Chrome browser window currently has OS focus. */
let chromeWindowOsFocused = true;

/** Window that last received focus via onFocusChanged (not including NONE). */
let lastFocusedWindowId = null;

let initialFocusChecked = false;
/** @type {ReturnType<typeof setTimeout> | null} */
let reconcileTimer = null;

function isFacebookUrl(url) {
  if (!url || url === "about:blank") return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "facebook.com" || host.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

async function ensureInitialFocusState() {
  if (initialFocusChecked) return;
  initialFocusChecked = true;
  try {
    const w = await chrome.windows.getLastFocused();
    chromeWindowOsFocused = w.focused === true;
    if (chromeWindowOsFocused) lastFocusedWindowId = w.id;
  } catch {
    chromeWindowOsFocused = false;
  }
}

/**
 * Active Facebook tab in a focused Chrome window, if any.
 * @returns {Promise<{ tabId: number } | null>}
 */
async function getTrackableFacebookTab() {
  await ensureInitialFocusState();
  if (!chromeWindowOsFocused) return null;

  if (lastFocusedWindowId == null) {
    const w = await chrome.windows.getLastFocused({ populate: true });
    if (!w.focused) return null;
    const tab = w.tabs?.find((t) => t.active);
    if (!tab) return null;
    const url = tab.url || tab.pendingUrl;
    return isFacebookUrl(url) ? { tabId: tab.id } : null;
  }

  const [tab] = await chrome.tabs.query({
    active: true,
    windowId: lastFocusedWindowId,
  });
  if (!tab) return null;
  const url = tab.url || tab.pendingUrl;
  return isFacebookUrl(url) ? { tabId: tab.id } : null;
}

function pruneIntervals(intervals, now = Date.now()) {
  const cutoff = now - PRUNE_MS;
  return intervals.filter((x) => x.endMs >= cutoff);
}

async function appendInterval(startMs, endMs) {
  if (endMs <= startMs) return;
  const data = await chrome.storage.local.get(STORAGE_KEY);
  /** @type {{ startMs: number, endMs: number }[]} */
  const intervals = data[STORAGE_KEY] || [];
  intervals.push({ startMs, endMs });
  const pruned = pruneIntervals(intervals, Date.now());
  await chrome.storage.local.set({ [STORAGE_KEY]: pruned });
}

async function saveActiveOpenSegment() {
  if (!activeSegment) {
    await chrome.storage.local.remove(ACTIVE_SEGMENT_KEY);
    return;
  }
  await chrome.storage.local.set({ [ACTIVE_SEGMENT_KEY]: activeSegment });
}

async function loadActiveOpenSegment() {
  const data = await chrome.storage.local.get(ACTIVE_SEGMENT_KEY);
  const s = data[ACTIVE_SEGMENT_KEY];
  if (s && typeof s.startMs === "number" && typeof s.tabId === "number") {
    activeSegment = { startMs: s.startMs, tabId: s.tabId };
  }
}

async function flushSegment() {
  await ready;
  if (!activeSegment) return;
  const endMs = Date.now();
  const { startMs } = activeSegment;
  activeSegment = null;
  await chrome.storage.local.remove(ACTIVE_SEGMENT_KEY);
  await appendInterval(startMs, endMs);
}

async function checkpoint() {
  await ready;
  if (!activeSegment) return;
  const now = Date.now();
  const { startMs, tabId } = activeSegment;
  if (now - startMs < 1000) return;
  activeSegment = null;
  await chrome.storage.local.remove(ACTIVE_SEGMENT_KEY);
  await appendInterval(startMs, now);
  activeSegment = { startMs: now, tabId };
  await saveActiveOpenSegment();
  await maybeEnforceUsageLimits();
}

/**
 * If the focused active tab is Facebook and usage is *strictly* over either:
 * - 1 hour in the last 4 hours, OR
 * - 4 hours in the last 24 hours
 * then close that tab.
 */
async function maybeEnforceUsageLimits() {
  const t = await getTrackableFacebookTab();
  if (!t) return;
  const now = Date.now();
  const [settings, last4hMs, last24hMs] = await Promise.all([
    chrome.storage.local.get(ENFORCEMENT_DISABLED_KEY),
    sumUsageMs(now - MS_4H, now),
    sumUsageMs(now - MS_DAY, now),
  ]);
  if (settings[ENFORCEMENT_DISABLED_KEY] === true) return;
  const over4hLimit = last4hMs > LIMIT_4H_MS;
  const over24hLimit = last24hMs > LIMIT_24H_MS;
  if (!over4hLimit && !over24hLimit) return;
  try {
    await chrome.tabs.remove(t.tabId);
  } catch {
    // Tab may already be closed or missing permission edge cases.
  }
}

async function reconcileNow() {
  await ready;
  const target = await getTrackableFacebookTab();
  const now = Date.now();

  if (activeSegment) {
    if (!target || target.tabId !== activeSegment.tabId) {
      await flushSegment();
      if (target) {
        activeSegment = { startMs: now, tabId: target.tabId };
        await saveActiveOpenSegment();
      }
      await maybeEnforceUsageLimits();
      return;
    }
    await maybeEnforceUsageLimits();
    return;
  }

  if (target) {
    activeSegment = { startMs: now, tabId: target.tabId };
    await saveActiveOpenSegment();
  }
  await maybeEnforceUsageLimits();
}

function scheduleReconcile() {
  if (reconcileTimer) clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(() => {
    reconcileTimer = null;
    void reconcileNow();
  }, 0);
}

const ready = (async () => {
  await loadActiveOpenSegment();
  setupAlarm();
  scheduleReconcile();
})();

/**
 * Sum milliseconds spent on Facebook in [sinceMs, untilMs], including the open segment if any.
 * @param {number} sinceMs
 * @param {number} [untilMs]
 */
async function sumUsageMs(sinceMs, untilMs = Date.now()) {
  await ready;
  const data = await chrome.storage.local.get(STORAGE_KEY);
  /** @type {{ startMs: number, endMs: number }[]} */
  const intervals = data[STORAGE_KEY] || [];
  let total = 0;
  for (const { startMs, endMs } of intervals) {
    const s = Math.max(startMs, sinceMs);
    const e = Math.min(endMs, untilMs);
    if (e > s) total += e - s;
  }
  if (activeSegment) {
    const s = Math.max(activeSegment.startMs, sinceMs);
    const e = untilMs;
    if (e > s) total += e - s;
  }
  return total;
}

function setupAlarm() {
  chrome.alarms.create(CHECKPOINT_ALARM, {
    periodInMinutes: CHECKPOINT_PERIOD_MIN,
  });
}

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    chromeWindowOsFocused = false;
    lastFocusedWindowId = null;
    void flushSegment();
    return;
  }
  chromeWindowOsFocused = true;
  lastFocusedWindowId = windowId;
  scheduleReconcile();
});

chrome.tabs.onActivated.addListener(() => {
  scheduleReconcile();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (
    changeInfo.status === "complete" ||
    changeInfo.url != null ||
    changeInfo.pendingUrl != null
  ) {
    scheduleReconcile();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeSegment && tabId === activeSegment.tabId) {
    void flushSegment();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CHECKPOINT_ALARM) {
    void checkpoint();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  setupAlarm();
  initialFocusChecked = false;
  scheduleReconcile();
});

chrome.runtime.onStartup.addListener(() => {
  initialFocusChecked = false;
  scheduleReconcile();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_USAGE") {
    const sinceMs =
      typeof msg.sinceMs === "number" ? msg.sinceMs : Date.now() - 7 * 86400000;
    void sumUsageMs(sinceMs).then((ms) => {
      sendResponse({ ms });
    });
    return true;
  }
});
