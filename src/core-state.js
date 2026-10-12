import { REASONING_SECONDS, DECISION_FLASH_SECONDS } from './data/signals.js'

export function createCoreState() {
  const evidence = new Map(), inFlight = new Set(), pending = [], knownDecisions = new Set()
  let state = 'idle', hold = 0, total = 0, latest = null, activeDecision = null, elapsed = 0, decisionCount = 0, lastDecision = null
  return {
    begin(input) { inFlight.add(input.id); if (!activeDecision) state = 'aggregation' },
    receive(input) {
      inFlight.delete(input.id)
      if (!evidence.has(input.ue_id)) evidence.set(input.ue_id, new Map())
      const inputs = evidence.get(input.ue_id)
      if (inputs.get(input.agent_id)?.id === input.id) return
      inputs.set(input.agent_id, input); total++; latest = input; hold = 1.2
      if (!activeDecision) state = 'aggregation'
    },
    enqueue(decision) {
      if (knownDecisions.has(decision.id)) return
      knownDecisions.add(decision.id); pending.push(decision)
    },
    update(dt) {
      const emitted = []
      hold = Math.max(0, hold - dt)
      if (activeDecision) {
        elapsed += dt
        if (state === 'reasoning' && elapsed >= REASONING_SECONDS) {
          elapsed -= REASONING_SECONDS; state = 'decision'; decisionCount++; lastDecision = activeDecision; emitted.push(activeDecision)
        }
        if (state === 'decision' && elapsed >= DECISION_FLASH_SECONDS) { activeDecision = null; elapsed = 0 }
      }
      if (!activeDecision) {
        const index = pending.findIndex(decision => {
          const arrived = new Set([...(evidence.get(decision.ue_id)?.values() ?? [])].map(input => input.id))
          return decision.agent_inputs.every(id => arrived.has(id))
        })
        if (index >= 0) { activeDecision = pending.splice(index, 1)[0]; state = 'reasoning'; elapsed = 0 }
        else state = inFlight.size || hold > 0 ? 'aggregation' : 'idle'
      }
      return emitted
    },
    reset() {
      evidence.clear(); inFlight.clear(); pending.length = 0; knownDecisions.clear()
      state = 'idle'; hold = 0; total = 0; latest = null; activeDecision = null; elapsed = 0; decisionCount = 0; lastDecision = null
    },
    snapshot() {
      const focused = activeDecision?.ue_id ?? latest?.ue_id
      return { state, total, inFlight: inFlight.size, ueCount: evidence.size, latest, latestInputs: focused ? [...evidence.get(focused).values()] : [], activeDecision, lastDecision, decisionCount, queued: pending.length, reasoningStep: Math.min(3, Math.floor(elapsed / REASONING_SECONDS * 4)), reasoningProgress: elapsed / REASONING_SECONDS }
    },
  }
}
