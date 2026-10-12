import { generateEvents } from '../data/generator.js'
import { parseDataset, MAX_DATASET_BYTES } from '../data/dataset.js'

export function createDatasetPanel(app, onStart) {
  const dialog = document.createElement('dialog')
  dialog.className = 'dataset-dialog'
  dialog.setAttribute('aria-labelledby', 'dataset-title')
  dialog.innerHTML = `
    <form id="dataset-form">
      <p class="eyebrow">SIM-FARM DIGITAL TWIN / MOCK REPLAY</p>
      <h2 id="dataset-title">Choose the evidence. Then press play.</h2>
      <p class="dataset-intro">Paste or upload a JSON dataset to replay the complete journey: towers → agents → fusion → decision. Everything stays in this browser.</p>
      <div class="dataset-tools">
        <label class="file-label">Upload JSON<input id="dataset-file" type="file" accept=".json,application/json"></label>
        <button type="button" id="generate-data">Generate test data</button>
        <button type="button" id="download-data">Download JSON</button>
      </div>
      <label for="dataset-json" class="dataset-label">Dataset JSON <span>Editable · timestamps in milliseconds from replay start</span></label>
      <textarea id="dataset-json" spellcheck="false" autocomplete="off" aria-describedby="dataset-help dataset-error" placeholder="Paste the generated JSON array here…"></textarea>
      <p id="dataset-help">The sample is ready below: 16 SIMs · 144 events · 2 flagged cases. Replace it with your own file or generate another sample.</p>
      <p id="dataset-error" role="alert"></p>
      <div class="dataset-bottom"><span>Conceptual demo · Scripted decisions, no live LLM</span><button class="primary" type="submit">Start visualization →</button></div>
    </form>`
  app.appendChild(dialog)
  const textarea = dialog.querySelector('#dataset-json'), error = dialog.querySelector('#dataset-error'), file = dialog.querySelector('#dataset-file')
  const help = dialog.querySelector('#dataset-help'), start = dialog.querySelector('[type="submit"]')
  let seed = 42, revision = 0, started = false
  textarea.value = JSON.stringify(generateEvents(seed), null, 2)
  function showError(message) { error.textContent = message; textarea.setAttribute('aria-invalid', 'true') }
  function clearError() { error.textContent = ''; textarea.removeAttribute('aria-invalid') }
  textarea.addEventListener('input', () => { revision++; clearError(); help.textContent = 'Edited dataset. Press Start to validate and replay.' })
  dialog.querySelector('#generate-data').addEventListener('click', () => {
    revision++; seed++; textarea.value = JSON.stringify(generateEvents(seed), null, 2); file.value = ''; clearError()
    help.textContent = `Generated sample ${seed}: 16 SIMs · 144 events · 2 flagged cases. Ready to start or download.`
  })
  file.addEventListener('change', async () => {
    const selected = file.files[0]; if (!selected) return
    const request = ++revision
    if (selected.size > MAX_DATASET_BYTES) { showError('Use a JSON file under 1 MB.'); return }
    try {
      const text = await selected.text()
      if (request !== revision) return
      textarea.value = text; clearError(); help.textContent = `${selected.name} loaded. Press Start to validate and replay.`
    } catch { showError('The file could not be read. Try selecting it again.') }
  })
  dialog.querySelector('#download-data').addEventListener('click', () => {
    try {
      const { events } = parseDataset(textarea.value)
      const url = URL.createObjectURL(new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = 'sim-farm-test.json'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      clearError(); help.textContent = 'JSON downloaded. You can upload this file here again to replay the same dataset.'
    } catch (cause) { showError(cause.message) }
  })
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault()
    try {
      const dataset = parseDataset(textarea.value)
      clearError(); start.disabled = true
      onStart(dataset)
      started = true; revision++; dialog.close()
    } catch (cause) { showError(cause.message) }
    finally { start.disabled = false }
  })
  dialog.addEventListener('cancel', event => { if (!started) event.preventDefault() })
  dialog.showModal()
  return { open() { clearError(); dialog.showModal() }, onClose(callback) { dialog.addEventListener('close', callback) }, dispose() { revision++; dialog.remove() } }
}
