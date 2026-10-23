# IRIS Reflex Challenge — Developer Implementation Guide

**Project:** IRIS Reflex Challenge  
**Purpose:** Build a browser-based reaction-time game that communicates with an ESP32 DevKit V1 over USB serial.  
**Audience:** Developer implementing the project from scratch.  
**Primary technologies:** HTML, CSS, vanilla JavaScript, ESP32 Arduino/C++ firmware, Web Serial API, browser Local Storage.

---

## 1. Project Goal and Scope

IRIS Reflex Challenge asks a player to respond to prompts such as **PRESS 3** by pressing the corresponding physical button connected to an ESP32. The browser records response times, calculates the average, displays results, and stores a leaderboard.

### Required capabilities

1. Enter a player's name.
2. Connect to an ESP32 through the browser's serial-port picker.
3. Show connection status and provide a browser-only software mode.
4. Run a four-question challenge using the numbers 1, 2, 3, and 4 in a randomized order.
5. Receive button IDs from the ESP32.
6. Record reaction time for each question using `performance.now()`.
7. Reject incorrect button presses and handle extra presses safely.
8. Display per-question times and the average.
9. Save and display a leaderboard using `localStorage`.
10. Work on a modern desktop browser with responsive styling and clear error messages.

### What “backend” means in this project

**No web application backend server is required.** The project uses:
- **Frontend:** HTML/CSS/JavaScript running in the browser.
- **Hardware-side firmware:** C++ running on the ESP32.
- **Persistence:** Browser `localStorage`.

There is no Node.js server, API, SQL database, cloud account, or network connection in the required architecture. If a shared leaderboard across different computers is needed later, that would be a separate enhancement requiring a real backend.

---

## 2. Architecture and Data Flow

```text
Player
  |
  v
Browser frontend (HTML / CSS / JavaScript)
  |-- Player setup and connection status
  |-- Question engine and reaction timer
  |-- Results and average calculation
  |-- Leaderboard stored in localStorage
  |
  | Web Serial API over USB
  | Text protocol at 115200 baud
  v
ESP32 DevKit V1 firmware (Arduino/C++)
  |
  | Reads GPIO pins using INPUT_PULLUP
  v
Four physical buttons
```

### Runtime flow

1. The player enters a name.
2. The player connects the ESP32, or explicitly chooses software/demo mode.
3. The player starts a round.
4. The browser displays a target number and records the display timestamp.
5. The player presses the corresponding physical button.
6. The ESP32 detects the press and sends a button ID (`1`, `2`, `3`, or `4`) over serial.
7. The browser parses the line and passes the button ID to the game engine.
8. The game engine compares the received ID with the target and calculates elapsed time.
9. The game advances through four questions.
10. The results screen displays the individual times and average.
11. The player can save the result to the leaderboard; saved results persist in that browser profile.

---

## 3. Hardware and GPIO Configuration

### Components

- ESP32 DevKit V1
- Four momentary push buttons
- Breadboard and jumper wires
- USB **data** cable
- Computer running a supported browser and Arduino IDE

### Wiring rule

Each button connects between its configured GPIO pin and **GND**. Configure each pin as `INPUT_PULLUP`; no external pull-up resistor is required for this simple setup.

| Logical button | GPIO in the project description/current code |
|---|---:|
| Button 1 | 27 |
| Button 2 | 26 |
| Button 3 | 25 |
| Button 4 | 14 |

**Important pin mismatch to resolve before testing:** Earlier physical wiring was described as GPIO **22, 21, 19, and 18**, while the current working C++ code uses **27, 26, 25, and 14**. These are alternative configurations, not interchangeable mappings. Inspect the actual wires and choose one mapping. The firmware constants must match the real GPIO connections. Do not change pin constants solely to match this document if the hardware is already wired differently.

For example, if the physical wiring is GPIO 22, 21, 19, and 18, use:

```cpp
const int button1Pin = 22;
const int button2Pin = 21;
const int button3Pin = 19;
const int button4Pin = 18;
```

If the buttons are wired to GPIO 27, 26, 25, and 14, retain those values instead.

With `INPUT_PULLUP`:
- Button released → `HIGH`
- Button pressed → `LOW`

