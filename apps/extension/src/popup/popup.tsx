// Popup UI — Start / Stop controls for the user.
// Sends capture.start / capture.stop messages to the background service worker.
// Listens for capture.state to update button states.

const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const stopBtn = document.getElementById("stop-btn") as HTMLButtonElement;

function setUIState(status: "idle" | "capturing" | "error"): void {
  switch (status) {
    case "idle":
      startBtn.disabled = false;
      stopBtn.disabled = true;
      startBtn.textContent = "Start";
      break;
    case "capturing":
      startBtn.disabled = true;
      stopBtn.disabled = false;
      startBtn.textContent = "Recording…";
      break;
    case "error":
      startBtn.disabled = false;
      stopBtn.disabled = true;
      startBtn.textContent = "Start";
      break;
  }
}

startBtn.addEventListener("click", async () => {
  chrome.runtime.sendMessage({ type: "capture.start" });
  // Open side panel so user can see transcript immediately
  try {
    const currentWindow = await chrome.windows.getCurrent();
    if (currentWindow.id != null) {
      await chrome.sidePanel.open({ windowId: currentWindow.id });
    }
  } catch (err) {
    console.warn("[popup] failed to open side panel:", err);
  }
  window.close(); // Close popup after starting
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "capture.stop" });
});

// Listen for state updates from service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "capture.state") {
    setUIState(message.status);
  }
});

// Query current state on open
chrome.runtime.sendMessage({ type: "capture.state" }).catch(() => {
  // service worker may not be ready; default to idle state
});

console.log("[popup] Kotomi popup ready");
