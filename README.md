# SIM-farm conceptual digital twin

Three.js + Vite, vanilla JavaScript, no backend. Synthetic topology and evidence only: not geographically accurate, not a production architecture, and not a live LLM or validated fraud detector.

## Start a dataset

1. Start Vite with `npm run dev` and open the local URL.
2. The startup screen includes an editable generated sample. Alternatively, paste JSON or select **Upload JSON**.
3. **Generate test data** creates a new seeded example; **Download JSON** saves the current validated dataset.
4. Select **Start visualization**. No scene or replay starts before this action. Invalid data stays in the form with an explanation.
5. Use **Pause replay**, **Reset view**, or **Change dataset** during playback. Changing a dataset pauses the existing replay while the form is open. Escape cancels an edit and restores the prior pause state.

Ready-to-use dataset: `public/datasets/sim-farm-test.json` (also served at `/datasets/sim-farm-test.json`). It contains 144 records: 64 raw events, 64 agent outputs and 16 decisions. Two randomly selected SIMs (12.5%) are flagged. The complete sample loop lasts approximately 73 seconds, including visual reasoning and return pulses. Regenerate the file with `npm run generate:dataset`.

All uploaded data stays in browser memory. Refresh returns to the built-in sample. Dependencies are installed from npm; playback makes no external network requests.

## Run and verify

```sh
npm install
npm run dev -- --host 127.0.0.1
npm test
npm run build
```

On this lab workstation, if npm is absent from PATH:

```sh
export PATH=/home/dev/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/lib/chatgpt/resources/cua_node/lib/node_modules/corepack/shims:$PATH
npm run dev -- --host 127.0.0.1
```

## Dataset contract

Use a JSON array. Each record requires a unique string `id`, a string `ue_id`, and a numeric `timestamp` in milliseconds relative to replay start. The optional `kind` is inferred if omitted. Records may be unordered; the loader sorts them.

- **raw**: `tower_id` (`tower_1` to `tower_8`), `signal_type`, numeric `value`.
- **agent_output**: `agent_id`, `feature`, normalized numeric `value` (0–1), `derived_from` (array of raw record IDs). Optional `why` describes the illustrative feature.
- **core_decision**: `agent_inputs` (four agent-output IDs), `verdict` (`clean` or `flagged`), `confidence` (0–1), `reasoning_trace`. Optional `contributions` lists four `{ agent_id, weight }` objects summing to 1; otherwise equal weights are used. The originating tower is resolved from raw lineage.

| Signal | Agent | Raw range |
| --- | --- | --- |
| cqi | cqi | 0–15 |
| pusch_sinr | mobility | −30–50 |
| call_interval | timing | 0–3600 seconds |
| context_score | context | 0–1 |

Each SIM identifies one call per replay loop, using the same originating tower and one output from each of the four agents. Use another `ue_id` for another call. Every raw event must feed a derived input; each input must feed its SIM's decision. The loader accepts up to 64 SIMs, 1,000 events, 1 MB of JSON and source timestamps up to 600,000 ms.

For visible causality, agent outputs must be scheduled at least 1,850 ms after their source raw events; decisions at least 1,650 ms after their agent outputs. Decision timestamps are recorded event times: the presentation adds a 1.6-second evidence sequence, and concurrent decisions queue so each can be seen. Loop duration includes this queue and all return pulses.

Mock weights and confidence are authored in the dataset, not model explanations. The sample generator deliberately makes the two positive cases differ from the clean baseline. Edited datasets replay their supplied verdicts rather than classifying new input.

## Current checkpoint: Phase 6 — all planned phases complete

- Eight tower nodes, four specialist agents, central icosahedral lattice.
- Raw dots move along routes outside the core and trigger agent arrival pulses.
- Derived diamonds move toward four core ports and flash on contact.
- Core state machine waits for the correct SIM's four referenced inputs, then highlights internal evidence links sequentially.
- A green or red flash indicates the mock decision. A return pulse follows the strongest weighted agent's route in reverse, ending at the originating SIM marker.
- Separate markers retain clean/flagged colors until the next loop. Text also identifies the latest verdict and confidence.
- Click a completed red SIM marker, or its session-history entry, to open the sliding evidence panel. It shows the recorded timestamp, confidence, four agent inputs and source values, why each matters, contribution bars and the supplied reasoning trace.
- Inspection freezes playback; closing with × or Escape restores its previous pause state. Dragging the camera does not select a call.
- Pause freezes simulation time, reasoning and return pulses together. OrbitControls supports free look; reset restores the overview.

