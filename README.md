# IRIS Reflex Challenge

A browser reaction-time game. The page shows **PRESS n**; the player presses the matching physical button wired to an ESP32. The browser times each response, shows the four times and their average, and keeps a local leaderboard. No backend, database or build step: HTML/CSS/vanilla JS (ES modules) + ESP32 Arduino firmware + browser `localStorage`.

## Project layout

```
index.html                       page structure
css/styles.css                   theme and layout
js/app.js                        UI wiring and app state
js/game.js                       game rules, timing, leaderboard storage (no DOM / serial)
js/hardware.js                   Web Serial connection and line parsing
js/software.js                   on-screen / keyboard input for testing without hardware
firmware/esp32_reflex_game.ino   ESP32 firmware
```

## Wiring

Each button connects between its GPIO and **GND** (internal pull-ups are used; do not wire buttons to 3.3V).

| Button | GPIO |
|---|---:|
| 1 | 27 |
| 2 | 26 |
| 3 | 25 |
| 4 | 14 |

These are the pins used by the tested firmware. If your buttons are wired to different pins (e.g. 22/21/19/18), edit the four `buttonNPin` constants at the top of the `.ino` so they match the real wiring.

## Upload the firmware (Arduino IDE)

1. Install ESP32 board support, select your ESP32 Dev Module / DevKit board and COM port.
2. Open `firmware/esp32_reflex_game.ino` and upload.
3. Open Serial Monitor at **115200** baud. You should see `READY`, then `1`-`4` (one line per press). Holding a button prints once.
4. **Close Serial Monitor** before using the browser (only one program can hold the port).

## Run the frontend

Web Serial needs a secure context and a Chromium browser (Chrome or Edge, desktop). Serve the folder over `localhost`; don't open the file directly.

```
cd iris-game
python -m http.server 8000
```

Open <http://localhost:8000> (or use the VS Code Live Server extension).

1. Enter a name.
2. Click **Connect ESP32** and pick the board's port, or click **Use Software Mode**.
3. **Start Challenge** is enabled once there is a name and an input mode.
4. A 5-4-3-2-1 countdown plays first (one number per second, each on its own background colour, always in the same order). Then press the requested button four times (each number 1-4 appears once, random order).
5. Review the times and average, then **Save Score**.

Software mode: click the on-screen numbers or press keys **1-4** on the keyboard. It uses the same game engine as hardware mode and is labelled "Software mode", never "Connected".

## Look and feel

Light retro-arcade theme: one typeface (Chillax, loaded from Fontshare, so it needs internet; it falls back to the system font offline) and flat colour fields. Each button has a colour, and during a round the whole screen takes the colour of the button to press: **1 red, 2 blue, 3 green, 4 yellow**. If you want the physical board to match, use keycaps or stickers in those colours. A live millisecond counter runs while a prompt is showing and freezes on your recorded time. The results screen draws one bar per question and previews your rank before you save.

Styles are in `css/styles.css` (colour tokens at the top); the screen logic is in `js/app.js`.

## Serial protocol

115200 baud, one text line per message: `READY` once at boot, then `1`, `2`, `3` or `4` per debounced press. The browser accepts a line only if the whole trimmed line matches `^[1-4]$`; everything else is ignored.

## Game rules

- The countdown is not timed. The timer starts when the prompt is displayed (`performance.now()`), and stops when the complete serial line is received. Presses during the countdown are ignored.
- A wrong button shows feedback, keeps the same question and timer, and is not counted.
- Presses during the short transition between questions, or after the round, are ignored.
- Times are recorded as measured (no clamping); the average keeps full precision and is displayed rounded to the nearest ms.
- If the round is quit or the ESP32 disconnects mid-round, the round stops and no score can be saved.

## Leaderboard

Stored in `localStorage` under the key `irisReflexLeaderboard`, sorted fastest average first, top **20** kept. Records are validated on load; corrupt data is ignored with a warning. Saving is blocked after the first save of a result. Scores are local to this browser profile and origin (same scheme, host and port); they are not shared online.

## Troubleshooting

- **No Web Serial / Connect does nothing:** use Chrome or Edge on desktop, served from `localhost` or HTTPS.
- **ESP32 missing in the picker:** use a USB *data* cable; check Device Manager for a COM port; install the board's USB-serial driver if needed.
- **Port busy / fails to open:** close Arduino Serial Monitor and other serial tools; replug the board.
- **Connects but presses do nothing / wrong number:** verify in Serial Monitor first; check the GPIO constants against the real wiring.
- **Leaderboard missing after refresh:** make sure you use the same URL/port each time and that site data isn't blocked.
- **Times feel slow:** browser-measured times include USB/serial transport and browser scheduling latency; this is not hardware-level timing.

## Test checklist

- Empty name keeps Start disabled; each round contains 1-4 once; wrong press doesn't advance; extra presses ignored; 220/245/240/255 ms averages 240 ms.
- Hardware: each button prints its own ID; `READY` and junk lines are ignored; unplugging mid-round ends the round with a message; reconnecting works without duplicate reads.
- Leaderboard: save, refresh, ordering, corrupt data, duplicate-save blocked.