Do not connect a button to 3.3V as part of this wiring pattern; the button should pull the input to GND when pressed.

---

## 4. Required Repository Structure

Create the following structure:

```text
iris-reflex-challenge/
├── index.html
├── README.md
├── assets/
│   └── iris-logo.png              # Optional logo
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── hardware.js
│   ├── software.js
│   └── game.js
└── firmware/
    └── esp32_reflex_game.ino
```

### File responsibilities

| File | Responsibilities | Must not do |
|---|---|---|
| `index.html` | Semantic page structure, player form, connection controls, game screen, results, leaderboard, status/feedback elements | Contain the entire application logic or large inline styles |
| `css/styles.css` | Theme, layout, responsiveness, states, focus styles, animations, accessible contrast | Implement game logic |
| `js/app.js` | Initialize the UI, wire event handlers, coordinate app state, select hardware/software mode, render status and results | Parse serial bytes directly or duplicate scoring logic |
| `js/hardware.js` | Request/open serial port, read line-delimited messages, validate button IDs, report connection/disconnection/errors, clean up reader and port | Decide whether a press is correct or calculate the score |
| `js/software.js` | Provide a simulated input source for testing without hardware, using the same callback interface as hardware | Pretend that real hardware is connected |
| `js/game.js` | Generate the question order, track active question, handle answer validation, calculate elapsed/average times, return round results, load/save/sort leaderboard | Access HTML elements or own the serial connection |
| `firmware/esp32_reflex_game.ino` | Read physical buttons, debounce inputs, send button IDs over USB serial | Generate game questions or calculate average scores |
| `README.md` | Setup, run, wiring, test, troubleshooting, and developer notes | Contradict the implementation |

### Suggested module interfaces

Use JavaScript ES modules so ownership is explicit.

- `hardware.js` exports a function such as `connectHardware({ onButtonPress, onStatus, onError })` and a disconnect/cleanup function.
- `software.js` exports a software-input initializer that can call the same `onButtonPress(buttonId)` callback.
- `game.js` exports game functions such as `createRound()`, `startQuestion()`, `submitButtonPress(buttonId, timestamp)`, `getResults()`, `loadLeaderboard()`, and `saveLeaderboardEntry(entry)`.
- `app.js` imports these modules and connects them to the DOM.

Names can be adjusted during implementation, but keep the responsibilities and callback contract consistent.

---

## 5. Serial Protocol Contract

The serial protocol is the agreement between the ESP32 firmware and browser. Keep it simple and stable.

### Serial settings

- Baud rate: **115200**
- Encoding: UTF-8/ASCII-compatible text
- Message framing: one message per line, terminated by `\n` (Arduino `Serial.println()` sends a newline)
- Valid button messages: `1`, `2`, `3`, `4`
- Optional startup message: `READY`

Example serial output:

```text
READY
3
1
4
2
```

The browser should trim whitespace and accept a button message only if the complete trimmed line matches `/^[1-4]$/`. Ignore `READY` and any other non-button line. Never treat arbitrary text as a button press.

### Update the existing firmware's print statements

The current working firmware prints messages like `Button 1 pressed!`. For the protocol above, replace those messages inside the existing debounced press blocks with:

```cpp
Serial.println("1");  // Button 1
Serial.println("2");  // Button 2
Serial.println("3");  // Button 3
Serial.println("4");  // Button 4
```

Do not paste these four statements unconditionally at the end of `loop()`. Each statement belongs inside the matching button's debounced `buttonState == LOW` press-detection block.

Keep the existing debounce behavior (50 ms) while integrating the frontend. Avoid adding long delays that make the game sluggish. A later firmware refactor may consolidate the repeated debounce code, but do not combine that refactor with initial integration unless needed.

### Serial parsing requirements

Serial data can arrive in chunks; one `reader.read()` result is not guaranteed to contain exactly one line. The reader must:
1. Append each received text chunk to a buffer.
2. Split complete lines on `\n`, tolerating `\r\n`.
3. Keep the last incomplete fragment in the buffer.
4. Trim each complete line.
5. Emit a callback only for `1` through `4`.
6. Stop reading and release resources when disconnected.

Do not let two application components open the same serial port simultaneously. Close Arduino IDE Serial Monitor before the browser opens the port.

