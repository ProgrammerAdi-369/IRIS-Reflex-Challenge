// UI wiring and app state. Game rules live in game.js; keyboard handling lives in software.js.

import {
  createRound, startQuestion, submitButtonPress, getResults,
  loadLeaderboard, saveLeaderboardEntry,
} from "./game.js";
import { initKeyboardInput } from "./software.js";

const COUNTDOWN_FROM = 5;         // 5, 4, 3, 2, 1 before question 1
const COUNTDOWN_STEP_MS = 1000;   // one number per second; the reaction timer starts after the last one
const TRANSITION_DELAY_MS = 350;  // pause after a correct answer; input is ignored meanwhile

const $ = (id) => document.getElementById(id);
const el = {
  banner: $("banner"),
  setup: $("screen-setup"), challenge: $("screen-challenge"), results: $("screen-results"),
  leaderboard: $("leaderboard"),
  form: $("setup-form"), name: $("player-name"), nameError: $("name-error"),
  btnStart: $("btn-start"),
  questionCount: $("question-count"),
  progress: $("progress"), prompt: $("prompt"), liveMs: $("live-ms"), tiles: $("tiles"), feedback: $("feedback"),
  btnQuit: $("btn-quit"),
  resultName: $("result-name"), resultTimes: $("result-times"), resultAverage: $("result-average"),
  resultTitle: $("results-title"), resultRank: $("result-rank"),
  saveMessage: $("save-message"), btnSave: $("btn-save"), btnAgain: $("btn-again"), btnBack: $("btn-back"),
  lbEmpty: $("lb-empty"), lbTable: $("lb-table"), lbBody: $("lb-body"),
  statBest: $("stat-best"), statCount: $("stat-count"), statAvg: $("stat-avg"),
};
const tileEls = Array.from(el.tiles.querySelectorAll(".tile"));
const progressEls = Array.from(el.progress.children);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const state = {
  round: null,
  results: null,
  saved: false,
  timer: null,           // pending setTimeout for ready/transition
  raf: null,             // live millisecond counter
};

// ---------- Banner ----------
function showBanner(message, kind = "error") {
  el.banner.textContent = message;
  el.banner.className = `banner banner-${kind}`;
  el.banner.hidden = false;
}
function clearBanner() {
  el.banner.hidden = true;
  el.banner.textContent = "";
}

// ---------- Screens / setup rendering ----------
function showScreen(name) {
  el.setup.hidden = name !== "setup";
  el.challenge.hidden = name !== "challenge";
  el.results.hidden = name !== "results";
}

function currentScreen() {
  if (!el.challenge.hidden) return "challenge";
  if (!el.results.hidden) return "results";
  return "setup";
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
}

function playerName() {
  return el.name.value.trim();
}

function renderStatus() {
  el.btnStart.disabled = playerName() === "";
}

// ---------- Game flow ----------
function clearTimer() {
  if (state.timer !== null) { clearTimeout(state.timer); state.timer = null; }
}

// Live counter: shows the running reaction time of the active question, then freezes on the recorded one.
function tickLive() {
  const round = state.round;
  if (round && round.startedAt !== null) {
    el.liveMs.textContent = String(Math.max(0, Math.round(performance.now() - round.startedAt)));
  }
  state.raf = requestAnimationFrame(tickLive);
}
function startLive() {
  if (state.raf === null) state.raf = requestAnimationFrame(tickLive);
}
function stopLive() {
  if (state.raf !== null) { cancelAnimationFrame(state.raf); state.raf = null; }
}

function endCountdown() {
  delete el.challenge.dataset.count;
  el.challenge.classList.remove("is-counting");
}

function abortRound() {
  clearTimer();
  stopLive();
  endCountdown();
  state.round = null;
  resetTiles();
  el.challenge.dataset.target = "0";
}

function resetTiles() {
  tileEls.forEach((t) => t.classList.remove("is-target", "flash-ok", "flash-bad"));
}

function setFeedback(text) {
  el.feedback.textContent = text || " ";
}

function flashTile(id, cls) {
  const tile = tileEls[id - 1];
  if (!tile) return;
  tile.classList.remove(cls);
  void tile.offsetWidth; // restart the animation on repeated presses
  tile.classList.add(cls);
  setTimeout(() => tile.classList.remove(cls), 220);
}

function renderProgress(done) {
  progressEls.forEach((p, i) => p.classList.toggle("done", i < done));
}

