import { AGENT_DEFINITIONS } from '../agents.js'
import { SIGNALS } from '../data/signals.js'

export function decisionDetails(decision, byId) {
  const inputs = decision.agent_inputs.map(id => byId.get(id))
  const maximum = Math.max(...decision.contributions.map(item => item.weight))
  return {
    ue: decision.ue_id, timestamp: `${(decision.timestamp / 1000).toFixed(3)} s from replay start`,
    verdict: decision.verdict, confidence: `${Math.round(decision.confidence * 100)}%`, trace: decision.reasoning_trace,
    inputs: inputs.map(input => {
      const definition = AGENT_DEFINITIONS.find(agent => agent.id === input.agent_id)
      const weight = decision.contributions.find(item => item.agent_id === input.agent_id).weight
      return { name: definition.name, color: definition.color, feature: input.feature.replaceAll('_', ' '), value: input.value.toFixed(3),
        why: typeof input.why === 'string' && input.why ? input.why : SIGNALS.find(signal => signal.agent === input.agent_id).why,
        percent: Math.round(weight * 100), leading: weight === maximum,
        source: input.derived_from.map(id => { const raw = byId.get(id); return `${raw.signal_type}: ${raw.value}` }).join(' · ') }
    }),
  }
}