---

## 6. Frontend Screens and UI States

Build a clear, professional IRIS-themed interface. Exact colors and styling are a design choice, but the state and feedback behavior below is required.

### A. Player setup

Elements:
- IRIS logo/name and short instruction.
- Player name input.
- **Connect ESP32** button.
- **Use Software Mode** button.
- Connection status label.
- **Start Challenge** button, disabled until the name and an input mode are valid.

Validation:
- Trim leading/trailing whitespace from the name.
- Do not start with an empty name.
- Keep the connection status truthful: `Disconnected`, `Connecting…`, `Connected`, or `Software mode`.
- Do not request the serial port automatically on page load. Web Serial requires a user gesture for `navigator.serial.requestPort()`.

### B. Ready / challenge screen

Show:
- Current question number (for example, `Question 2 of 4`).
- Large prompt such as **PRESS 3**.
- Four visual button labels, numbered 1–4.
- Clear feedback such as `Correct!`, `Wrong button — try again`, or `Round complete`.
- Optional progress indicator.

When a question is displayed, store `performance.now()` as its start timestamp. Do not start the timer at page load or when the player first connects.

### C. Results screen

Show:
- Player name.
- Four question results.
- Average reaction time in milliseconds.
- Clear completion state.
- **Save Score** action.
- **Play Again** and **Back to Setup** actions.

### D. Leaderboard

Show at least:
- Rank
- Player name
- Average reaction time (ms)
- Date/time (optional but recommended)

Sort fastest averages first (ascending milliseconds). Clearly explain that this leaderboard is local to the current browser profile/device.

### E. Error and disconnected states

Display readable messages for:
- Browser does not support Web Serial.
- Port selection cancelled.
- Port is busy or cannot be opened.
- Device disconnected during a round.
- Invalid or incomplete player name.
- Corrupt leaderboard data.
- Local Storage unavailable or full.

Do not leave the interface showing “Connected” after a disconnection.

---

## 7. Game Rules and Timing

### Question order

Each round has exactly four questions: 1, 2, 3, and 4, each appearing once in randomized order. Avoid a shuffle implementation that can accidentally duplicate or omit a number. A Fisher–Yates shuffle is appropriate.

Example:

```text
PRESS 4
PRESS 1
PRESS 3
PRESS 2
```

### Reaction-time calculation

Use `performance.now()`, a monotonic high-resolution timer:

```js
reactionTimeMs = receivedAt - questionDisplayedAt;
```

Record `questionDisplayedAt = performance.now()` immediately before or when the prompt is rendered for the new question. When the serial callback receives a button ID, capture the receive timestamp using `performance.now()` and pass it to the game engine.

This measures browser-observed response time, including a small amount of USB/serial transport and browser scheduling latency. It does not measure the exact electrical transition at the button.

### Correct and incorrect presses

- If the player presses the target button, record the elapsed time and advance to the next question.
- If the player presses a different button, show clear incorrect feedback and keep the same question active.
- Do not replace the question timer on an incorrect press unless the game rules explicitly decide otherwise.
- Ignore presses during transitions, after the round has finished, or when no question is active.
- Ignore duplicate events that occur after the first accepted correct answer for that question.
- Define a consistent policy for very fast responses; do not silently fabricate or clamp values without documenting it.

### Average score

For four successful answers:

```text
averageMs = (q1Ms + q2Ms + q3Ms + q4Ms) / 4
```

Keep full numeric precision internally. Display a sensible rounded value (for example, the nearest millisecond). A lower average is better.

A wrong button press should not count as a completed question or be included in the average. If the player disconnects before completing all four questions, do not save a normal completed score.

---

## 8. Leaderboard Storage

Use `localStorage` with one documented key, for example:

```text
irisReflexLeaderboard
```

Suggested record format:

```json
[
  {
    "name": "Arnav",
    "averageMs": 240,
    "timesMs": [220, 245, 240, 255],
    "completedAt": "2026-10-23T14:00:00.000Z"
  },
  {
    "name": "Rahul",
    "averageMs": 255,
    "timesMs": [250, 260, 245, 265],
    "completedAt": "2026-10-23T14:05:00.000Z"
  }
]
```

### Storage requirements

