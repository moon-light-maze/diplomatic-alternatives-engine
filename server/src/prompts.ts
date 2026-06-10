import type { Scenario } from "./types.js";
import type { Findings, State, Dealmaking } from "./schemas.js";

/**
 * Per-stage prompt builders. Cross-cutting rules baked into every system prompt:
 *  - Prefer reputable/official sources; cite them.
 *  - Stages 1-3 are DESCRIPTIVE and neutral; only Stage 4 prescribes.
 *  - The deliverable is ALWAYS a single fenced ```json block as the final message.
 */

const REPUTABLE = `Prefer reputable, verifiable sources, in this rough priority:
1. Official/primary: government statements (whitehouse.gov, state.gov, mfa.gov.ir, president.ir, gov.il, mfa.gov.il), and IGOs (iaea.org, un.org).
2. Major wire services / outlets: Reuters, AP, AFP, BBC.
3. Established research institutions: CSIS, International Crisis Group, Carnegie, RAND, ISW.
Flag single-source or unverified claims as such. Prioritize material from the last ~30 days for the current state; use older material only for structural background and label it as such.`;

const JSON_RULE = `Your FINAL message must be EXACTLY one fenced \`\`\`json code block containing a single object matching the requested shape. No prose before or after it.`;

function scenarioBlock(s: Scenario): string {
  return `SCENARIO: ${s.title}
${s.description}
Seed parties (discover and add any other material actors — e.g. IAEA, UN, E3/EU, Gulf states, Hezbollah): ${s.seedParties.join(", ")}
Analytic focus: ${s.focus}`;
}

// ---- 1. Gather --------------------------------------------------------------
export function gatherPrompt(s: Scenario, maxSources: number) {
  const system = `You are an open-source conflict analyst gathering current, reputable information. Be neutral and factual; do not editorialize.
${REPUTABLE}

Use WebSearch and WebFetch to collect up to ${maxSources} of the most relevant, recent sources on the scenario. For each, record a real URL, the publisher, the publication date, a short neutral summary, a verbatim quote, and a reliability tag.

Return an object of this shape:
{ "findings": [ { "id": "f1", "title": string, "publisher": string, "url": string, "date": string, "summary": string, "quote": string, "reliability": "official"|"major-outlet"|"think-tank"|"single-source"|"unverified" } ] }

${JSON_RULE}`;
  const user = `${scenarioBlock(s)}

Gather the latest reputable open-source reporting and official statements on this conflict and the state of negotiations. Aim for a spread across the parties and across source types (official, wire, analysis). Return the findings JSON.`;
  return { system, user };
}

// ---- 2. Current State -------------------------------------------------------
export function statePrompt(s: Scenario, findings: Findings) {
  const system = `You are a conflict analyst writing a neutral situation brief. Ground every claim ONLY in the provided findings, and cite them by their finding id in "findingRefs". Do not introduce facts not supported by the findings. Present each party in its own terms; where findings conflict, reflect that rather than choosing a side.

Return an object of this shape:
{ "situation": string,
  "negotiations": [ { "track": string, "status": string, "participants": [string], "findingRefs": ["f1"] } ],
  "parties": [ { "id": string, "name": string, "role": string, "redLines": [string], "demands": [string], "needs": [string], "findingRefs": ["f1"] } ],
  "openQuestions": [string] }
Cover at least the core parties plus any other material actor the findings establish (≥3 parties total).

${JSON_RULE}`;
  const user = `${scenarioBlock(s)}

FINDINGS:
${JSON.stringify(findings.findings, null, 2)}

Summarize the current state: the situation, ongoing negotiation tracks, and for each party its red lines, demands, and underlying needs. Return the state JSON.`;
  return { system, user };
}

