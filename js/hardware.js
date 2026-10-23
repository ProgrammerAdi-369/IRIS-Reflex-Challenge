// Web Serial input for the ESP32. Reads newline-delimited messages and reports valid button IDs.
// It does not decide whether a press is correct or compute scores.

const BAUD_RATE = 115200;
const BUTTON_LINE = /^[1-4]$/;

let session = null; // { port, reader, closing }

export function isSerialSupported() {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

// Pure helper: append `chunk` to `buffer`, return the button IDs found in complete lines
// and the remaining incomplete fragment. Anything other than "1".."4" is ignored.
export function parseSerialChunk(buffer, chunk) {
  const parts = (buffer + chunk).split("\n");
  const rest = parts.pop(); // incomplete trailing fragment (possibly "")
  const ids = [];
  for (const line of parts) {
    const trimmed = line.trim(); // also strips "\r"
    if (BUTTON_LINE.test(trimmed)) ids.push(Number(trimmed));
  }
  return { ids, rest };
}

function describeOpenError(err) {
  if (err && err.name === "NotFoundError") return "No port was selected.";
  if (err && (err.name === "NetworkError" || err.name === "InvalidStateError")) {
    return "The port is busy or cannot be opened. Close Arduino Serial Monitor or other serial tools and try again.";
  }
  return `Could not connect: ${err && err.message ? err.message : err}`;
}

// Must be called from a user gesture (click). Resolves true when connected.
export async function connectHardware({ onButtonPress, onStatus, onError }) {
  if (!isSerialSupported()) {
    onError("Web Serial is not supported in this browser. Use Chrome or Edge on desktop, or use Software Mode.");
    onStatus("disconnected");
    return false;
  }
  if (session) {
    onError("The ESP32 is already connected or connecting.");
    return false;
  }

  onStatus("connecting");
  const current = { port: null, reader: null, closing: false };
  session = current; // claim the slot before any await to block duplicate connections

  try {
    current.port = await navigator.serial.requestPort();
    await current.port.open({ baudRate: BAUD_RATE });
  } catch (err) {
    const cancelled = err && err.name === "NotFoundError";
    await teardown(current);
    onError(describeOpenError(err));
    onStatus("disconnected", { cancelled });
    return false;
  }

  const onPortDisconnect = (event) => {
    if (event.target === current.port || event.port === current.port) handleLost(null);
  };
  navigator.serial.addEventListener("disconnect", onPortDisconnect);
  current.removeListener = () => navigator.serial.removeEventListener("disconnect", onPortDisconnect);

  let lostReported = false;
  function handleLost(err) {
    if (lostReported || current.closing) return;
    lostReported = true;
    teardown(current).finally(() => {
      onError(err ? `Connection lost: ${err.message || err}` : "The ESP32 was disconnected.");
      onStatus("disconnected", { lost: true });
    });
  }

  onStatus("connected");
  readLoop(current, onButtonPress).then(
    () => handleLost(null),
    (err) => handleLost(err)
  );
  return true;
}

async function readLoop(current, onButtonPress) {
  const decoder = new TextDecoderStream();
  const closed = current.port.readable.pipeTo(decoder.writable).catch(() => {});
  current.pipeClosed = closed;
  const reader = decoder.readable.getReader();
  current.reader = reader;

  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const receivedAt = performance.now(); // timestamp when this chunk reaches the page
      const parsed = parseSerialChunk(buffer, value);
      buffer = parsed.rest;
      for (const id of parsed.ids) onButtonPress(id, receivedAt);
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}

async function teardown(current) {
  current.closing = true;
  if (current.removeListener) current.removeListener();
  try { if (current.reader) await current.reader.cancel(); } catch { /* ignore */ }
  try { if (current.pipeClosed) await current.pipeClosed; } catch { /* ignore */ }
  try { if (current.port) await current.port.close(); } catch { /* ignore */ }
  if (session === current) session = null;
}

// Intentional disconnect (user leaves hardware mode). Does not emit lost/disconnect errors.
export async function disconnectHardware() {
  if (!session) return;
  await teardown(session);
}