1. Read from `localStorage` when the application starts.
2. Parse JSON inside `try/catch`.
3. Validate records before rendering them.
4. If data is invalid, recover gracefully and show a non-blocking warning rather than crashing the app.
5. On score save, append a completed record and sort ascending by `averageMs`.
6. Persist the updated array using `JSON.stringify`.
7. Re-render the leaderboard after saving.
8. Do not save incomplete rounds.
9. Decide and document whether all records are kept or the top N records are retained. A practical default is the top 10 or top 20 scores.
10. Explain that local storage is per browser profile and origin; it is not a shared online leaderboard.

Prevent accidental duplicate saves by disabling or guarding the save action after a result has been saved.

---

## 9. Software / Demo Mode

Software mode allows the UI and scoring logic to be tested without a physical ESP32. It must use the **same game engine and button callback interface** as hardware mode.

Expected behavior:
- Player selects **Use Software Mode**.
- The UI reports `Software mode`, not `Connected`.
- The game generates the same four-question round.
- The player can answer by clicking/tapping the matching on-screen numbered button or by using an explicitly documented keyboard mapping.
- Input should be passed to the same game function as serial input.
- Results and leaderboard behavior must be identical to hardware mode.

Keep software mode separate from the hardware reader so test input cannot accidentally be mistaken for a physical serial event.

---

## 10. Web Serial API and Browser Requirements

### Supported environment

Use a current Chromium-based browser such as Google Chrome or Microsoft Edge on desktop. Web Serial is not supported in every browser.

Serve the frontend from a secure context:
- `http://localhost` through a local development server, or
- an HTTPS deployment.

Opening the HTML file directly as `file://` is not the recommended development path.

### Permission and connection behavior

- Call `navigator.serial.requestPort()` only in response to a user clicking **Connect ESP32**.
- Let the user select the correct serial port.
- Open the selected port at 115200 baud.
- Show a connecting state while the port opens.
- Handle cancellation and errors without crashing.
- Listen for disconnects where supported and update the UI.
- Release the reader lock and close the port when disconnecting or leaving hardware mode.
- Do not try to auto-select a port without the user's permission.
- Never assume a port is connected just because the browser supports Web Serial.

A minimal conceptual example:

```js
if (!("serial" in navigator)) {
  throw new Error("Web Serial is not supported in this browser.");
}

const port = await navigator.serial.requestPort();
await port.open({ baudRate: 115200 });
```

This snippet demonstrates the basic API only; the completed implementation must also include a line parser, lifecycle cleanup, and error handling.

---

## 11. Phase-by-Phase Implementation Plan

Complete each phase and verify its acceptance criteria before moving to the next. Keep changes small enough to test independently.

### Phase 0 — Confirm requirements and hardware mapping

**Tasks**
1. Confirm the actual GPIO pins connected to the four buttons.
2. Ensure each button connects its GPIO to GND when pressed.
3. Confirm the USB cable supports data.
4. Confirm Arduino IDE can upload to the board.
5. Agree on the serial protocol: `READY` optionally, followed by one line containing `1`, `2`, `3`, or `4` per press.

**Acceptance criteria**
- The physical pin mapping is written down.
- The code constants match the physical wiring.
- Each button can be identified unambiguously.
- No external backend is planned for this version.

### Phase 1 — Create the project skeleton

**Tasks**
1. Create the folder tree from Section 4.
2. Add `index.html`, `css/styles.css`, and the four JS files.
3. Use ES module scripts in HTML, for example `type="module"`.
4. Add basic page regions for setup, challenge, results, and leaderboard.
5. Add stable element IDs or another consistent DOM-selection strategy.

**Acceptance criteria**
- The page opens through a local server without missing-file errors.
- All required screens/regions exist.
- The browser console has no import or syntax errors.
- The layout works at desktop and mobile widths.

### Phase 2 — Build the visual interface

**Tasks**
1. Implement the IRIS visual theme in `styles.css`.
2. Build the player name form and mode-selection controls.
3. Build connection status, challenge prompt, question progress, and feedback areas.
4. Build result summary and leaderboard table/list.
5. Add disabled, hover, focus, loading, error, and completion states.
6. Use semantic buttons and labels; support keyboard navigation.