function setPrompt(wordText, num) {
  el.prompt.replaceChildren();
  const word = document.createElement("span");
  word.className = "prompt-word";
  word.textContent = wordText;
  el.prompt.appendChild(word);
  if (num) {
    const n = document.createElement("span");
    n.className = "prompt-num";
    n.textContent = String(num);
    el.prompt.appendChild(n);
  }
}

function startChallenge() {
  const name = playerName();
  if (!name) { el.nameError.hidden = false; el.name.focus(); return; }
  clearBanner();
  clearTimer();
  state.round = createRound(name);
  state.results = null;
  state.saved = false;
  showScreen("challenge");
  scrollToTop();
  el.challenge.dataset.target = "0";
  el.liveMs.textContent = "0";
  renderProgress(0);
  setFeedback("");
  resetTiles();
  startLive();
  runCountdown(COUNTDOWN_FROM);
}

// Each number gets its own field colour (see data-count in the CSS), always in the same order.
function runCountdown(n) {
  el.challenge.dataset.count = String(n);
  el.challenge.classList.add("is-counting");
  el.questionCount.textContent = "Get ready";
  setPrompt("Get ready", n);
  el.prompt.removeAttribute("aria-label"); // a label left from the last question would hide the number
  state.timer = setTimeout(() => (n > 1 ? runCountdown(n - 1) : showQuestion()), COUNTDOWN_STEP_MS);
}

function showQuestion() {
  state.timer = null;
  const round = state.round;
  if (!round) return;
  endCountdown();
  const target = round.questions[round.index];
  el.questionCount.textContent = `Question ${round.index + 1} of ${round.questions.length}`;
  el.challenge.dataset.target = String(target); // the whole field takes the button's colour
  setPrompt("Press", target);
  el.prompt.setAttribute("aria-label", `Press ${target}`);
  renderProgress(round.index);
  setFeedback("");
  resetTiles();
  tileEls[target - 1].classList.add("is-target");
  startQuestion(round, performance.now()); // timer starts as the prompt is shown
}

// Single entry point for keyboard input.
function handleButton(buttonId, receivedAt = performance.now()) {
  const round = state.round;
  if (!round || currentScreen() !== "challenge") return;
  const outcome = submitButtonPress(round, buttonId, receivedAt);

  if (outcome.result === "wrong") {
    flashTile(buttonId, "flash-bad");
    setFeedback(`Not that one. Hit ${round.questions[round.index]}.`);
  } else if (outcome.result === "correct" || outcome.result === "complete") {
    flashTile(buttonId, "flash-ok");
    el.liveMs.textContent = String(Math.round(outcome.timeMs)); // freeze on the recorded time
    setFeedback(`${Math.round(outcome.timeMs)} ms. Nice.`);
    renderProgress(round.index);
    state.timer = setTimeout(outcome.result === "complete" ? finishRound : showQuestion, TRANSITION_DELAY_MS);
  }
}

function finishRound() {
  state.timer = null;
  stopLive();
  const round = state.round;
  if (!round) return;
  state.results = getResults(round);
  state.saved = false;
  resetTiles();
  el.challenge.dataset.target = "0";
  renderResults();
  showScreen("results");
  scrollToTop();
  el.resultTitle.focus({ preventScroll: true });
}

// ---------- Results ----------
function ratingFor(avg) {
  if (avg < 250) return "Lightning.";
  if (avg < 350) return "Razor sharp.";
  if (avg < 500) return "Quick hands.";
  return "Warming up.";
}

function renderResults() {
  const r = state.results;
  el.resultTitle.textContent = ratingFor(r.averageMs);
  el.resultName.textContent = r.playerName;
  el.resultAverage.textContent = String(Math.round(r.averageMs));

  const board = loadLeaderboard().entries;
  const rank = board.filter((e) => e.averageMs < r.averageMs).length + 1;
  if (board.length === 0) el.resultRank.textContent = "First score on this board. Save it to start the list.";
  else if (rank === 1) el.resultRank.textContent = "Faster than everyone on this board.";
  else el.resultRank.textContent = `Would rank #${rank} of ${board.length + 1} on this board.`;

  const max = Math.max(...r.timesMs);
  el.resultTimes.replaceChildren(
    ...r.timesMs.map((t, i) => {
      const li = document.createElement("li");
      li.dataset.target = String(r.questions[i]);
      li.style.setProperty("--h", String(Math.max(14, (t / max) * 82)));
      li.style.setProperty("--i", String(i));

      const col = document.createElement("div");
      col.className = "bar-col";
      const fig = document.createElement("span");
      fig.className = "bar-fig";
      fig.textContent = String(Math.round(t));
      const unit = document.createElement("small");
      unit.textContent = " ms";
      fig.appendChild(unit);
      const bar = document.createElement("div");
      bar.className = "bar";
      col.append(fig, bar);

      const label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = `Press ${r.questions[i]}`;
      li.append(col, label);
      return li;
    })
  );
  el.saveMessage.textContent = "";
  el.btnSave.disabled = false;
  el.btnSave.textContent = "Save score";
}

