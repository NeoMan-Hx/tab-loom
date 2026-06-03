import { afterEach, describe, expect, it, vi } from "vitest";
import { subscribeToOpenTabChanges } from "./chromeTabEvents";

const originalChrome = globalThis.chrome;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, "chrome", {
    value: originalChrome,
    configurable: true
  });
});

describe("subscribeToOpenTabChanges", () => {
  it("subscribes to Chrome tab events and debounces refreshes", () => {
    vi.useFakeTimers();
    const onCreated = createChromeEvent();
    const onUpdated = createChromeEvent();
    const onGroupUpdated = createChromeEvent();
    Object.defineProperty(globalThis, "chrome", {
      value: {
        tabs: {
          query: vi.fn(),
          onCreated,
          onUpdated
        },
        tabGroups: {
          onUpdated: onGroupUpdated
        }
      },
      configurable: true
    });

    const refresh = vi.fn();
    const unsubscribe = subscribeToOpenTabChanges(refresh, 100);
    onCreated.emit();
    onUpdated.emit();
    onGroupUpdated.emit();
    vi.advanceTimersByTime(99);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    unsubscribe();
    onCreated.emit();
    vi.advanceTimersByTime(100);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("falls back to polling when Chrome tab APIs are unavailable", () => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, "chrome", {
      value: undefined,
      configurable: true
    });

    const refresh = vi.fn();
    const unsubscribe = subscribeToOpenTabChanges(refresh);
    vi.advanceTimersByTime(2000);
    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
    vi.advanceTimersByTime(2000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

function createChromeEvent() {
  const listeners = new Set<() => void>();
  return {
    addListener: vi.fn((listener: () => void) => listeners.add(listener)),
    removeListener: vi.fn((listener: () => void) => listeners.delete(listener)),
    emit: () => listeners.forEach((listener) => listener())
  };
}