**Acceptance criteria**
- All screens are readable and usable without hardware.
- Start is disabled when the player name or input mode is missing.
- Status labels accurately represent the selected mode.
- No essential controls disappear on a narrow viewport.

### Phase 3 — Implement the game engine independently

**Tasks**
1. Implement question sequence generation and shuffle.
2. Implement round state: player, questions, current index, active target, start timestamp, times, status.
3. Implement question start and correct/incorrect answer handling.
4. Use `performance.now()` for timing.
5. Implement average calculation and result creation.
6. Keep this module independent of DOM and serial code.

**Acceptance criteria**
- Each round contains 1, 2, 3, and 4 exactly once.
- Correct inputs record one time and advance exactly one question.
- Wrong inputs do not advance or add a time.
- Extra inputs after completion are ignored.
- The average is correct for known test values (220, 245, 240, 255 → 240 ms).

### Phase 4 — Implement and test software mode

**Tasks**
1. Add on-screen numbered buttons or a documented keyboard mapping.
2. Route simulated inputs to the same game-engine API as hardware events.
3. Render the prompt, feedback, progress, and results.
4. Add play-again and return-to-setup behavior.

**Acceptance criteria**
- A complete four-question game can be played without an ESP32.
- Incorrect and correct inputs behave as specified.
- Results can be produced repeatedly without refreshing the page.
- Software mode never claims the ESP32 is connected.

### Phase 5 — Finalize ESP32 firmware and serial output

**Tasks**
1. Make the GPIO constants match the actual hardware.
2. Retain `Serial.begin(115200)`.
3. Configure all four pins using `INPUT_PULLUP`.
4. Retain or implement reliable debounce behavior.
5. Print only the corresponding button ID line when a debounced press is detected.
6. Optionally print `READY` once during setup.
7. Upload the sketch and test with Arduino IDE Serial Monitor.

**Acceptance criteria**
- Pressing each physical button produces its correct ID.
- Releasing a button does not generate a press event.
- Holding a button does not flood the serial output with repeated events.
- Serial Monitor shows one line per press.
- The baud rate matches the browser's 115200 setting.

**Important:** Close Serial Monitor before starting browser integration tests.

### Phase 6 — Implement browser serial integration

**Tasks**
1. In `hardware.js`, check whether `navigator.serial` exists.
2. Request the port only after a user click.
3. Open the port at 115200 baud.
4. Read from the stream using a `TextDecoderStream` or equivalent approach.
5. Buffer chunks and split complete newline-delimited messages.
6. Validate only the complete IDs `1`–`4`.
7. Forward valid IDs through `onButtonPress(buttonId)`.
8. Add connection status, errors, disconnect handling, and cleanup.
9. Prevent duplicate connections/read loops.
10. Ensure switching modes stops the previous input source.

**Acceptance criteria**
- The browser opens a port after explicit user action.
- A physical press reaches the frontend as the expected number.
- Startup messages and malformed lines are ignored.
- Multiple messages arriving in one chunk are all processed.
- Partial lines spanning chunks are processed correctly once complete.
- Disconnecting does not leave the app stuck in a connected state.
- No second reader is started accidentally.

### Phase 7 — Connect UI, game engine, and hardware

**Tasks**
1. Wire the Connect button to `hardware.js`.
2. Pass valid serial button IDs to the active game engine.
3. When a question is shown, record its timestamp.
4. Render correct/incorrect feedback.
5. Disable or ignore input during transitions and after completion.
6. Decide how to handle disconnection mid-round; recommended behavior is to stop the round and offer a restart rather than save an incomplete score.
7. Add play-again and mode-switch lifecycle handling.

**Acceptance criteria**
- The full round works with the real physical buttons.
- The target and button IDs match.
- Four successful responses produce four times and one average.
- Wrong presses do not corrupt the round.
- Disconnects and restarts do not produce duplicate event handlers or stale results.

### Phase 8 — Implement leaderboard persistence

**Tasks**
1. Choose and document the `localStorage` key.
2. Load and validate saved entries on startup.
3. Save only completed results.
4. Sort fastest scores first.
5. Render an empty state when no scores exist.
6. Prevent duplicate saves for the same result.
7. Handle storage/JSON errors gracefully.