// ---- 3. Deal-Making ---------------------------------------------------------
export function dealmakingPrompt(s: Scenario, findings: Findings, state: State) {
  const system = `You are a conflict analyst assessing deal-making. Stay descriptive and neutral (do NOT propose your own plan here — that comes later). Ground claims in the findings via "findingRefs".

Return an object of this shape:
{ "currentDynamics": string,
  "likelyFramework": { "elements": [string], "whoConcedes": string },
  "implications": { "internationalSecurity": string, "regionalSpillover": string },
  "flareupRisk": { "level": "low"|"moderate"|"high"|"severe", "drivers": [string] },
  "longevity": { "rating": "fragile"|"moderate"|"durable", "rationale": string },
  "findingRefs": ["f1"] }

${JSON_RULE}`;
  const user = `${scenarioBlock(s)}

FINDINGS:
${JSON.stringify(findings.findings, null, 2)}

CURRENT STATE:
${JSON.stringify(state, null, 2)}

Assess the deal-making situation: where it stands, the resolution framework that would most likely take shape if the parties agreed today, the implications for international security and regional spillover, the risk of future flareups, and how durable such a deal would be. Return the dealmaking JSON.`;
  return { system, user };
}

// ---- 4. Improved Peace Plan -------------------------------------------------
export function peacePlanPrompt(s: Scenario, state: State, dealmaking: Dealmaking) {
  const system = `You are a senior peace-process designer. This is the ONE prescriptive stage: propose a better, fairer, more sustainable peace plan than the likely current-trajectory framework. Be rigorous and even-handed — a credible plan must give every major party enough to plausibly say yes. First state the explicit CRITERIA you use for "better/fairer/more sustainable" (e.g. fairness, security for all, durability, enforceability, broad buy-in), then design the plan, then argue—criterion by criterion—why it beats the likely framework from the deal-making analysis.

Return an object of this shape:
{ "criteria": [ { "name": string, "description": string } ],
  "plan": { "pillars": [ { "title": string, "detail": string } ], "sequencing": [string], "guarantees": [string],
            "partyBenefits": [ { "actorId": string, "gains": string, "concessions": string } ] },
  "comparisonToCurrent": { "whyBetter": string, "tradeoffs": [string], "risks": [string] },
  "disclaimer": string }
partyBenefits must cover the core parties. The disclaimer must state this is AI-generated analytical exploration, not authoritative advice or a prediction.

${JSON_RULE}`;
  const user = `${scenarioBlock(s)}

CURRENT STATE (parties, red lines, demands, needs):
${JSON.stringify(state, null, 2)}

LIKELY CURRENT-TRAJECTORY FRAMEWORK (what you must improve upon):
${JSON.stringify(dealmaking, null, 2)}

Design a better, fairer, more sustainable peace plan and explain why it is superior to the likely framework on your stated criteria. Return the peaceplan JSON.`;
  return { system, user };
}

// ---- 5. Changelog (sourced events since last update) ------------------------
export function changelogPrompt(s: Scenario, findings: Findings, state: State, prevState: State) {
  const system = `You are tracking how a conflict evolves between updates. Produce a list of the concrete EVENTS that occurred since the previous snapshot — new strikes, talks, statements, agreements, breakdowns, etc. Be neutral and concise. Ground EVERY event in the provided findings by citing their finding ids in "findingRefs"; do not list an event you cannot source. Order most-recent first. If nothing material changed, return an empty "events" array.

Return an object of this shape:
{ "events": [ { "headline": string, "date": string, "detail": string, "findingRefs": ["f1"] } ] }

${JSON_RULE}`;
  const user = `${scenarioBlock(s)}

FINDINGS (your only allowed sources — cite by id):
${JSON.stringify(findings.findings, null, 2)}

PREVIOUS SNAPSHOT'S STATE (the baseline to compare against):
${JSON.stringify(prevState, null, 2)}

TODAY'S STATE:
${JSON.stringify(state, null, 2)}

List the events that have occurred since the previous snapshot, each grounded in the findings. Return the changelog JSON.`;
  return { system, user };
}
