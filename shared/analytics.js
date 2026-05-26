const STORAGE_KEY = "whitelab.autopilot.events";
const MAX_EVENTS = 200;

function safeProps(props = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    clean[key] = String(value).slice(0, 240);
  }
  return clean;
}

function storeLocalEvent(event) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    existing.unshift(event);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_EVENTS)));
  } catch {
    /* localStorage may be unavailable */
  }
}

export function trackEvent(name, props = {}) {
  const event = {
    name,
    props: safeProps({
      path: window.location.pathname,
      ...props,
    }),
    timestamp: new Date().toISOString(),
  };

  storeLocalEvent(event);

  if (typeof window.plausible === "function") {
    window.plausible(name, { props: event.props });
  }

  if (window.posthog?.capture) {
    window.posthog.capture(name, event.props);
  }

  window.dispatchEvent(new CustomEvent("whitelab:analytics", { detail: event }));
}

export function getLocalEvents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