**Acceptance criteria**
- A saved score appears immediately.
- Refreshing the page retains saved scores.
- Lower average times rank above higher times.
- Invalid stored data does not crash the app.
- A result cannot be accidentally saved repeatedly by clicking multiple times.
- The UI explains that scores are local to the current browser profile.

### Phase 9 — Integration testing and polish

**Tasks**
1. Test hardware and software mode separately.
2. Test wrong answers, rapid presses, and repeated clicks.
3. Test a mid-round disconnect.
4. Test a browser refresh and stored leaderboard.
5. Test port cancellation and unsupported-browser handling.
6. Test at desktop and mobile widths.
7. Check console errors and accessibility basics.
8. Update `README.md` with final setup steps and known limitations.

**Acceptance criteria**
- All test cases in Section 13 pass.
- No unhandled promise rejection occurs during ordinary connect/disconnect flows.
- No completed score is created from an incomplete round.
- The README instructions match the final file tree and implementation.

---

## 12. Run Instructions (Windows)

### A. Set up the frontend

1. Install or open Visual Studio Code.
2. Open the `iris-reflex-challenge` folder.
3. Create the files listed in Section 4.
4. Install/use a local development server extension such as **Live Server**, or use another local HTTP server.
5. Serve the project from `localhost`; do not rely on opening `index.html` directly as a file.
6. Open the page in current Chrome or Edge.
7. Open Developer Tools → Console to inspect any errors.

If the app uses ES modules, all relative import paths and filenames must match exactly, including letter casing.

### B. Upload firmware

1. Open Arduino IDE.
2. Select/install ESP32 board support if not already configured.
3. Open `firmware/esp32_reflex_game.ino`.
4. Select the appropriate ESP32 Dev Module/DevKit board and the correct COM port.
5. Verify the GPIO constants match the physical wiring.
6. Upload the sketch.
7. Open Serial Monitor at 115200 baud.
8. Press each button and confirm it prints the matching ID.
9. Close Serial Monitor.

The exact board menu names can vary by Arduino IDE and ESP32 board package version.

### C. Connect from the browser

1. Keep the ESP32 connected by USB.
2. Open the frontend in Chrome or Edge from `localhost` or HTTPS.
3. Enter a player name.
4. Click **Connect ESP32**.
5. Select the ESP32 serial port in the browser picker.
6. Confirm the UI reports `Connected`.
7. Start a round and press the requested physical buttons.
8. Review the results and save the score.

If connection fails, check that Serial Monitor and other serial-terminal applications are closed.

---

## 13. Testing Checklist

### Hardware and firmware

- [ ] Each button maps to the correct logical ID.
- [ ] Actual GPIO wiring matches the code constants.
- [ ] Button press reads LOW and release reads HIGH.
- [ ] Debouncing prevents repeated output while held.
- [ ] Firmware uses 115200 baud.
- [ ] Output uses one newline-delimited ID per press.

### Frontend and game logic

- [ ] Empty player name prevents starting.
- [ ] Every round contains each target number exactly once.
- [ ] Correct press records one reaction time.
- [ ] Wrong press shows feedback and keeps the same target.
- [ ] Extra presses during transition/completion are ignored.
- [ ] Four valid answers produce four times.
- [ ] Average of 220, 245, 240, 255 is 240 ms.
- [ ] Play Again resets round state and timestamps.

### Web Serial

- [ ] Unsupported browser shows a clear message.
- [ ] Port picker opens only after a user click.
- [ ] Port selection cancellation is handled.
- [ ] Startup `READY` is ignored as a button event.
- [ ] `1`, `2`, `3`, and `4` are accepted.
- [ ] Malformed lines are ignored.
- [ ] Several lines in one chunk are all parsed.
- [ ] A line split across chunks is parsed after its newline arrives.
- [ ] Disconnect updates the status and safely ends the round.
- [ ] Reconnect does not create duplicate readers.

### Leaderboard and persistence

- [ ] Completed results can be saved.
- [ ] Incomplete results cannot be saved as normal scores.
- [ ] Scores sort in ascending average milliseconds.
- [ ] Saved entries survive refresh.
- [ ] Corrupt storage data does not crash the page.
- [ ] Duplicate save attempts are blocked.
- [ ] Empty leaderboard displays a helpful empty state.

