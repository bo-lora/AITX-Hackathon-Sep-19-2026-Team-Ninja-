const DEFAULT_WEBAPP = "http://127.0.0.1:43123";

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getState() {
  const stored = await chrome.storage.session.get([
    "recording",
    "session",
    "tabId",
  ]);
  return {
    recording: Boolean(stored.recording),
    session: stored.session || null,
    tabId: stored.tabId || null,
  };
}

async function setBadge(recording) {
  await chrome.action.setBadgeBackgroundColor({ color: "#ffb000" });
  await chrome.action.setBadgeText({ text: recording ? "REC" : "" });
}

async function injectRecorder(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => sendResponse({ error: error.message || String(error) }));
  return true;
});

async function handleMessage(message, sender) {
  if (message.type === "get-state") {
    return getState();
  }

  if (message.type === "start") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id || !tab.url || tab.url.startsWith("chrome://")) {
      throw new Error("Open a normal web page, then click Create skill.");
    }

    const session = {
      id: uid("session"),
      createdAt: new Date().toISOString(),
      title: tab.title || "Untitled workflow",
      startUrl: tab.url,
      events: [
        {
          id: uid("evt"),
          ts: Date.now(),
          type: "navigate",
          url: tab.url,
          selector: "document",
          href: tab.url,
          title: tab.title || "",
        },
      ],
      steps: [],
    };

    await chrome.storage.session.set({
      recording: true,
      session,
      tabId: tab.id,
    });
    await setBadge(true);
    await injectRecorder(tab.id);
    return { ok: true };
  }

  if (message.type === "event") {
    const state = await getState();
    if (!state.recording || !state.session) return { ok: false };
    state.session.events.push(message.event);
    if (message.event.title) state.session.title = message.event.title;
    await chrome.storage.session.set({ session: state.session });
    return { ok: true };
  }

  if (message.type === "stop") {
    const state = await getState();
    if (!state.session) throw new Error("No recording in progress.");

    const webapp = message.webapp || DEFAULT_WEBAPP;
    const response = await fetch(`${webapp}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.session),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Webapp did not accept the session (${response.status}). Is it running at ${webapp}? ${detail.slice(0, 180)}`,
      );
    }

    const payload = await response.json();
    await chrome.storage.session.set({
      recording: false,
      session: null,
      tabId: null,
    });
    await setBadge(false);

    if (state.tabId) {
      chrome.tabs.sendMessage(state.tabId, { type: "stop" }).catch(() => {});
    }

    const workflowUrl = payload.workflowUrl || `${webapp}/workflows/${state.session.id}`;
    await chrome.tabs.create({ url: workflowUrl });
    return { ok: true, workflowUrl };
  }

  if (message.type === "stopped-from-tab" && sender.tab?.id) {
    return { ok: true };
  }

  return { ok: false };
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const state = await getState();
  if (!state.recording || state.tabId !== tabId || !changeInfo.url || !state.session) {
    return;
  }

  state.session.events.push({
    id: uid("evt"),
    ts: Date.now(),
    type: "navigate",
    url: changeInfo.url,
    selector: "document",
    href: changeInfo.url,
    title: tab.title || "",
  });
  await chrome.storage.session.set({ session: state.session });
  try {
    await injectRecorder(tabId);
  } catch {
    // Restricted pages cannot host the recorder.
  }
});
