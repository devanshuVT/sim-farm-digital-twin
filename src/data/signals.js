// Shared data contract. Values are illustrative proxies, not validated fraud models.
export const SIGNALS = [
  { signal: 'cqi', agent: 'cqi', feature: 'quality_deficit', why: 'Mock radio-quality context', derive: v => (15 - v) / 15 },
  { signal: 'pusch_sinr', agent: 'mobility', feature: 'uplink_impairment', why: 'Mock uplink context; mobility not inferred', derive: v => (25 - v) / 25 },
  { signal: 'call_interval', agent: 'timing', feature: 'short_interval_score', why: 'Mock call-spacing context', derive: v => 1 - v / 120 },
  { signal: 'context_score', agent: 'context', feature: 'context_proxy', why: 'Placeholder synthetic context', derive: v => v },
]
export const RAW_TRAVEL_SECONDS = 1.8
export const OUTPUT_TRAVEL_SECONDS = 1.6
export const PROCESSING_MS = 300
export const REASONING_SECONDS = 1.6
export const DECISION_FLASH_SECONDS = .65
export const RETURN_SECONDS = 3.6