// ---------- Leaderboard ----------
function renderLeaderboard(entries, highlight = null) {
  el.lbBody.replaceChildren(
    ...entries.map((e, i) => {
      const tr = document.createElement("tr");
      tr.style.setProperty("--i", String(i));
      tr.className = `r${i + 1}`;
      if (highlight && e.completedAt === highlight) tr.classList.add("is-new");

      const rank = document.createElement("td");
      rank.className = "rank";
      const chip = document.createElement("div");
      chip.className = "rank-chip";
      chip.textContent = String(i + 1);
      rank.appendChild(chip);

      const name = document.createElement("td");
      name.className = "name";
      name.textContent = e.name;

      const avg = document.createElement("td");
      avg.className = "num";
      avg.textContent = `${Math.round(e.averageMs)} ms`;

      const date = document.createElement("td");
      date.className = "date";
      date.textContent = new Date(e.completedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" });

      tr.append(rank, name, avg, date);
      return tr;
    })
  );
  el.lbTable.hidden = entries.length === 0;
  el.lbEmpty.hidden = entries.length !== 0;

  el.statCount.textContent = String(entries.length);
  if (entries.length) {
    const avgs = entries.map((e) => e.averageMs);
    el.statBest.textContent = `${Math.round(Math.min(...avgs))} ms`;
    el.statAvg.textContent = `${Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length)} ms`;
  } else {
    el.statBest.textContent = "–";
    el.statAvg.textContent = "–";
  }
}

function saveScore() {
  if (state.saved || !state.results) return;
  const outcome = saveLeaderboardEntry(state.results);
  if (!outcome.ok) {
    showBanner(outcome.error, "error");
    return;
  }
  state.saved = true; // guard against duplicate saves
  el.btnSave.disabled = true;
  el.btnSave.textContent = "Saved";
  el.saveMessage.textContent = outcome.improved
    ? "Score saved to this browser's leaderboard."
    : "Not faster than your saved best, leaderboard unchanged.";
  const mine = outcome.entries.find(
    (e) => e.name === state.results.playerName && e.averageMs === state.results.averageMs
      && e.timesMs.every((t, i) => t === state.results.timesMs[i])
  );
  renderLeaderboard(outcome.entries, mine ? mine.completedAt : null);
  el.leaderboard.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
}

// ---------- Event wiring ----------
el.name.addEventListener("input", () => {
  el.nameError.hidden = playerName() !== "";
  renderStatus();
});

el.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (playerName() === "") { el.nameError.hidden = false; el.name.focus(); return; }
  startChallenge();
});

el.btnQuit.addEventListener("click", () => {
  abortRound();
  showScreen("setup");
  showBanner("Round stopped. No score was saved.", "info");
});

el.btnAgain.addEventListener("click", () => {
  startChallenge();
});

el.btnBack.addEventListener("click", () => {
  abortRound();
  clearBanner();
  showScreen("setup");
  renderStatus();
  scrollToTop();
});

el.btnSave.addEventListener("click", saveScore);

// ---------- Scroll reveal ----------
// Content is only hidden once this has run (the .js class), so nothing stays invisible without script.
function initReveal() {
  const targets = document.querySelectorAll(
    ".lb-head > *, .lb-body-wrap, .site-footer .footer-grid > *, .wordmark"
  );
  if (!("IntersectionObserver" in window) || reducedMotion.matches) return;
  document.documentElement.classList.add("js");
  const io = new IntersectionObserver((items) => {
    items.forEach((item) => {
      if (item.isIntersecting) { item.target.classList.add("in"); io.unobserve(item.target); }
    });
  }, { threshold: 0.15 });
  targets.forEach((t, i) => {
    t.classList.add("reveal");
    t.style.setProperty("--d", String(i % 4));
    io.observe(t);
  });
}

// ---------- Init ----------
function init() {
  initReveal();
  const { entries, warning } = loadLeaderboard();
  renderLeaderboard(entries);
  if (warning) showBanner(warning, "warn");
  showScreen("setup");
  renderStatus();
}

initKeyboardInput((id) => handleButton(id));
init();
