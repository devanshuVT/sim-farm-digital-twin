export function createShell(app) {
  app.innerHTML = `
  <main class="viewport" aria-label="SIM-farm conceptual digital twin">
    <header>
      <div><p class="eyebrow">NETWORK INTELLIGENCE <span>/</span> CONCEPT DEMO</p>
      <h1>SIM-farm digital twin</h1>
      <p class="subtitle">Illustrative · Synthetic data only · Not geographically accurate</p></div>
      <div class="phase-badge"><span class="status-dot"></span> PHASE 06 <span>FLAGGED DECISION FOCUS</span></div>
    </header>
    <div id="scene" aria-label="Interactive radial network with eight towers, four agents, and a fusion core"></div>
    <aside class="legend" aria-label="Network layers">
      <p class="eyebrow">THE EVIDENCE PATH</p>
      <div><b class="layer-index">01</b><p><strong>Radio towers</strong><span>8 antenna sites · outer ring</span></p></div>
      <i></i><div><b class="layer-index agents-index">02</b><p><strong>Specialist agents</strong><span>4 signal perspectives</span></p></div>
      <i></i><div><b class="layer-index core-index">03</b><p><strong>Decision / fusion</strong><span>Aggregate · reason · decide</span></p></div>
      <p class="legend-note">SIM cards sit outside towers.<br>Gold pads identify SIM endpoints.<br>Dots carry raw signals.<br>Diamonds carry derived inputs.<br>Green returns: clean.<br>Red returns: flagged.<br>Click a red SIM to inspect.</p>
      <section class="flagged-calls" aria-label="Call history"><p class="eyebrow">CALLS · SESSION HISTORY</p><div id="flagged-list"><p class="no-flags">Waiting for decisions</p></div></section>
    </aside>
    <section class="core-telemetry" aria-label="Core aggregation status">
      <div class="telemetry-top"><span class="eyebrow">FUSION CORE</span><span id="core-state">WAITING</span></div>
      <div class="core-total"><strong id="core-count">0</strong><span>INPUTS THIS LOOP</span></div>
      <p id="core-ue">Waiting for agent data</p>
      <div class="evidence-slots" aria-label="Agent inputs for latest SIM">
        <span data-agent="cqi">CQI</span><span data-agent="mobility">UL</span><span data-agent="timing">TIME</span><span data-agent="context">CTX</span>
      </div>
      <p id="core-feature">Four perspectives per synthetic call</p>
      <p class="core-note" id="decision-summary">Mock decisions · Waiting for dataset</p>
      <p id="decision-trace"></p>
    </section>
    <section class="telemetry" aria-label="Replay telemetry">
      <div class="telemetry-top"><span class="eyebrow">MOCK REPLAY</span><span id="replay-state">NOT STARTED</span></div>
      <div class="meeting-control"><span>MEETING MODE</span><button id="meeting-speed" type="button" aria-pressed="false" aria-label="Toggle Normal / Fast replay speed">Normal / Fast · 1×</button></div>
      <div class="metrics"><div><strong id="emitted">0</strong><span>RAW / LOOP</span></div><div><strong id="received">0</strong><span>AT AGENTS</span></div></div>
      <div class="latest"><span>LATEST ARRIVAL</span><strong id="last-ue">Waiting for first event</strong><p id="last-signal">Tower → specialist agent</p></div>
      <div class="actions"><button id="pause" type="button" disabled>Pause replay</button><button id="reset-camera" type="button" aria-label="Reset camera to overview">Reset view</button></div>
    <button id="load-dataset" type="button">Change dataset</button></section>
    <footer><span class="status-dot"></span><span id="status" role="status">Initializing renderer…</span><span class="hint">DRAG TO ORBIT <span>·</span> SCROLL TO ZOOM</span><span class="phase">CONCEPTUAL / NOT PRODUCTION ARCHITECTURE</span></footer>
  </main>`
  return {
    addDecision(entry, onClick) {
      const { decision, sequence } = entry
      const list = app.querySelector('#flagged-list')
      list.querySelector('.no-flags')?.remove()
      const button = document.createElement('button')
      button.type = 'button'; button.dataset.verdict = decision.verdict
      const title = document.createElement('strong'); title.textContent = `${decision.ue_id} · ${decision.verdict.toUpperCase()}`
      const detail = document.createElement('span')
      detail.textContent = `${(decision.timestamp / 1000).toFixed(3)} s · ${Math.round(decision.confidence * 100)}% confidence`
      const occurrence = document.createElement('small'); occurrence.textContent = `Occurrence #${sequence} · replay timestamp`
      button.append(title, detail, occurrence)
      button.addEventListener('click', onClick); list.prepend(button)
    },
    container: app.querySelector('#scene'),
    coreState(state) {
      const text = state === 'idle' ? 'WAITING' : state.toUpperCase()
      const element = app.querySelector('#core-state')
      if (element.textContent !== text) element.textContent = text
    },
    decision(decision, count) {
      const element = app.querySelector('#decision-summary')
      element.textContent = `${decision.ue_id} · ${decision.verdict.toUpperCase()} · ${Math.round(decision.confidence * 100)}% mock confidence · #${count}`
      element.dataset.verdict = decision.verdict
      app.querySelector('#decision-trace').textContent = decision.reasoning_trace
    },
    focusCore(snapshot) {
      this.coreState(snapshot.state)
      if (!snapshot.activeDecision) {
        app.querySelectorAll('[data-agent]').forEach(element => element.classList.remove('weighing'))
        return
      }
      app.querySelector('#core-ue').textContent = `${snapshot.activeDecision.ue_id} · ${snapshot.latestInputs.length}/4 inputs`
      app.querySelectorAll('[data-agent]').forEach((element, index) => {
        element.classList.toggle('arrived', snapshot.latestInputs.some(input => input.agent_id === element.dataset.agent))
        element.classList.toggle('weighing', snapshot.state === 'reasoning' && index === snapshot.reasoningStep)
      })
    },
    resetCore() {
      app.querySelector('#core-count').textContent = '0'
      app.querySelector('#core-ue').textContent = 'New replay loop'
      app.querySelector('#core-feature').textContent = 'Waiting for agent data'
      app.querySelectorAll('[data-agent]').forEach(element => element.classList.remove('arrived', 'weighing'))
      app.querySelector('#decision-summary').textContent = 'Mock decisions · Waiting for inputs'
      delete app.querySelector('#decision-summary').dataset.verdict
      app.querySelector('#decision-trace').textContent = ''
    },
    coreArrival(input, snapshot) {
      app.querySelector('#core-count').textContent = snapshot.total
      if (snapshot.activeDecision) return
      app.querySelector('#core-ue').textContent = `${input.ue_id} · ${snapshot.latestInputs.length}/4 inputs`
      app.querySelector('#core-feature').textContent = `${input.feature.replaceAll('_', ' ')}: ${input.value.toFixed(3)} (mock)`
      app.querySelectorAll('[data-agent]').forEach(element => element.classList.toggle('arrived', snapshot.latestInputs.some(item => item.agent_id === element.dataset.agent)))
    },
    arrival(event, agent, count) {
      app.querySelector('#received').textContent = count
      app.querySelector('#last-ue').textContent = `${event.ue_id} → ${agent.name}`
      app.querySelector('#last-signal').textContent = `${event.tower_id.replace('tower_', 'T')} · ${event.signal_type} = ${event.value}`
    },
  }
}