## Modules

- `src/scene.js`: renderer, lighting, camera and lifecycle.
- `src/camera-focus.js`: flagged-decision camera motion, interruption and reduced-motion support.
- `src/layout.js`, `src/agents.js`, `src/primitives.js`: radial layout, tower/agent geometry and labels.
- `src/core-state.js`: pure state machine, per-SIM evidence and queued decisions.
- `src/core.js`: lattice, receiving ports, reasoning links and verdict flash.
- `src/raw-events.js`, `src/agent-outputs.js`, `src/return-flow.js`: inward and outward visual flows.
- `src/data/generator.js`: pure seeded mock data generation.
- `src/data/dataset.js`: parsing, schema/lineage validation and replay duration.
- `src/data/signals.js`: shared agent/signal contract and animation durations.
- `src/data/replay.js`: subscription-based source, replaceable with a stream adapter.
- `src/ui/dataset-panel.js`: local JSON input, generation and download.
- `src/ui/shell.js`: HTML telemetry, flagged-call shortcuts and state display.
- `src/selection.js`: raycast selection with drag protection.
- `src/ui/reasoning-model.js`, `src/ui/reasoning-panel.js`: evidence mapping and accessible HTML inspection dialog.

## Camera focus

A flagged decision starts a 0.85-second approach toward the core, holds for 1.2 seconds, then returns to the default overview over 1.15 seconds. Clean decisions do not move the camera. Orbit or zoom input cancels the movement immediately; Reset view cancels it and restores the overview. Replay pause and evidence inspection also freeze camera motion. Reduced-motion preferences skip automatic focus. A new dataset resets the camera.

## Verification

Sixteen automated checks cover data generation and lineage, invalid uploads, sorting/defaults, real Three.js particle geometry, evidence-driven state transitions, replay pause/loop behavior, complete return delivery and cleanup, evidence-panel mapping, completed flagged-call selection and click-versus-drag behavior. Canvas labels are stubbed in geometry tests; these checks do not verify WebGL pixels.

The browser startup screen and populated sample were verified. Invalid JSON kept playback stopped and displayed an error; generating a replacement cleared the error. Uploading `sim-farm-test.json` through the file chooser populated the input successfully. Changing datasets opened the form and paused playback. The enlarged scene labels were visually inspected. Starting the sample successfully rendered the WebGL scene and completed 64 input arrivals and all 16 decisions. Pause changed the UI to PAUSED. Production build passes, with Vite's advisory about the Three.js bundle size.

Phase 5 browser check: opened SIM-1011 from its inspection shortcut and visually verified the sliding panel, all four agent cards, 94% mock confidence, timestamp, reasoning trace and timing contribution at 50%. Escape closed the dialog and restored RUNNING playback. No browser warnings or errors were captured.

Phase 6 verification: camera tests verify flagged-only triggering, focus distance, hold, exact overview return, manual cancellation and reduced-motion behavior. All 14 checks and the production build pass. Browser loaded the Phase 6 scene with active replay and no captured console errors.

## Meeting Mode

The Mock Replay panel's **Normal / Fast** toggle switches between 1× (default) and 10× without restarting or changing the dataset. The simulation advances in bounded steps to keep raw events, evidence, reasoning and returns synchronized. Camera motion keeps its readable presentation pace. Pause and inspection still freeze playback.

The left-side **Calls · Session history** appends each clean or flagged decision occurrence, newest first, as soon as the recorded decision event arrives. Each entry shows SIM, verdict, relative replay timestamp, mock confidence and a unique occurrence number. Entries remain through replay loops and dataset changes; page refresh starts a new session. Selecting an entry uses its stored decision and evidence, even before its animation completes or after a new dataset is loaded.

`src/meeting-mode.js` contains the speed clock and independent decision-history snapshots. Tests cover normal/fast switching, bounded simulation steps, repeated occurrences and evidence independence from the active dataset.

Clean cases can be inspected from the left history using the same stored-evidence panel. Clean entries and verdict badges are green; flagged entries and badges are red.
