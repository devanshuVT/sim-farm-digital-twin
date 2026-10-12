// Small simulation steps preserve event/animation ordering at either speed.
export function createMeetingClock() {
  let fast = false
  return {
    toggle() { fast = !fast; return fast },
    get speed() { return fast ? 10 : 1 },
    advance(dt, step) {
      const total = dt * (fast ? 10 : 1)
      const count = Math.max(1, Math.ceil(total / .05))
      for (let i = 0; i < count; i++) step(total / count)
    },
  }
}

export function createDecisionHistory() {
  const entries = []
  return {
    entries,
    record(decision, byId) {
      // Keep this occurrence's evidence independent of future loops/datasets.
      const evidence = new Map()
      for (const id of decision.agent_inputs) {
        const input = byId.get(id)
        evidence.set(id, structuredClone(input))
        for (const rawId of input.derived_from) evidence.set(rawId, structuredClone(byId.get(rawId)))
      }
      const entry = { sequence: entries.length + 1, decision: structuredClone(decision), byId: evidence }
      entries.unshift(entry)
      return entry
    },
  }
}
