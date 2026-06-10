# Diplomatic Alternatives Engine

Tracks the US-Iran conflict and proposes better, fairer, more sustainable diplomatic
alternatives to the deal currently taking shape.

The agreement most likely to come out of any given moment of negotiation is rarely the best one
available. It reflects leverage, deadlines, and domestic politics more than durability or
fairness. This project runs a daily pipeline that does two things:

1. Reconstructs the current trajectory. From reputable, openly available sources, it maps where
   the US-Iran confrontation (and the entangled Israel, Lebanon, and Gulf threads) actually
   stands, what each party demands and needs, and the resolution framework that would most likely
   result if the parties signed today.
2. Proposes a better alternative. It then designs a fairer, more sustainable settlement and argues,
   criterion by criterion, why it beats the likely deal: more balanced, more verifiable, more
   durable, and harder for any party to walk away from.

Inference runs on your local Claude Code login. No API key required.

> Analytical and educational tool over open-source information. Not authoritative, not a forecast,
> not policy advice. The proposed alternative is a model-generated exploration meant to widen the
> set of options, not to be adopted as is. Verify everything against primary sources.

## How it works: a daily 5-stage pipeline

Each stage is validated against a strict schema, and every factual claim is tied to a cited source.

1. Gather. WebSearch and WebFetch across reputable and official sources (governments, IAEA, UN,
   major wire services, established research institutions). Each finding records a real URL,
   publisher, date, quote, and reliability tag.
2. Current state. The situation, the live negotiation tracks, and for each party (three or more,
   core plus discovered) its red lines, demands, and underlying needs.
3. The likely deal. Where deal-making stands and the resolution framework most likely if the
   parties agreed today, with its implications for international security, regional spillover,
   future-flareup risk, and how long such a deal would actually hold.
4. A better diplomatic alternative. A settlement built to be fairer and more sustainable, with
   explicit evaluation criteria (fairness and reciprocity, security for all, verifiability,
   enforceability, durability, broad buy-in, spoiler management), per-party gains and concessions,
   a sequencing path, guarantee mechanisms, and a point-by-point argument for why it is superior to
   the likely deal from Stage 3.
5. What changed since the last update. A dated, sourced list of developments since the previous
   run, shown at the top of each brief.

The output is a self-contained HTML brief. A local dashboard lets you browse the latest brief plus
the full history of how the picture, and the recommended alternative, evolves.

### Why everything is grounded

Citations are finding-id based. Stage 1 produces the sources, and every later stage, including the
proposed alternative's reasoning, references those findings, so links cannot be invented downstream.
Stages 1 through 3 stay descriptive and neutral. Only Stage 4 is prescriptive, and it has to show
its criteria and trade-offs. A credible alternative has to give every major party enough to
plausibly say yes, and the model is held to that standard.

## Requirements

- Node 18+ (built on Node 22), Claude Code CLI installed and logged in (`claude --version`).
- macOS for the optional daily scheduler (uses launchd; the brief auto-opens with `open`).

## Setup

```bash
npm install
npm run build        # builds the dashboard + server
```

## Verify it works

```bash
npm run probe                # confirms live web research works through the SDK
npm run refresh -- --force   # runs one full pipeline now (~10-15 min), auto-opens the brief
```

`--force` ignores the once-per-day guard. Add `--no-open` to skip launching the browser. You can
also run the built CLI directly: `node server/dist/refresh.js --force`.

## The dashboard

```bash
npm start            # http://localhost:8788
```

Sidebar: a Refresh now button (runs the pipeline on demand with a live progress stream) and a
history list. The main pane embeds the selected day's brief: events since the last update at the
top, then the situation, parties, the likely deal, and the better alternative. The morning brief is
a standalone file and needs no server.

## Optional: daily automation (5 AM Pacific)

A macOS launchd job can run the pipeline headlessly each morning, even when the dashboard is closed,
writing a dated snapshot and brief and opening it in your browser. The scripts are portable: they
derive paths from their own location, so nothing is hardcoded.

```bash
bash scripts/install-schedule.sh     # installs and loads the launchd agent
bash scripts/uninstall-schedule.sh   # removes it
```

Notes:
- launchd fires in the Mac's system-local time. The job's `TZ` is set to Pacific. If your Mac is
  not on Pacific, change `Hour` in `scripts/com.diplomatic-alternatives.daily.plist` and re-run the
  installer.
- The Mac must be on and logged in around 5 AM (if asleep, launchd runs it at next wake) with a
  valid Claude login.

## Usage and cost

Each run is roughly 0.4 to 1.2M tokens, about 70 percent of it Stage-1 web reading on Sonnet. Opus
is used only to design the diplomatic alternative. `data/snapshots/<id>/meta.json` logs an estimate
and tool-call count per run. Cost levers in `data/config.json`: lower `maxSources`, or set every
stage to Sonnet in `server/src/pipeline.ts` (`MODEL_FOR`).

## Configuration

`data/config.json` (created on first run) holds the scenario (title, description, seed parties, and
the analytic focus) plus `maxSources` and `lastRunDate`. Edit the scenario to retarget the engine at
a different conflict or to sharpen the framing of the alternative it should pursue.

## Project layout

```
server/src/
  agent.ts        Claude Agent SDK wrapper (tools enabled, cwd-scoped, bypassPermissions)
  schemas.ts      zod schemas for the 5 stages (finding-id citations)
  prompts.ts      per-stage prompts: reputable-source and neutrality rules; the alternative's brief
  pipeline.ts     orchestrates the 5 stages, streams progress, persists a snapshot
  report.ts       renders the self-contained HTML brief
  refresh.ts      CLI run by the scheduler: pipeline, snapshot, brief, open
  store.ts        file-based snapshot store + config
  routes/         snapshots.ts (list/get/brief), refresh.ts (SSE on-demand run)
web/src/          React dashboard (history sidebar + embedded brief + live run stream)
scripts/          launchd plist template + portable install/uninstall + run-daily wrapper
data/             snapshots, config, logs (gitignored)
```

## Disclaimer

This project analyzes open-source information and generates non-authoritative diplomatic options for
study and discussion. It does not represent any government, institution, or party to the conflict,
and its proposed settlements are model-generated explorations, not predictions, endorsements, or
advice. Always verify against primary sources.
