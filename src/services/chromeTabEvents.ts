import { hasChromeTabApis } from "./chromeTabs";

export type Unsubscribe = () => void;

const TAB_EVENT_NAMES = [
  "onCreated",
  "onRemoved",
  "onUpdated",
  "onMoved",
  "onActivated",
  "onAttached",
  "onDetached",
  "onReplaced"
] as const;

const TAB_GROUP_EVENT_NAMES = ["onCreated", "onUpdated", "onMoved", "onRemoved"] as const;

export function subscribeToOpenTabChanges(onChange: () => void, debounceMs = 180): Unsubscribe {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const cleanupCallbacks: Unsubscribe[] = [];

  const scheduleChange = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(onChange, debounceMs);
  };

  if (!hasChromeTabApis()) {
    const intervalId = setInterval(onChange, 2000);
    return () => clearInterval(intervalId);
  }

  const addEventListener = (eventLike: unknown) => {
    if (!isChromeEvent(eventLike)) return;
    eventLike.addListener(scheduleChange);
    cleanupCallbacks.push(() => eventLike.removeListener(scheduleChange));
  };

  for (const eventName of TAB_EVENT_NAMES) {
    addEventListener(chrome.tabs[eventName]);
  }

  if (chrome.tabGroups) {
    for (const eventName of TAB_GROUP_EVENT_NAMES) {
      addEventListener(chrome.tabGroups[eventName]);
    }
  }

  if (cleanupCallbacks.length === 0) {
    const intervalId = setInterval(onChange, 2000);
    cleanupCallbacks.push(() => clearInterval(intervalId));
  }

  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    cleanupCallbacks.forEach((cleanup) => cleanup());
  };
}

function isChromeEvent(value: unknown): value is {
  addListener: (listener: () => void) => void;
  removeListener: (listener: () => void) => void;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "addListener" in value &&
    "removeListener" in value &&
    typeof value.addListener === "function" &&
    typeof value.removeListener === "function"
  );
}
