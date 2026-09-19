(() => {
  if (window.__contextNinjaRecorder) return;
  window.__contextNinjaRecorder = true;

  function uid() {
    return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return "document";
    if (el.id) return `#${cssEscape(el.id)}`;

    const testId =
      el.getAttribute("data-testid") ||
      el.getAttribute("data-test") ||
      el.getAttribute("name");
    if (testId) {
      const attr = el.getAttribute("data-testid")
        ? "data-testid"
        : el.getAttribute("data-test")
          ? "data-test"
          : "name";
      return `${el.tagName.toLowerCase()}[${attr}="${cssEscape(testId)}"]`;
    }

    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      if (node.classList.length) {
        part += `.${Array.from(node.classList).slice(0, 2).map(cssEscape).join(".")}`;
      }
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (child) => child.tagName === node.tagName,
        );
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
        }
      }
      parts.unshift(part);
      if (node.id) {
        parts[0] = `#${cssEscape(node.id)}`;
        break;
      }
      node = parent;
    }
    return parts.join(" > ");
  }

  function visibleText(el) {
    const labeled =
      el.getAttribute("aria-label") ||
      el.getAttribute("placeholder") ||
      el.getAttribute("title") ||
      (el.labels && el.labels[0] && el.labels[0].innerText);
    if (labeled) return labeled.trim().slice(0, 80);
    return (el.innerText || el.value || "").trim().slice(0, 80);
  }

  function emit(partial) {
    chrome.runtime
      .sendMessage({
        type: "event",
        event: {
          id: uid(),
          ts: Date.now(),
          url: location.href,
          title: document.title,
          ...partial,
        },
      })
      .catch(() => {});
  }

  function onClick(event) {
    const el = event.target.closest("a,button,input,select,textarea,summary,[role='button']") || event.target;
    emit({
      type: "click",
      selector: selectorFor(el),
      tagName: el.tagName,
      text: visibleText(el),
      href: el.href || undefined,
    });
  }

  function onInput(event) {
    const el = event.target;
    if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA" && el.tagName !== "SELECT")) {
      return;
    }
    const isSecret = el.type === "password";
    emit({
      type: el.tagName === "SELECT" ? "change" : "input",
      selector: selectorFor(el),
      tagName: el.tagName,
      text: visibleText(el),
      value: isSecret ? "••••" : String(el.value || "").slice(0, 120),
    });
  }

  function onSubmit(event) {
    const el = event.target;
    emit({
      type: "submit",
      selector: selectorFor(el),
      tagName: el.tagName,
      text: visibleText(el),
    });
  }

  function onKey(event) {
    if (event.key !== "Enter" && event.key !== "Tab" && event.key !== "Escape") return;
    const el = event.target;
    emit({
      type: "keydown",
      selector: selectorFor(el),
      tagName: el.tagName,
      text: visibleText(el),
      value: event.key,
    });
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("change", onInput, true);
  document.addEventListener("submit", onSubmit, true);
  document.addEventListener("keydown", onKey, true);

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "stop") {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("keydown", onKey, true);
      window.__contextNinjaRecorder = false;
    }
  });
})();
