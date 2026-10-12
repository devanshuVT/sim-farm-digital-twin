// Stream adapter boundary: event consumers are independent of mock generation.
export function createReplay(events, duration) {
  let elapsed = 0, cursor = 0, running = true
  const listeners = new Set(), loopListeners = new Set()
  function dispatch() {
    while (cursor < events.length && events[cursor].timestamp <= elapsed) {
      for (const listener of listeners) listener(events[cursor])
      cursor++
    }
  }
  return {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    onLoop(listener) { loopListeners.add(listener); return () => loopListeners.delete(listener) },
    start() { running = true }, pause() { running = false },
    update(dt) {
      if (!running) return
      elapsed += dt * 1000
      while (elapsed >= duration) {
        dispatch(); elapsed -= duration; cursor = 0
        for (const listener of loopListeners) listener()
      }
      dispatch()
    },
    dispose() { listeners.clear(); loopListeners.clear() },
  }
}
