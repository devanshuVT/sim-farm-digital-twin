import { SIGNALS, RAW_TRAVEL_SECONDS, OUTPUT_TRAVEL_SECONDS, PROCESSING_MS } from './signals.js'

export const REPLAY_DURATION_MS = 72000
export function generateRawEvents(seed = 42) {
  let state = seed >>> 0
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296 }
  // Exactly 2 of 16 randomly chosen SIMs are positive examples (12.5%).
  const shuffled = Array.from({ length: 16 }, (_, i) => i)
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const flagged = new Set(shuffled.slice(0, 2))
  return Array.from({ length: 64 }, (_, index) => {
    const call = Math.floor(index / 4), signalIndex = index % 4
    const type = SIGNALS[signalIndex].signal, positive = flagged.has(call)
    const value = type === 'cqi' ? Math.round(positive ? 3 + random() * 3 : 10 + random() * 5)
      : type === 'pusch_sinr' ? +(positive ? 2 + random() * 4 : 16 + random() * 9).toFixed(1)
      : type === 'call_interval' ? +(positive ? 2 + random() * 5 : 70 + random() * 50).toFixed(1)
      : +(positive ? .8 + random() * .2 : random() * .3).toFixed(2)
    return { kind: 'raw', id: `raw_${index + 1}`, timestamp: call * 4000 + signalIndex * 180, tower_id: `tower_${call % 8 + 1}`, ue_id: `SIM-${1001 + call}`, signal_type: type, value }
  })
}
export function generateEvents(seed = 42) {
  const raw = generateRawEvents(seed)
  const outputs = raw.map(event => {
    const signal = SIGNALS.find(s => s.signal === event.signal_type)
    return {
      kind: 'agent_output', id: `input_${event.id}`, timestamp: event.timestamp + RAW_TRAVEL_SECONDS * 1000 + PROCESSING_MS,
      agent_id: signal.agent, ue_id: event.ue_id, feature: signal.feature,
      value: +Math.max(0, Math.min(1, signal.derive(event.value))).toFixed(3),
      derived_from: [event.id], why: signal.why,
    }
  })
  const decisions = [...new Set(raw.map(e => e.ue_id))].map((ue, index) => {
    const inputs = outputs.filter(e => e.ue_id === ue)
    const weights = { cqi: .15, mobility: .2, timing: .5, context: .15 }
    const score = inputs.reduce((sum, input) => sum + input.value * weights[input.agent_id], 0)
    const flagged = score > .65
    return {
      kind: 'core_decision', id: `decision_${index + 1}`, timestamp: Math.max(...inputs.map(e => e.timestamp)) + OUTPUT_TRAVEL_SECONDS * 1000 + 100,
      ue_id: ue, agent_inputs: inputs.map(input => input.id), verdict: flagged ? 'flagged' : 'clean',
      confidence: +(flagged ? .85 + score * .1 : .87 + (1 - score) * .1).toFixed(3),
      contributions: inputs.map(input => ({ agent_id: input.agent_id, weight: weights[input.agent_id] })),
      reasoning_trace: flagged
        ? 'This synthetic example combines unusually short call intervals with elevated radio and context proxy scores. The mock fusion result flags the call for review; this is scripted evidence, not a validated fraud assessment.'
        : 'The synthetic call-spacing, radio and context proxies are within the demo baseline. The mock fusion result marks this call clean.',
    }
  })
  return [...raw, ...outputs, ...decisions].sort((a, b) => a.timestamp - b.timestamp)
}
