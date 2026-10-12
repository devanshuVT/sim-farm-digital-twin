import { decisionDetails } from './reasoning-model.js'

export function createReasoningPanel(app, onOpen, onClose) {
  const dialog = document.createElement('dialog')
  dialog.className = 'reasoning-panel'; dialog.setAttribute('aria-labelledby', 'reasoning-title')
  dialog.innerHTML = `
    <div class="reasoning-heading"><p class="eyebrow">CALL / EVIDENCE REVIEW</p><button type="button" id="close-reasoning" aria-label="Close reasoning panel">×</button></div>
    <h2 id="reasoning-title"></h2>
    <div class="reasoning-verdict"><strong>FLAGGED</strong><span id="reasoning-confidence"></span></div>
    <p class="reasoning-time" id="reasoning-time"></p>
    <p class="reasoning-caption">Replay paused while you inspect this call.</p>
    <h3>Agent inputs</h3><div id="reasoning-inputs"></div>
    <h3>Synthesized reasoning</h3><p id="reasoning-trace"></p>
    <p class="reasoning-disclaimer">Synthetic replay · Confidence and contribution weights are authored mock data, not live model explanations.</p>`
  app.appendChild(dialog)
  const close = () => dialog.close()
  dialog.querySelector('#close-reasoning').addEventListener('click', close)
  dialog.addEventListener('close', onClose)
  // Dataset text is always written as text, never interpreted as HTML.
  const put = (selector, text) => { dialog.querySelector(selector).textContent = text }
  return {
    open(decision, byId) {
      const details = decisionDetails(decision, byId)
      dialog.dataset.verdict = details.verdict
      put('.reasoning-verdict strong', details.verdict.toUpperCase())
      put('#reasoning-title', details.ue)
      put('#reasoning-confidence', `${details.confidence} mock confidence`)
      put('#reasoning-time', `Recorded timestamp · ${details.timestamp}`)
      put('#reasoning-trace', details.trace)
      const inputs = dialog.querySelector('#reasoning-inputs'); inputs.replaceChildren()
      for (const input of details.inputs) {
        const row = document.createElement('article'); row.className = 'reasoning-input'
        row.innerHTML = `<div class="input-heading"><h4></h4><strong></strong></div><p class="input-feature"></p><p class="input-why"></p><p class="input-source"></p><div class="contribution-label"><span></span><b></b></div><div class="contribution-track"><div></div></div>`
        row.querySelector('h4').textContent = input.name
        row.querySelector('.input-heading strong').textContent = input.value
        row.querySelector('.input-feature').textContent = `${input.feature} · normalized 0–1`
        row.querySelector('.input-why').textContent = input.why
        row.querySelector('.input-source').textContent = `Source: ${input.source}`
        row.querySelector('.contribution-label span').textContent = input.leading ? 'Highest contribution' : 'Contribution'
        row.querySelector('.contribution-label b').textContent = `${input.percent}%`
        const bar = row.querySelector('.contribution-track > div'); bar.style.width = `${input.percent}%`; bar.style.background = input.color
        inputs.appendChild(row)
      }
      if (!dialog.open) { onOpen(); dialog.showModal() }
      dialog.scrollTop = 0; dialog.querySelector('#close-reasoning').focus()
    },
    close,
    dispose() { dialog.removeEventListener('close', onClose); dialog.remove() },
  }
}
