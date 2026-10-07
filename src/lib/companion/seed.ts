import { uid } from "@/lib/utils";
import type {
  Commitment,
  Decision,
  Goal,
  Idea,
  MemoryItem,
  Person,
  Project,
  UserProfile,
} from "./types";
import type { CompanionWorld } from "./types";

const now = () => new Date().toISOString();

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export function blankWorld(name: string): CompanionWorld {
  const created = now();
  return {
    onboarded: true,
    profile: {
      name: name.trim() || "Founder",
      role: "Builder",
      workingStyle: "",
      principles: [],
      strengths: [],
      weaknesses: [],
    },
    goals: [],
    projects: [],
    people: [],
    decisions: [],
    commitments: [],
    ideas: [],
    memories: [
      {
        id: uid("mem"),
        kind: "episodic",
        content: "Workspace opened. No prior world model yet.",
        source: "system",
        confidence: "fact",
        created,
        tags: ["origin"],
      },
    ],
    messages: [],
    insights: [
      {
        id: uid("ins"),
        title: "Empty world",
        body: "Tell me what you're building, what money has to do right now, and what you promised someone. I'll start forming a model.",
        severity: "info",
        created,
      },
    ],
    drafts: [],
    policy: {
      memoryExtract: "autonomous",
      decisions: "autonomous",
      commitments: "execute",
      ideas: "autonomous",
      projectUpdate: "execute",
      goalUpdate: "ask",
      profileUpdate: "autonomous",
      drafts: "autonomous",
      emailSend: "ask",
    },
    voiceEnabled: false,
    alwaysListening: false,
    ambientModeEnabled: true,
    launchOnStartup: false,
    screenContextEnabled: false,
    localFileAccessEnabled: false,
    createdAt: created,
  };
}

