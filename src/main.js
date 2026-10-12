import './style.css'
import { createMeetingClock, createDecisionHistory } from './meeting-mode.js'
import { createReasoningPanel } from './ui/reasoning-panel.js'
import { createCallSelection } from './selection.js'
import { createScene } from './scene.js'
import { createLayout } from './layout.js'
import { createRawEventFlow } from './raw-events.js'
import { createReplay } from './data/replay.js'
import { createAgentOutputFlow } from './agent-outputs.js'
import { createReturnFlow } from './return-flow.js'
import { createShell } from './ui/shell.js'
import { createDatasetPanel } from './ui/dataset-panel.js'

const app = document.querySelector('#app')
const shell = createShell(app)
const meetingClock = createMeetingClock(), history = createDecisionHistory()
let view = null, layout = null, session = null, panel = null, selection = null
let inspecting = false
const reasoning = createReasoningPanel(app, () => { inspecting = true; app.querySelector('#replay-state').textContent = 'INSPECTING' }, () => { inspecting = false; app.querySelector('#replay-state').textContent = paused ? 'PAUSED' : 'RUNNING' })
function inspectDecision(decision) { if (session && !editing) reasoning.open(decision, session.byId) }
let paused = false, editing = true, pausedBeforeEdit = false, emitted = 0, received = 0
const pauseButton = app.querySelector('#pause')
function resetTelemetry() {
  emitted = 0; received = 0
  app.querySelector('#emitted').textContent = '0'; app.querySelector('#received').textContent = '0'
  app.querySelector('#last-ue').textContent = 'Waiting for first event'
  app.querySelector('#last-signal').textContent = 'Tower → specialist agent'
  shell.resetCore(); shell.coreState('idle')
}
function startDataset(dataset) {
  if (!view) {
    view = createScene(shell.container)
    layout = createLayout(view.scene)
    selection = createCallSelection(view.renderer.domElement, view.camera, () => session?.returns.calls ?? new Map(), inspectDecision, () => !editing && !inspecting)
    app.querySelector('#status').textContent = `Three.js r${view.revision} · WebGL ready`
    let previous = performance.now()
    view.renderer.setAnimationLoop(now => {
      const dt = Math.min((now - previous) / 1000, .05); previous = now
      if (session && !paused && !editing && !inspecting) {
        meetingClock.advance(dt, dt => {
        session.replay.update(dt); session.raw.update(dt); session.outputs.update(dt); layout.agents.update(dt)
        const decisions = layout.core.update(dt)
        for (const decision of decisions) {
          session.returns.emit(decision)
          view.focus.trigger(decision.verdict)
          shell.decision(decision, layout.core.state.snapshot().decisionCount)
        }
        session.returns.update(dt)
        })
        view.focus.update(dt)
        shell.focusCore(layout.core.state.snapshot())
      }
      view.render()
    })
  }
  if (session) { session.replay.dispose(); session.raw.dispose(); session.outputs.dispose(); session.returns.dispose() }
  view.resetCamera()
  layout.core.reset(); layout.agents.nodes.forEach(agent => { agent.pulse = 0 }); layout.agents.update(0)
  const raw = createRawEventFlow(view.scene, layout, (event, agent) => shell.arrival(event, agent, ++received))
  const outputs = createAgentOutputFlow(view.scene, layout, input => shell.coreArrival(input, layout.core.state.snapshot()))
  const returns = createReturnFlow(view.scene, layout, outputs.routes, dataset.events.filter(event => event.kind === 'core_decision'), () => {})
  const replay = createReplay(dataset.events, dataset.duration)
  replay.subscribe(event => {
    if (event.kind === 'raw') { raw.emit(event); app.querySelector('#emitted').textContent = ++emitted }
    else if (event.kind === 'agent_output') outputs.emit(event)
    else if (event.kind === 'core_decision') {
      layout.core.state.enqueue(event)
      const entry = history.record(event, dataset.byId)
      if (entry) shell.addDecision(entry, () => { if (!editing) reasoning.open(entry.decision, entry.byId) })
    }
  })
  replay.onLoop(() => { layout.core.reset(); returns.reset(); resetTelemetry() })
  session = { raw, outputs, returns, replay, byId: dataset.byId }
  resetTelemetry(); paused = false; pausedBeforeEdit = false; editing = false
  pauseButton.disabled = false; pauseButton.textContent = 'Pause replay'
  app.querySelector('#replay-state').textContent = 'RUNNING'
}

panel = createDatasetPanel(app, startDataset)
panel.onClose(() => {
  editing = false; paused = pausedBeforeEdit
  if (session) app.querySelector('#replay-state').textContent = paused ? 'PAUSED' : 'RUNNING'
})
app.querySelector('#status').textContent = 'Load a dataset to start'
pauseButton.addEventListener('click', () => {
  if (!session) return
  paused = !paused; pauseButton.textContent = paused ? 'Resume replay' : 'Pause replay'
  app.querySelector('#replay-state').textContent = paused ? 'PAUSED' : 'RUNNING'
})
app.querySelector('#meeting-speed').addEventListener('click', () => {
  const fast = meetingClock.toggle()
  const button = app.querySelector('#meeting-speed')
  button.setAttribute('aria-pressed', String(fast))
  button.textContent = fast ? 'Normal / Fast · 10×' : 'Normal / Fast · 1×'
})
app.querySelector('#reset-camera').addEventListener('click', () => view?.resetCamera())
app.querySelector('#load-dataset').addEventListener('click', () => {
  pausedBeforeEdit = paused; editing = true
  app.querySelector('#replay-state').textContent = 'LOADING'; panel.open()
})
if (import.meta.hot) import.meta.hot.dispose(() => {
  view?.renderer.setAnimationLoop(null)
  if (session) { session.replay.dispose(); session.raw.dispose(); session.outputs.dispose(); session.returns.dispose() }
  selection?.dispose(); reasoning.dispose(); panel.dispose(); view?.dispose()
})
