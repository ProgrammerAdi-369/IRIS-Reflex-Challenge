// Keyboard input: keys 1-4 (top row or numpad). Returns a stop() function.
export function initKeyboardInput(onButtonPress) {
  const keyHandler = (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!/^[1-4]$/.test(event.key)) return;
    // Don't hijack typing in form fields.
    if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
    onButtonPress(Number(event.key));
  };
  document.addEventListener("keydown", keyHandler);
  return () => document.removeEventListener("keydown", keyHandler);
}
