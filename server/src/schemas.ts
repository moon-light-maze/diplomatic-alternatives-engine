import { z } from "zod";

/**
 * Output schemas for the 5 pipeline stages. Citations are FINDING-ID based:
 * Stage 1 produces findings (each with a real URL + date), and every later
 * stage grounds its claims by referencing those finding ids — so the model
 * cannot invent links downstream.
 */

// ---- 1. Gather --------------------------------------------------------------
export const FindingsSchema = z.object({
  findings: z
    .array(
      z.object({
        id: z.string().describe("short stable id, e.g. 'f1'"),
        title: z.string(),
        publisher: z.string().describe("outlet or institution, e.g. Reuters, IAEA, US State Dept"),
        url: z.string().describe("the source URL"),
        date: z.string().describe("publication date as stated by the source (ISO if possible)"),
        summary: z.string().describe("1-2 sentence neutral summary of what this source reports"),
        quote: z.string().describe("a short verbatim quote from the source"),
        reliability: z.enum(["official", "major-outlet", "think-tank", "single-source", "unverified"]),
      })
    )
    .min(1),
});
export type Findings = z.infer<typeof FindingsSchema>;

// ---- 2. Current State -------------------------------------------------------
export const StateSchema = z.object({
  situation: z.string().describe("neutral 3-6 sentence overview of the current state of the conflict"),
  negotiations: z
    .array(
      z.object({
        track: z.string().describe("the negotiation track or channel"),
        status: z.string(),
        participants: z.array(z.string()),
        findingRefs: z.array(z.string()).min(1).describe("finding ids grounding this"),
      })
    )
    .describe("ongoing negotiation tracks"),
  parties: z
    .array(
      z.object({
        id: z.string().describe("short slug, e.g. 'us', 'iran', 'israel', 'iaea'"),
        name: z.string(),
        role: z.string(),
        redLines: z.array(z.string()).describe("stated non-negotiables"),
        demands: z.array(z.string()).describe("what this party is asking for"),
        needs: z.array(z.string()).describe("underlying interests/needs (may differ from demands)"),
        findingRefs: z.array(z.string()).min(1),
      })
    )
    .min(3)
    .describe("3+ parties: the core actors plus any material actors discovered"),
  openQuestions: z.array(z.string()).describe("important unknowns the sources do not resolve"),
});
export type State = z.infer<typeof StateSchema>;

// ---- 3. Deal-Making ---------------------------------------------------------
export const DealmakingSchema = z.object({
  currentDynamics: z.string().describe("where deal-making actually stands right now"),
  likelyFramework: z.object({
    elements: z.array(z.string()).describe("the elements of a deal if the parties agreed today"),
    whoConcedes: z.string().describe("who would have to give what for this framework to hold"),
  }),
  implications: z.object({
    internationalSecurity: z.string(),
    regionalSpillover: z.string(),
  }),
  flareupRisk: z.object({
    level: z.enum(["low", "moderate", "high", "severe"]),
    drivers: z.array(z.string()).describe("what could reignite the conflict"),
  }),
  longevity: z.object({
    rating: z.enum(["fragile", "moderate", "durable"]),
    rationale: z.string().describe("why a deal on this framework would or wouldn't last"),
  }),
  findingRefs: z.array(z.string()).min(1),
});
export type Dealmaking = z.infer<typeof DealmakingSchema>;

// ---- 4. Improved Peace Plan (the prescriptive stage) ------------------------
export const PeacePlanSchema = z.object({
  criteria: z
    .array(z.object({ name: z.string(), description: z.string() }))
    .min(3)
    .describe("the explicit criteria used to judge 'better/fairer/more sustainable'"),
  plan: z.object({
    pillars: z.array(z.object({ title: z.string(), detail: z.string() })).min(2),
    sequencing: z.array(z.string()).describe("an ordered path to implementation"),
    guarantees: z.array(z.string()).describe("enforcement / verification / guarantee mechanisms"),
    partyBenefits: z
      .array(z.object({ actorId: z.string(), gains: z.string(), concessions: z.string() }))
      .min(3)
      .describe("how each party fares — must cover the core parties"),
  }),
  comparisonToCurrent: z.object({
    whyBetter: z.string().describe("why this beats the Stage-3 likely framework, on the stated criteria"),
    tradeoffs: z.array(z.string()),
    risks: z.array(z.string()),
  }),
  disclaimer: z
    .string()
    .describe("states this is AI-generated analytical exploration, not authoritative or a prediction"),
});
export type PeacePlan = z.infer<typeof PeacePlanSchema>;

// ---- 5. Changelog (events since the last update, each sourced) --------------
export const ChangelogSchema = z.object({
  events: z
    .array(
      z.object({
        headline: z.string().describe("a concrete development that occurred since the last update"),
        date: z.string().describe("when it happened/was reported (ISO if known)"),
        detail: z.string().describe("1-2 sentence neutral description"),
        findingRefs: z.array(z.string()).min(1).describe("finding ids that source this event"),
      })
    )
    .describe("discrete events since the previous snapshot, most recent first; [] if nothing material changed"),
});
export type Changelog = z.infer<typeof ChangelogSchema>;

export const STAGE_SCHEMAS = {
  findings: FindingsSchema,
  state: StateSchema,
  dealmaking: DealmakingSchema,
  peaceplan: PeacePlanSchema,
  changelog: ChangelogSchema,
} as const;

export type StageId = keyof typeof STAGE_SCHEMAS;