export function specWorld(name: string): CompanionWorld {
  const created = now();
  const profile: UserProfile = {
    name: name.trim() || "Nnamdi",
    role: "Founder / engineer",
    workingStyle:
      "Deep work in bursts. Visual polish becomes a trap when cash pressure is high. Thinks in systems, not features.",
    principles: [
      "Income before polish when cash is tight",
      "Decisions keep their why",
      "Ship before perfect",
      "One world model — projects are not isolated",
    ],
    strengths: [
      "Systems thinking",
      "Shipping technical products end-to-end",
      "Product taste",
    ],
    weaknesses: [
      "Can over-polish interfaces",
      "Splits attention across too many initiatives",
      "Leaves application / sales motion until late",
    ],
    currentFocus: "Portfolio visual polish — high-priority career packaging",
  };

  const people: Person[] = [
    {
      id: "person-backend",
      name: "Backend opportunity contact",
      role: "Hiring / contracting",
      notes: "Follow-up is outstanding.",
    },
    {
      id: "person-client",
      name: "Active client",
      role: "Client",
      notes: "A follow-up was promised.",
    },
  ];

  const goals: Goal[] = [
    {
      id: "goal-income",
      title: "Immediate income",
      why: "Cash runway and optionality. Currently more important than polishing existing products.",
      priority: 1,
      progress: 20,
      status: "active",
      relatedProjectIds: ["proj-jobs", "proj-client", "proj-portfolio"],
      deadline: daysFromNow(21),
    },
    {
      id: "goal-positioning",
      title: "Professional positioning",
      why: "Portfolio and applications as a hedge if products don't convert.",
      priority: 1,
      progress: 55,
      status: "active",
      relatedProjectIds: ["proj-portfolio", "proj-jobs"],
      deadline: daysFromNow(10),
    },
    {
      id: "goal-products",
      title: "Commercially viable AI products",
      why: "Long-term flagship. DataPilot, Cognivis, and the WIS thesis all sit here.",
      priority: 2,
      progress: 35,
      status: "active",
      relatedProjectIds: ["proj-datapilot", "proj-cognivis", "proj-clariva", "proj-chief"],
    },
  ];

  const projects: Project[] = [
    {
      id: "proj-portfolio",
      name: "Portfolio",
      objective: "Package work so opportunities can find you — then stop polishing.",
      status: "building",
      progress: 82,
      tasks: [
        { id: "t-p1", title: "Hero section rewrite", status: "doing" },
        { id: "t-p2", title: "Case studies for DataPilot and Cognivis", status: "todo" },
        { id: "t-p3", title: "Application package export", status: "todo" },
      ],
      blockers: ["Case studies still thin"],
      peopleIds: [],
      resources: ["Repository", "Design files"],
      nextAction: "Stop visual tweaks. Finish two case studies. Export the package.",
      lastTouched: daysAgo(0),
      notes: "Currently absorbing disproportionate attention relative to the income goal.",
    },
    {
      id: "proj-jobs",
      name: "Job search",
      objective: "Convert positioning into interviews and offers.",
      status: "committed",
      progress: 14,
      tasks: [
        { id: "t-j1", title: "Submit three targeted applications", status: "todo" },
        { id: "t-j2", title: "Follow up on backend opportunity", status: "todo" },
        { id: "t-j3", title: "Update tracker", status: "todo" },
      ],
      blockers: ["Nothing submitted recently"],
      peopleIds: ["person-backend"],
      resources: ["Tracker"],
      deadline: daysFromNow(1),
      nextAction: "Submit at least one application today. Draft the backend follow-up.",
      lastTouched: daysAgo(4),
    },
    {
      id: "proj-datapilot",
      name: "DataPilot",
      objective: "Workflow intelligence for analytical work — Jupyter, Excel, ML, BI, decks.",
      status: "launched",
      progress: 70,
      tasks: [
        { id: "t-d1", title: "Decide pause vs. reposition as WIS platform", status: "todo" },
        { id: "t-d2", title: "Landing page polish", status: "doing" },
      ],
      blockers: ["No users. Enthusiasm has shifted."],
      peopleIds: [],
      resources: ["GitHub", "Deployment"],
      nextAction: "Do not polish the landing page. Decide whether WIS lives here or elsewhere.",
      lastTouched: daysAgo(1),
      notes:
        "Originally intended as the flagship WIS product. Sitting without users. Enthusiasm moved after building it.",
    },
    {
      id: "proj-cognivis",
      name: "Cognivis",
      objective: "Ship an MVP of Cognivis with a Flask backend.",
      status: "building",
      progress: 32,
      tasks: [
        { id: "t-c1", title: "Product definition freeze", status: "done" },
        { id: "t-c2", title: "Flask API skeleton", status: "doing" },
        { id: "t-c3", title: "Frontend shell", status: "todo" },
        { id: "t-c4", title: "AI layer", status: "todo" },
      ],
      blockers: [],
      peopleIds: [],
      resources: ["Flask", "Repository"],
      nextAction: "Finish the API skeleton. Do not expand scope.",
      lastTouched: daysAgo(2),
    },
    {
      id: "proj-clariva",
      name: "Clariva",
      objective: "Move Clariva from integration work to a testable build.",
      status: "building",
      progress: 48,
      tasks: [
        { id: "t-cl1", title: "Backend", status: "done" },
        { id: "t-cl2", title: "Authentication", status: "done" },
        { id: "t-cl3", title: "Frontend integration", status: "doing" },
        { id: "t-cl4", title: "API error handling", status: "blocked" },
      ],
      blockers: ["API error handling"],
      peopleIds: [],
      resources: ["Repository"],
      nextAction: "Fix error handling, then run integration tests.",
      lastTouched: daysAgo(1),
    },
    {
      id: "proj-client",
      name: "Client work",
      objective: "Keep the paid engagement healthy. Directly supports income.",
      status: "building",
      progress: 60,
      tasks: [
        { id: "t-cw1", title: "Follow up today", status: "todo" },
      ],
      blockers: [],
      peopleIds: ["person-client"],
      resources: [],
      nextAction: "Send the follow-up. Draft is waiting to be prepared.",
      lastTouched: daysAgo(3),
    },
    {
      id: "proj-chief",
      name: "Chief — AI partner",
      objective: "A persistent operating partner: observe, remember, reason, act.",
      status: "building",
      progress: 40,
      tasks: [
        { id: "t-ch1", title: "Prove the memory loop", status: "doing" },
        { id: "t-ch2", title: "World model + knowledge graph", status: "doing" },
      ],
      blockers: [],
      peopleIds: [],
      resources: ["This workspace"],
      nextAction: "Talk to Chief. Let it extract a decision or a commitment from a real conversation.",
      lastTouched: daysAgo(0),
      notes: "The intelligence layer sitting across the rest of the digital workflow.",
    },
  ];

  const decisions: Decision[] = [
    {
      id: "dec-flask",
      statement: "Use Flask for the Cognivis backend.",
      why: "Existing familiarity plus project requirements. Speed to MVP over greenfield Node.",
      date: daysAgo(18),
      alternatives: ["Node / Express", "FastAPI"],
      status: "active",
      projectId: "proj-cognivis",
    },
    {
      id: "dec-datapilot-flagship",
      statement: "DataPilot is the flagship WIS product.",
      why: "It unified a fragmented analytics workflow and was the first full expression of WIS.",
      date: daysAgo(90),
      alternatives: ["WIS as a horizontal layer", "Cognivis as flagship"],
      status: "revisit",
      projectId: "proj-datapilot",
    },
    {
      id: "dec-income-first",
      statement: "Getting income is currently more important than polishing DataPilot.",
      why: "Runway. Portfolio + applications + paid work move cash; landing-page polish does not.",
      date: daysAgo(1),
      alternatives: ["Double down on DataPilot GTM", "Pause job search"],
      status: "active",
    },
  ];

  const commitments: Commitment[] = [
    {
      id: "com-follow-client",
      title: "Follow up with the client",
      owner: profile.name,
      created: daysAgo(2),
      due: daysFromNow(0),
      status: "pending",
      relatedProjectId: "proj-client",
      relatedPersonId: "person-client",
    },
    {
      id: "com-backend",
      title: "Follow up on the backend opportunity",
      owner: profile.name,
      created: daysAgo(5),
      due: daysFromNow(0),
      status: "pending",
      relatedProjectId: "proj-jobs",
      relatedPersonId: "person-backend",
    },
    {
      id: "com-apps",
      title: "Submit applications from the backlog",
      owner: profile.name,
      created: daysAgo(6),
      due: daysFromNow(1),
      status: "pending",
      relatedProjectId: "proj-jobs",
    },
    {
      id: "com-case",
      title: "Write two portfolio case studies",
      owner: profile.name,
      created: daysAgo(3),
      due: daysFromNow(3),
      status: "pending",
      relatedProjectId: "proj-portfolio",
    },
  ];

  const ideas: Idea[] = [
    {
      id: "idea-wis-layer",
      title: "WIS as a horizontal intelligence layer",
      description:
        "The Workflow Intelligence System may have stronger commercial potential outside DataPilot — as a layer across tools, not a single analytics product.",
      context: "Enthusiasm for DataPilot cooled after building it. The underlying idea did not.",
      relatedProjectIds: ["proj-datapilot", "proj-chief"],
      potentialValue: "Larger market than a single analytics app.",
      status: "exploring",
      created: daysAgo(12),
    },
    {
      id: "idea-chief",
      title: "A persistent AI partner, not a chatbot",
      description:
        "An intelligence layer between a person and their digital life: memory, reasoning, proactivity, permissioned action.",
      context: "JARVIS as relationship model, not as a character to copy.",
      relatedProjectIds: ["proj-chief"],
      potentialValue: "Category-defining if the world model is real.",
      status: "committed",
      created: daysAgo(20),
    },
    {
      id: "idea-mention",
      title: "Group unfinished work by project automatically",
      description: "Surface clusters of stalled tasks instead of a flat list.",
      relatedProjectIds: ["proj-chief"],
      status: "unvalidated",
      created: daysAgo(4),
    },
  ];

  const memories: MemoryItem[] = [
    {
      id: uid("mem"),
      kind: "preference",
      content: "Prefers directness over corporate tone. Will accept being challenged.",
      source: "onboarding",
      confidence: "fact",
      created: daysAgo(20),
      tags: ["personality"],
    },
    {
      id: uid("mem"),
      kind: "semantic",
      content: "DataPilot unifies Jupyter, Excel, ML, Power BI, and PowerPoint into one analytical workflow.",
      source: "world",
      confidence: "fact",
      created: daysAgo(90),
      tags: ["datapilot", "wis"],
    },
    {
      id: uid("mem"),
      kind: "episodic",
      content: "Yesterday: income was declared more important than polishing DataPilot.",
      source: "conversation",
      confidence: "fact",
      created: daysAgo(1),
      tags: ["priority"],
    },
    {
      id: uid("mem"),
      kind: "episodic",
      content: "Job application tracker has not been touched in four days.",
      source: "observation",
      confidence: "fact",
      created: daysAgo(0),
      tags: ["jobs"],
    },
    {
      id: uid("mem"),
      kind: "procedural",
      content: "Deploying the portfolio: inspect repo → fix issues → tests → build → verify → ask before deploy.",
      source: "world",
      confidence: "assumption",
      created: daysAgo(8),
      tags: ["portfolio", "deploy"],
    },
    {
      id: uid("mem"),
      kind: "relationship",
      content: "Portfolio work supports professional positioning, which is a hedge for the income goal.",
      source: "world",
      confidence: "inference",
      created: daysAgo(0),
      tags: ["graph"],
    },
  ];

  return {
    onboarded: true,
    profile,
    goals,
    projects,
    people,
    decisions,
    commitments,
    ideas,
    memories,
    messages: [],
    insights: [],
    drafts: [],
    policy: {
      memoryExtract: "autonomous",
      decisions: "autonomous",
      commitments: "execute",
      ideas: "autonomous",
      projectUpdate: "execute",
      goalUpdate: "ask",
      profileUpdate: "autonomous",
      drafts: "autonomous",
      emailSend: "ask",
    },
    voiceEnabled: false,
    alwaysListening: false,
    ambientModeEnabled: true,
    launchOnStartup: false,
    screenContextEnabled: false,
    localFileAccessEnabled: false,
    createdAt: created,
  };
}