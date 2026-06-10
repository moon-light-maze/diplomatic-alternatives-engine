import type { SnapshotBundle } from "./store.js";
import type { Findings, State, Dealmaking, PeacePlan, Changelog } from "./schemas.js";

/** Renders a self-contained HTML report (inline CSS) from a snapshot bundle. */

const DASHBOARD_PORT = process.env.PORT ?? "8788";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function li(items: string[]): string {
  return items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>` : `<p class="muted">—</p>`;
}

function refChips(refs: string[], byId: Map<string, Findings["findings"][number]>): string {
  return refs
    .map((r) => {
      const f = byId.get(r);
      if (!f) return `<span class="chip">${esc(r)}</span>`;
      return `<a class="chip" href="${esc(f.url)}" target="_blank" rel="noreferrer" title="${esc(f.publisher)} — ${esc(f.title)}">${esc(r)} · ${esc(f.publisher)}</a>`;
    })
    .join(" ");
}

export function renderReport(bundle: SnapshotBundle): string {
  const findings = bundle.findings as Findings | null;
  const state = bundle.state as State | null;
  const dealmaking = bundle.dealmaking as Dealmaking | null;
  const peaceplan = bundle.peaceplan as PeacePlan | null;
  const changelog = bundle.changelog as Changelog | null;
  const byId = new Map((findings?.findings ?? []).map((f) => [f.id, f]));
  const created = bundle.meta?.createdAt ? new Date(bundle.meta.createdAt) : null;
  const title = bundle.meta?.scenarioTitle ?? "Conflict Monitor";

  const parties = state
    ? state.parties
        .map(
          (p) => `
      <div class="card">
        <h3>${esc(p.name)} <span class="chip">${esc(p.id)}</span> <span class="muted">· ${esc(p.role)}</span></h3>
        <div class="grid3">
          <div><h4>Red lines</h4>${li(p.redLines)}</div>
          <div><h4>Demands</h4>${li(p.demands)}</div>
          <div><h4>Needs</h4>${li(p.needs)}</div>
        </div>
        <div class="refs">Sources: ${refChips(p.findingRefs, byId)}</div>
      </div>`
        )
        .join("")
    : `<p class="muted">No state data.</p>`;

  const negotiations = state
    ? state.negotiations
        .map(
          (n) =>
            `<li><b>${esc(n.track)}</b> — ${esc(n.status)} <span class="muted">(${esc(n.participants.join(", "))})</span> <span class="refs">${refChips(n.findingRefs, byId)}</span></li>`
        )
        .join("")
    : "";

  const dealHtml = dealmaking
    ? `
    <p>${esc(dealmaking.currentDynamics)}</p>
    <h4>Likely framework if they agreed today</h4>
    ${li(dealmaking.likelyFramework.elements)}
    <p class="muted"><b>Who concedes what:</b> ${esc(dealmaking.likelyFramework.whoConcedes)}</p>
    <div class="grid2">
      <div class="card"><h4>International security</h4><p>${esc(dealmaking.implications.internationalSecurity)}</p></div>
      <div class="card"><h4>Regional spillover</h4><p>${esc(dealmaking.implications.regionalSpillover)}</p></div>
    </div>
    <div class="grid2">
      <div class="card"><h4>Flareup risk: <span class="tag risk-${esc(dealmaking.flareupRisk.level)}">${esc(dealmaking.flareupRisk.level)}</span></h4>${li(dealmaking.flareupRisk.drivers)}</div>
      <div class="card"><h4>Deal longevity: <span class="tag">${esc(dealmaking.longevity.rating)}</span></h4><p>${esc(dealmaking.longevity.rationale)}</p></div>
    </div>`
    : `<p class="muted">No deal-making data.</p>`;

  const planHtml = peaceplan
    ? `
    <p class="disclaimer">${esc(peaceplan.disclaimer)}</p>
    <h4>Evaluation criteria</h4>
    ${li(peaceplan.criteria.map((c) => `${c.name}: ${c.description}`))}
    <h4>Plan pillars</h4>
    ${peaceplan.plan.pillars.map((p) => `<div class="card"><b>${esc(p.title)}</b><p>${esc(p.detail)}</p></div>`).join("")}
    <div class="grid2">
      <div><h4>Sequencing</h4>${li(peaceplan.plan.sequencing)}</div>
      <div><h4>Guarantees & verification</h4>${li(peaceplan.plan.guarantees)}</div>
    </div>
    <h4>What each party gets / gives</h4>
    ${peaceplan.plan.partyBenefits
      .map((b) => `<div class="card"><b>${esc(b.actorId)}</b><div class="grid2"><div><i>Gains:</i> ${esc(b.gains)}</div><div><i>Concessions:</i> ${esc(b.concessions)}</div></div></div>`)
      .join("")}
    <h4>Why this is better than the current trajectory</h4>
    <div class="card highlight"><p>${esc(peaceplan.comparisonToCurrent.whyBetter)}</p>
      <div class="grid2"><div><h4>Tradeoffs</h4>${li(peaceplan.comparisonToCurrent.tradeoffs)}</div><div><h4>Risks</h4>${li(peaceplan.comparisonToCurrent.risks)}</div></div>
    </div>`
    : `<p class="muted">No peace plan.</p>`;

  const eventsHtml =
    changelog && changelog.events.length
      ? changelog.events
          .map(
            (e) =>
              `<div class="event"><div class="event-h"><span class="event-date">${esc(e.date)}</span> <b>${esc(e.headline)}</b></div><div>${esc(e.detail)}</div><div class="refs">Sources: ${refChips(e.findingRefs, byId)}</div></div>`
          )
          .join("")
      : changelog
      ? `<p class="muted">No material changes since the last update.</p>`
      : `<p class="muted">First snapshot — no prior update to compare against. This section will list new, sourced developments on each subsequent update.</p>`;

  const sourcesHtml = findings
    ? findings.findings
        .map(
          (f) =>
            `<li><span class="chip">${esc(f.id)}</span> <a href="${esc(f.url)}" target="_blank" rel="noreferrer">${esc(f.title)}</a> <span class="muted">— ${esc(f.publisher)}, ${esc(f.date)}</span> <span class="tag rel-${esc(f.reliability)}">${esc(f.reliability)}</span><div class="muted quote">"${esc(f.quote)}"</div></li>`
        )
        .join("")
    : "";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)} — ${created ? created.toLocaleDateString() : ""}</title>
<style>
  :root{--bg:#0f1115;--panel:#171a21;--panel2:#1e222b;--border:#2a2f3a;--text:#e6e8ec;--muted:#9aa3b2;--accent:#6ea8fe;--accent2:#7ee0a8;--warn:#f0c674;--danger:#e88;}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  .wrap{max-width:980px;margin:0 auto;padding:0 20px 80px}
  header{position:sticky;top:0;background:linear-gradient(#0f1115,#0f1115ee);padding:18px 0 10px;border-bottom:1px solid var(--border);z-index:2}
  h1{margin:0 0 2px;font-size:22px}h2{margin:34px 0 10px;font-size:19px;border-bottom:1px solid var(--border);padding-bottom:6px}
  h3{margin:0 0 8px;font-size:16px}h4{margin:12px 0 4px;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
  a{color:var(--accent)}.muted{color:var(--muted)}.quote{font-size:13px;margin-top:2px}
  .banner{background:#2a221280;border:1px solid var(--warn);color:var(--warn);padding:8px 12px;border-radius:8px;font-size:13px;margin-top:10px}
  .disclaimer{background:#1a2430;border:1px solid var(--accent);border-radius:8px;padding:8px 12px;font-size:13.5px;color:#cfe0ff}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin:10px 0}
  .card.highlight{border-color:var(--accent2)}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  @media(max-width:720px){.grid2,.grid3{grid-template-columns:1fr}}
  ul{margin:4px 0;padding-left:20px}li{margin:3px 0}
  .chip{display:inline-block;background:var(--panel2);border:1px solid var(--border);border-radius:999px;padding:1px 8px;font-size:11.5px;text-decoration:none;color:var(--accent2)}
  .refs{margin-top:8px;font-size:12px}
  .tag{display:inline-block;border:1px solid var(--border);border-radius:999px;padding:0 8px;font-size:11.5px;text-transform:capitalize}
  .risk-high,.risk-severe{color:var(--danger);border-color:var(--danger)}.risk-moderate{color:var(--warn);border-color:var(--warn)}.risk-low{color:var(--accent2);border-color:var(--accent2)}
  .rel-official{color:var(--accent2)}.rel-unverified,.rel-single-source{color:var(--warn)}
  .toplinks{font-size:13px}
  .updates{background:#141a23;border:1px solid var(--accent);border-radius:12px;padding:6px 16px 14px;margin-top:14px}
  .event{border-left:3px solid var(--accent);padding:6px 0 6px 12px;margin:10px 0}
  .event-h{margin-bottom:2px}
  .event-date{display:inline-block;font-size:11.5px;color:var(--accent2);border:1px solid var(--border);border-radius:999px;padding:0 7px;margin-right:4px}
</style></head><body><div class="wrap">
<header>
  <h1>${esc(title)}</h1>
  <div class="muted">Snapshot ${created ? created.toLocaleString() : esc(bundle.id)} · <a class="toplinks" href="http://localhost:${esc(DASHBOARD_PORT)}/">Open full dashboard →</a></div>
  <div class="banner">⚠ AI-generated open-source analysis. Grounded in the cited sources below — verify against primary sources before relying on it. Not authoritative, not a prediction, not policy advice. Only the Peace Plan section is prescriptive.</div>
</header>

<section class="updates">
  <h2 style="margin-top:18px;border:none">🆕 What's happened since the last update</h2>
  ${eventsHtml}
</section>

<h2>Overview</h2>
<p>${esc(state?.situation)}</p>
${negotiations ? `<h4>Negotiation tracks</h4><ul>${negotiations}</ul>` : ""}
${state?.openQuestions?.length ? `<h4>Open questions</h4>${li(state.openQuestions)}` : ""}

<h2>Parties — red lines, demands, needs</h2>
${parties}

<h2>Deal-Making & Resolution Outlook</h2>
${dealHtml}

<h2>A Better Diplomatic Alternative <span class="muted" style="font-size:13px">(AI proposal)</span></h2>
${planHtml}

<h2>Sources (${findings?.findings.length ?? 0})</h2>
<ul>${sourcesHtml}</ul>

</div></body></html>`;
}