### UI and documentation

- [ ] Layout works on desktop and mobile.
- [ ] Buttons and inputs have clear labels.
- [ ] Keyboard focus is visible.
- [ ] Loading, error, success, and disconnected states are distinguishable.
- [ ] README contains correct wiring, run, and troubleshooting instructions.

---

## 14. Troubleshooting

### The browser does not show a serial connection option

- Use current Chrome or Edge on desktop.
- Serve the app through `localhost` or HTTPS.
- Make sure the Connect button calls `navigator.serial.requestPort()` from the click handler.
- Check that the browser supports Web Serial.

### The port picker opens but the ESP32 is missing

- Use a USB data cable, not a charge-only cable.
- Check Windows Device Manager for the COM port.
- Install the appropriate USB-to-serial driver if necessary for your board.
- Reconnect the board and reload the page if needed.

### The port is busy or fails to open

- Close Arduino IDE Serial Monitor.
- Close other serial-terminal tools that may have opened the same COM port.
- Unplug/replug the ESP32 if necessary, then try again.

### The frontend connects but button presses do nothing

- Verify the GPIO constants against the actual wires.
- Verify the firmware sends `1`, `2`, `3`, or `4` as individual lines.
- Confirm the browser opens at 115200 baud.
- Ensure the reader handles newline-delimited text, not just one read chunk per message.
- Check that `READY` is ignored and button messages reach the active game callback.

### The wrong button ID arrives

- Check the physical-to-logical mapping in firmware.
- Check that each GPIO is connected to the intended button and GND.
- Do not rely on the order of buttons on the breadboard; verify each one individually.

### The page works in software mode but not with hardware

- Test the firmware in Serial Monitor first.
- Close Serial Monitor before browser connection.
- Check the browser console and connection status.
- Verify that hardware callbacks call the same game-engine input method used by software mode.

### The leaderboard disappears after refresh

- Confirm the app uses the same origin every time (same scheme, host, and port).
- Confirm it writes to `localStorage` after saving.
- Check browser privacy settings and storage exceptions.
- Remember that `localStorage` is not shared between browsers, profiles, devices, or different origins.

### Reaction times seem slower than expected

- The recorded time includes browser event processing and serial/USB transport latency.
- Keep the firmware debounce interval reasonable.
- Avoid long `delay()` calls in firmware.
- Record the timestamp when the prompt is displayed and the timestamp when the complete serial line is received.
- Use the same timing method for every question so results remain comparable.

---

## 15. Implementation Rules and Common Pitfalls

1. **No unnecessary backend:** do not add a server or database for the required version.
2. **One serial protocol:** firmware and frontend must agree on the same message format.
3. **One source of game rules:** both hardware and software inputs must use `game.js`.
4. **One active input source:** do not run hardware and software input handlers simultaneously unless explicitly designed for that.
5. **Explicit user permission:** open the serial port only after a user action.
6. **Correct pin mapping:** GPIO constants must match the actual wiring.
7. **No incomplete scores:** a round must have four successful answers before normal score saving is allowed.
8. **Robust parsing:** serial reads are chunks; implement line buffering.
9. **Reliable cleanup:** release serial readers and close the port when appropriate.
10. **Truthful status:** never display connected when the board is disconnected.
11. **Local leaderboard limitation:** scores are stored only in the current browser profile/origin.
12. **Timing limitation:** browser-observed time includes serial transport latency; do not claim hardware-level timing precision.

---

## 16. Definition of Done

The project is complete when a developer can follow the README and:

- Wire the four buttons to the documented GPIO mapping.
- Upload the ESP32 firmware.
- Launch the frontend locally.
- Connect to the board through the browser's serial picker.
- Enter a name and complete a randomized four-question challenge using physical buttons.
- See accurate per-question reaction times and the calculated average.
- Save and view scores in a persistent local leaderboard.
- Play without hardware using software mode.
- Handle invalid input, unsupported browser, port errors, and disconnections without crashing.
- Run the test checklist and understand the local-only leaderboard and serial timing limitations.

**Final architecture:** browser frontend + ESP32 firmware + browser Local Storage. No application backend server is required for the specified scope.
