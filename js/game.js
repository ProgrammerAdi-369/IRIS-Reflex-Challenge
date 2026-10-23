// Game engine: question order, timing, scoring, leaderboard storage.
// Pure logic - no DOM and no serial access. Timestamps are passed in by the caller.

export const STORAGE_KEY = "irisReflexLeaderboard";
export const MAX_LEADERBOARD_ENTRIES = 20;
const BUTTON_IDS = [1, 2, 3, 4];

// Fisher-Yates shuffle (returns a new array).
export function shuffle(items, random = Math.random) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createRound(playerName, random = Math.random) {
  return {
    playerName,
    questions: shuffle(BUTTON_IDS, random),
    index: 0,
    startedAt: null, // set by startQuestion; null means no active question
    timesMs: [],
    status: "idle", // idle | active | complete
  };
}

export function currentTarget(round) {
  return round.status === "active" ? round.questions[round.index] : null;
}

// Begin the question at round.index. `now` should be performance.now() taken as the prompt is shown.
export function startQuestion(round, now) {
  if (round.status === "complete" || round.index >= round.questions.length) return false;
  round.status = "active";
  round.startedAt = now;
  return true;
}

// Returns { result, timeMs? } where result is:
//   "correct"  - target pressed, time recorded, caller should call startQuestion for the next one
//   "complete" - target pressed and it was the last question
//   "wrong"    - another valid button pressed; question and timer unchanged
//   "ignored"  - no active question (transition, finished, invalid id)
export function submitButtonPress(round, buttonId, now) {
  if (round.status !== "active" || round.startedAt === null) return { result: "ignored" };
  if (!BUTTON_IDS.includes(buttonId)) return { result: "ignored" };
  if (buttonId !== round.questions[round.index]) return { result: "wrong" };

  const timeMs = now - round.startedAt;
  round.timesMs.push(timeMs);
  round.startedAt = null; // further presses are ignored until the next startQuestion
  round.index += 1;
  if (round.index >= round.questions.length) {
    round.status = "complete";
    return { result: "complete", timeMs };
  }
  return { result: "correct", timeMs };
}

export function getResults(round) {
  const complete = round.status === "complete" && round.timesMs.length === round.questions.length;
  const total = round.timesMs.reduce((a, b) => a + b, 0);
  return {
    playerName: round.playerName,
    questions: round.questions.slice(),
    timesMs: round.timesMs.slice(),
    averageMs: round.timesMs.length ? total / round.timesMs.length : null,
    complete,
  };
}

// ---- Leaderboard ----

function isValidEntry(e) {
  return (
    e &&
    typeof e === "object" &&
    typeof e.name === "string" &&
    e.name.trim() !== "" &&
    Number.isFinite(e.averageMs) &&
    e.averageMs >= 0 &&
    Array.isArray(e.timesMs) &&
    e.timesMs.length === BUTTON_IDS.length &&
    e.timesMs.every((t) => Number.isFinite(t) && t >= 0) &&
    typeof e.completedAt === "string" &&
    !Number.isNaN(Date.parse(e.completedAt))
  );
}

function sortEntries(entries) {
  return entries.sort((a, b) => a.averageMs - b.averageMs);
}

// Returns { entries, warning }. Never throws.
export function loadLeaderboard(storage = globalThis.localStorage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { entries: [], warning: "Local storage is unavailable; scores cannot be loaded or saved." };
  }
  if (raw === null || raw === undefined) return { entries: [], warning: null };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { entries: [], warning: "Saved leaderboard data was corrupt and has been ignored." };
  }
  if (!Array.isArray(parsed)) {
    return { entries: [], warning: "Saved leaderboard data was corrupt and has been ignored." };
  }

  const valid = parsed.filter(isValidEntry);
  const warning = valid.length < parsed.length ? "Some invalid leaderboard records were skipped." : null;
  return { entries: sortEntries(valid).slice(0, MAX_LEADERBOARD_ENTRIES), warning };
}

// Saves a completed result. Returns { ok, entries, error }. Never throws.
export function saveLeaderboardEntry(results, storage = globalThis.localStorage, now = new Date()) {
  if (!results || !results.complete) {
    return { ok: false, entries: loadLeaderboard(storage).entries, error: "Only completed rounds can be saved." };
  }
  const entry = {
    name: results.playerName,
    averageMs: results.averageMs,
    timesMs: results.timesMs,
    completedAt: now.toISOString(),
  };
  if (!isValidEntry(entry)) {
    return { ok: false, entries: loadLeaderboard(storage).entries, error: "This result is not valid and cannot be saved." };
  }

  const { entries } = loadLeaderboard(storage); // corrupt data is dropped and replaced
  const updated = sortEntries([...entries, entry]).slice(0, MAX_LEADERBOARD_ENTRIES);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    return { ok: false, entries, error: "Could not write to local storage (it may be full or disabled)." };
  }
  return { ok: true, entries: updated, error: null };
}
