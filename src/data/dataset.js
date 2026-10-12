import { SIGNALS, RAW_TRAVEL_SECONDS, OUTPUT_TRAVEL_SECONDS, REASONING_SECONDS, DECISION_FLASH_SECONDS, RETURN_SECONDS } from './signals.js'

export const MAX_DATASET_BYTES = 1024 * 1024
const fail = message => { throw new Error(message) }
const validText = (value, limit = 120) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit
const number = value => typeof value === 'number' && Number.isFinite(value)
export function parseDataset(text) {
  if (new TextEncoder().encode(text).length > MAX_DATASET_BYTES) fail('Dataset is too large. Use a JSON file under 1 MB.')
  let data
  try { data = JSON.parse(text) } catch { fail('Invalid JSON. Paste the complete generated array, including its opening [ and closing ].') }
  if (!Array.isArray(data) || data.length === 0 || data.length > 1000) fail('Use a non-empty JSON array of up to 1,000 events.')
  const ids = new Map(), ueIds = new Set()
  const events = data.map((source, index) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) fail(`Event ${index + 1} must be an object.`)
    const e = { ...source }
    e.kind ??= e.verdict !== undefined ? 'core_decision' : e.agent_id !== undefined ? 'agent_output' : 'raw'
    if (!['raw', 'agent_output', 'core_decision'].includes(e.kind)) fail(`Event ${index + 1}: unknown kind.`)
    if (!validText(e.id) || ids.has(e.id)) fail(`Event ${index + 1}: id must be a unique non-empty string.`)
    if (!validText(e.ue_id, 64)) fail(`${e.id}: ue_id is required (maximum 64 characters).`)
    if (!number(e.timestamp) || e.timestamp < 0 || e.timestamp > 600000) fail(`${e.id}: timestamp must be milliseconds from replay start, between 0 and 600000.`)
    ids.set(e.id, e); ueIds.add(e.ue_id)
    return e
  }).sort((a, b) => a.timestamp - b.timestamp)
  if (ueIds.size > 64) fail('Use at most 64 SIMs for this small demo.')
  const raw = events.filter(e => e.kind === 'raw'), inputs = events.filter(e => e.kind === 'agent_output'), decisions = events.filter(e => e.kind === 'core_decision')
  if (!raw.length || !inputs.length || !decisions.length) fail('Include raw, agent_output, and core_decision events. Generate an example to see the complete format.')
  const origins = new Map(), seenInputs = new Set(), usedRaw = new Set(), usedInputs = new Set(), decided = new Set()
  for (const e of raw) {
    if (!/^tower_[1-8]$/.test(e.tower_id) || !SIGNALS.some(s => s.signal === e.signal_type) || !number(e.value)) fail(`${e.id}: use tower_1–tower_8, a supported signal_type, and a finite numeric value.`)
    const range = { cqi: [0, 15], pusch_sinr: [-30, 50], call_interval: [0, 3600], context_score: [0, 1] }[e.signal_type]
    if (e.value < range[0] || e.value > range[1]) fail(`${e.id}: ${e.signal_type} must be between ${range[0]} and ${range[1]}.`)
    if (origins.has(e.ue_id) && origins.get(e.ue_id) !== e.tower_id) fail(`${e.ue_id}: all raw records for a call must use the same tower.`)
    origins.set(e.ue_id, e.tower_id)
  }
  for (const e of inputs) {
    const signal = SIGNALS.find(s => s.agent === e.agent_id)
    if (!signal || !validText(e.feature) || !number(e.value) || e.value < 0 || e.value > 1) fail(`${e.id}: use a supported agent_id, feature name, and normalized value from 0 to 1.`)
    const key = `${e.ue_id}:${e.agent_id}`
    if (seenInputs.has(key)) fail(`${e.ue_id}: provide one input per agent. Use a distinct ue_id for another call.`)
    seenInputs.add(key)
    if (!Array.isArray(e.derived_from) || !e.derived_from.length || new Set(e.derived_from).size !== e.derived_from.length) fail(`${e.id}: derived_from must list unique raw event IDs.`)
    for (const id of e.derived_from) {
      const source = ids.get(id)
      if (!source || source.kind !== 'raw' || source.ue_id !== e.ue_id || source.signal_type !== signal.signal) fail(`${e.id}: derived_from must reference raw records of the same SIM and agent signal.`)
      if (e.timestamp < source.timestamp + RAW_TRAVEL_SECONDS * 1000 + 50) fail(`${e.id}: allow at least 1850 ms after each raw record for visual arrival.`)
      usedRaw.add(id)
    }
  }
  for (const e of decisions) {
    if (decided.has(e.ue_id)) fail(`${e.ue_id}: provide one decision per SIM in a loop.`)
    decided.add(e.ue_id)
    if (!['clean', 'flagged'].includes(e.verdict) || !number(e.confidence) || e.confidence < 0 || e.confidence > 1 || !validText(e.reasoning_trace, 2000)) fail(`${e.id}: specify clean/flagged, confidence from 0 to 1, and a reasoning_trace.`)
    if (!Array.isArray(e.agent_inputs) || e.agent_inputs.length !== 4 || new Set(e.agent_inputs).size !== 4) fail(`${e.id}: agent_inputs must contain four distinct agent-output IDs.`)
    const agentIds = new Set()
    for (const id of e.agent_inputs) {
      const input = ids.get(id)
      if (!input || input.kind !== 'agent_output' || input.ue_id !== e.ue_id) fail(`${e.id}: agent_inputs must reference outputs for the same SIM.`)
      if (e.timestamp < input.timestamp + OUTPUT_TRAVEL_SECONDS * 1000 + 50) fail(`${e.id}: allow at least 1650 ms after each agent output for core arrival.`)
      agentIds.add(input.agent_id); usedInputs.add(id)
    }
    if (agentIds.size !== 4) fail(`${e.id}: include all four agent perspectives.`)
    if (e.contributions !== undefined) {
      if (!Array.isArray(e.contributions) || e.contributions.length !== 4 || new Set(e.contributions.map(c => c?.agent_id)).size !== 4 || !e.contributions.every(c => c && agentIds.has(c.agent_id) && number(c.weight) && c.weight >= 0 && c.weight <= 1) || Math.abs(e.contributions.reduce((sum, c) => sum + c.weight, 0) - 1) > .001) fail(`${e.id}: contributions must contain four agent weights summing to 1.`)
    } else e.contributions = [...agentIds].map(agent_id => ({ agent_id, weight: .25 }))
    e.tower_id = origins.get(e.ue_id)
  }
  if (usedRaw.size !== raw.length || usedInputs.size !== inputs.length || decided.size !== ueIds.size) fail('Every raw event must be referenced by an input, and every SIM must have a complete four-input decision.')
  // Reserve enough time for queued visual reasoning and the final return pulse.
  let presentationEnd = 0
  for (const e of decisions) presentationEnd = Math.max(presentationEnd, e.timestamp) + (REASONING_SECONDS + DECISION_FLASH_SECONDS) * 1000
  const duration = Math.ceil((presentationEnd + (RETURN_SECONDS + 2) * 1000) / 1000) * 1000
  return { events, duration, summary: { raw: raw.length, inputs: inputs.length, decisions: decisions.length, sims: ueIds.size, flagged: decisions.filter(e => e.verdict === 'flagged').length }, byId: ids }
}
