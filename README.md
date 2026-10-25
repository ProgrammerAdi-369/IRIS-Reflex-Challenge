# IRIS Reflex Challenge

A browser reaction-time game. The page shows **PRESS n**; press the matching number key (1-4, top row or numpad). The browser times each response, shows the four times and their average, and keeps a local leaderboard. No backend or build step: HTML/CSS/vanilla JS (ES modules) + browser `localStorage`.

## Quickstart

1. **Prerequisites:** Git, Python 3.8+ and any modern browser (Chrome, Edge or Firefox).
2. **Clone the repo:**
   ```
   git clone https://github.com/ProgrammerAdi-369/IRIS-Reflex-Challenge.git
   cd IRIS-Reflex-Challenge
   ```
   
3. **Start a local server** (the game uses ES modules, so opening `index.html` directly won't work):
   ```
   python -m http.server 8000
   ```
   On Windows, use `py -m http.server 8000` if `python` isn't found.
4. **Play:** open <http://localhost:8000>, type your name, click **Start challenge**, and press the number key shown (1-4, top row or numpad).
5. **Stop:** press `Ctrl+C` in the terminal.

## Files

```
index.html        page
css/styles.css    styles
js/game.js        game rules, timing, leaderboard storage (no DOM)
js/software.js    keyboard input (keys 1-4)
js/app.js         UI wiring
```

## Rules

- 5-second countdown, then four prompts (1-4 in random order).
- The timer starts when the prompt is displayed. Presses during the countdown are ignored; a wrong key does not stop the clock.
- Quitting a round saves nothing. Scores are stored in this browser only (top 20).
