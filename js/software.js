// Software / demo input source. Uses the same onButtonPress(buttonId) callback as hardware.js,
// but is a separate module so test input can never be mistaken for a physical serial event.

// Inputs: the on-screen tiles (elements with data-button="1".."4") and keyboard keys 1-4.
// Returns a stop() function that removes every listener.
export function initSoftwareInput({ onButtonPress, buttonElements = [] }) {
  const cleanups = [];

  for (const el of buttonElements) {
    const id = Number(el.dataset.button);
    const handler = () => onButtonPress(id);
    el.addEventListener("click", handler);
    cleanups.push(() => el.removeEventListener("click", handler));
  }

  const keyHandler = (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[1-4]$/.test(event.key)) {
      const target = event.target;
      // Don't hijack typing in form fields.
      if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      onButtonPress(Number(event.key));
    }
  };
  document.addEventListener("keydown", keyHandler);
  cleanups.push(() => document.removeEventListener("keydown", keyHandler));

  return function stop() {
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
  };
}
