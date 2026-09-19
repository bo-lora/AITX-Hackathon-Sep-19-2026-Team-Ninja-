const WEBAPP = "http://127.0.0.1:43123";

const statusEl = document.getElementById("status");
const hintEl = document.getElementById("hint");
const createBtn = document.getElementById("create");
const doneBtn = document.getElementById("done");

function setHint(text, isError = false) {
  hintEl.textContent = text;
  hintEl.classList.toggle("error", isError);
}

function render(recording) {
  statusEl.textContent = recording ? "Recording" : "Idle";
  statusEl.classList.toggle("live", recording);
  createBtn.disabled = recording;
  doneBtn.disabled = !recording;
}

async function refresh() {
  const { recording } = await chrome.runtime.sendMessage({ type: "get-state" });
  render(Boolean(recording));
}

createBtn.addEventListener("click", async () => {
  setHint("");
  const result = await chrome.runtime.sendMessage({ type: "start" });
  if (result?.error) {
    setHint(result.error, true);
    return;
  }
  render(true);
  setHint("Do the real workflow, then click Done.");
});

doneBtn.addEventListener("click", async () => {
  setHint("Sending session to the webapp…");
  const result = await chrome.runtime.sendMessage({
    type: "stop",
    webapp: WEBAPP,
  });
  if (result?.error) {
    setHint(result.error, true);
    render(true);
    return;
  }
  render(false);
  setHint("Opened the workflow in the webapp.");
});

refresh();
