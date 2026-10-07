import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { deriveInsights } from "./insights";
import { applyMutations, applyPendingInsight } from "./mutations";
import { blankWorld, specWorld } from "./seed";
import type {
  ChatMessage,
  CompanionWorld,
  Commitment,
  Decision,
  Draft,
  Goal,
  Idea,
  Insight,
  MemoryItem,
  MutationPayload,
  PermissionPolicy,
  PresenceState,
  Project,
  UserProfile,
} from "./types";

// `presence` lives alongside `_hasHydrated` here: both are transient session
// state (not part of the durable CompanionWorld), excluded from persistence
// in toPersistedWorld() below. Global rather than per-page so the wake-word
// listener and any orb display (the Talk page, and the standalone /orb route
// used by the Electron shell) all reflect the same "is Chief alive right
// now" state instead of each keeping their own out-of-sync copy.
type Hydrated = { _hasHydrated: boolean; presence: PresenceState };

type Actions = {
  setHasHydrated: (v: boolean) => void;
  setPresence: (p: PresenceState) => void;
  completeOnboarding: (name: string, mode: "spec" | "blank") => void;
  resetWorld: () => void;
  importWorld: (world: CompanionWorld) => void;
  setProfile: (patch: Partial<UserProfile>) => void;
  setPolicy: (patch: Partial<PermissionPolicy>) => void;
  setVoiceEnabled: (v: boolean) => void;
  setAlwaysListening: (v: boolean) => void;
  setAmbientSettings: (patch: Partial<Pick<CompanionWorld, "ambientModeEnabled" | "launchOnStartup" | "screenContextEnabled" | "localFileAccessEnabled">>) => void;
  addMessage: (msg: ChatMessage) => void;
  ingestReply: (
    userText: string,
    reply: string,
    mutations?: MutationPayload | null,
    parseFailed?: boolean,
  ) => ChatMessage;
  dismissInsight: (id: string) => void;
  approveInsight: (id: string) => void;
  refreshInsights: () => void;
  upsertProject: (project: Project) => void;
  upsertGoal: (goal: Goal) => void;
  upsertIdea: (idea: Idea) => void;
  upsertDecision: (decision: Decision) => void;
  upsertCommitment: (commitment: Commitment) => void;
  addMemory: (memory: Omit<MemoryItem, "id" | "created">) => void;
  remove: (bucket: "projects" | "goals" | "ideas" | "decisions" | "commitments" | "memories" | "people" | "drafts", id: string) => void;
  capture: (kind: "idea" | "commitment" | "decision" | "memory", payload: Record<string, string>) => void;
  touchProject: (id: string) => void;
  setFocus: (focus: string) => void;
};

export type CompanionStore = CompanionWorld & Hydrated & Actions;

/**
 * Strip zustand actions/hydration flags off the store, leaving just the
 * CompanionWorld data. Shared by localStorage's `partialize` below AND by the
 * server-sync hook (use-companion-sync.ts), so "what actually gets persisted"
 * can't drift between the two backends.
 */
export function toPersistedWorld(s: CompanionStore): CompanionWorld {
  const {
    _hasHydrated: _h,
    presence: _pr,
    setHasHydrated: _a,
    setPresence: _sp,
    completeOnboarding: _b,
    resetWorld: _c,
    importWorld: _d,
    setProfile: _e,
    setPolicy: _f,
    setVoiceEnabled: _g,
    setAlwaysListening: _al,
    setAmbientSettings: _am,
    addMessage: _i,
    ingestReply: _j,
    dismissInsight: _k,
    approveInsight: _k2,
    refreshInsights: _l,
    upsertProject: _m,
    upsertGoal: _n,
    upsertIdea: _o,
    upsertDecision: _p,
    upsertCommitment: _q,
    addMemory: _r,
    remove: _s,
    capture: _t,
    touchProject: _u,
    setFocus: _v,
    ...world
  } = s;
  return world;
}

export function toSyncedWorld(s: CompanionStore): Partial<CompanionWorld> {
  const {
    ambientModeEnabled: _ambientModeEnabled,
    launchOnStartup: _launchOnStartup,
    screenContextEnabled: _screenContextEnabled,
    localFileAccessEnabled: _localFileAccessEnabled,
    ...world
  } = toPersistedWorld(s);
  return world;
}

function normalizeWorld(seed?: Partial<CompanionWorld> | null): CompanionWorld {
  const base = blankWorld("Founder");
  const value = (seed && typeof seed === "object" ? seed : {}) as Partial<CompanionWorld>;
  const profile = { ...base.profile, ...(value.profile ?? {}) };
  const policy = { ...base.policy, ...(value.policy ?? {}) };

  return {
    ...base,
    ...value,
    onboarded: Boolean(value.onboarded ?? true),
    profile,
    policy,
    goals: Array.isArray(value.goals) ? (value.goals as Goal[]) : [],
    projects: Array.isArray(value.projects) ? (value.projects as Project[]) : [],
    people: Array.isArray(value.people) ? (value.people as CompanionWorld["people"]) : [],
    decisions: Array.isArray(value.decisions) ? (value.decisions as Decision[]) : [],
    commitments: Array.isArray(value.commitments) ? (value.commitments as Commitment[]) : [],
    ideas: Array.isArray(value.ideas) ? (value.ideas as Idea[]) : [],
    memories: Array.isArray(value.memories) ? (value.memories as MemoryItem[]) : [],
    messages: Array.isArray(value.messages) ? (value.messages as ChatMessage[]) : [],
    insights: Array.isArray(value.insights) ? (value.insights as Insight[]) : [],
    drafts: Array.isArray(value.drafts) ? (value.drafts as Draft[]) : [],
    voiceEnabled: Boolean(value.voiceEnabled),
    alwaysListening: Boolean(value.alwaysListening),
    ambientModeEnabled: Boolean(value.ambientModeEnabled ?? true),
    launchOnStartup: Boolean(value.launchOnStartup),
    screenContextEnabled: Boolean(value.screenContextEnabled),
    localFileAccessEnabled: Boolean(value.localFileAccessEnabled),
    createdAt: value.createdAt ?? base.createdAt,
  };
}

const empty = normalizeWorld(blankWorld("Founder"));
empty.onboarded = false;

function safeStorage() {
  if (typeof window === "undefined") return undefined;
  return createJSONStorage(() => localStorage);
}

export const useCompanion = create<CompanionStore>()(
  persist(
    (set, get) => ({
      ...empty,
      _hasHydrated: false,
      presence: "idle",
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setPresence: (p) => set({ presence: p }),
      completeOnboarding: (name, mode) => {
        const world = mode === "spec" ? specWorld(name) : blankWorld(name);
        const derived = deriveInsights(world);
        set({
          ...world,
          insights: derived.insights,
          drafts: [...derived.drafts, ...world.drafts].slice(0, 12),
          _hasHydrated: true,
        });
      },
      resetWorld: () => {
        const cleared = blankWorld(get().profile.name || "Founder");
        cleared.onboarded = false;
        set({ ...cleared, _hasHydrated: true });
      },
      importWorld: (world) => set({ ...world, onboarded: true, _hasHydrated: true }),
      setProfile: (patch) =>
        set((s) => ({ profile: { ...s.profile, ...patch } })),
      setPolicy: (patch) => set((s) => ({ policy: { ...s.policy, ...patch } })),
      setVoiceEnabled: (v) => set({ voiceEnabled: v }),
      setAlwaysListening: (v) => set({ alwaysListening: v }),
      setAmbientSettings: (patch) => set((s) => ({ ...s, ...patch })),
      addMessage: (msg) =>
        set((s) => ({
          messages: [...s.messages, msg].slice(-48),
        })),
      ingestReply: (userText, reply, mutations, parseFailed) => {
        const s = get();
        const stamp = new Date().toISOString();
        const userMsg: ChatMessage = {
          id: uid("msg"),
          role: "user",
          content: userText,
          created: stamp,
        };
        const { world, applied, draft } = applyMutations(s, mutations);
        const assistant: ChatMessage = {
          id: uid("msg"),
          role: "assistant",
          content: reply,
          created: new Date().toISOString(),
          mutations: applied,
          draft,
        };
        const derived = deriveInsights({ ...world, messages: [...s.messages, userMsg, assistant] });
        let insights = derived.insights;
        if (parseFailed) {
          insights = [
            {
              id: uid("ins"),
              title: "A reply didn't parse cleanly",
              body: "Chief's last response wasn't valid structured output — nothing was silently written from it. Worth re-asking if you expected a mutation.",
              severity: "attention",
              created: stamp,
            },
            ...derived.insights,
          ];
        }
        set({
          ...world,
          messages: [...s.messages, userMsg, assistant].slice(-48),
          insights,
          drafts: [...derived.drafts, ...world.drafts].slice(0, 12),
        });
        return assistant;
      },
      dismissInsight: (id) =>
        set((s) => ({
          insights: s.insights.map((i) => (i.id === id ? { ...i, dismissed: true } : i)),
        })),
      approveInsight: (id) =>
        set((s) => {
          const insight = s.insights.find((i) => i.id === id);
          if (!insight || !insight.pendingKind) return {};
          const { world } = applyPendingInsight(s, insight);
          return { ...world };
        }),
      refreshInsights: () =>
        set((s) => {
          const derived = deriveInsights(s);
          return {
            insights: derived.insights,
            drafts: [...derived.drafts, ...s.drafts].slice(0, 12),
          };
        }),
      upsertProject: (project) =>
        set((s) => {
          const idx = s.projects.findIndex((p) => p.id === project.id);
          const projects = [...s.projects];
          if (idx >= 0) projects[idx] = project;
          else projects.unshift(project);
          return { projects };
        }),
      upsertGoal: (goal) =>
        set((s) => {
          const idx = s.goals.findIndex((p) => p.id === goal.id);
          const goals = [...s.goals];
          if (idx >= 0) goals[idx] = goal;
          else goals.unshift(goal);
          return { goals };
        }),
      upsertIdea: (idea) =>
        set((s) => {
          const idx = s.ideas.findIndex((p) => p.id === idea.id);
          const ideas = [...s.ideas];
          if (idx >= 0) ideas[idx] = idea;
          else ideas.unshift(idea);
          return { ideas };
        }),
      upsertDecision: (decision) =>
        set((s) => {
          const idx = s.decisions.findIndex((p) => p.id === decision.id);
          const decisions = [...s.decisions];
          if (idx >= 0) decisions[idx] = decision;
          else decisions.unshift(decision);
          return { decisions };
        }),
      upsertCommitment: (commitment) =>
        set((s) => {
          const idx = s.commitments.findIndex((p) => p.id === commitment.id);
          const commitments = [...s.commitments];
          if (idx >= 0) commitments[idx] = commitment;
          else commitments.unshift(commitment);
          return { commitments };
        }),
      addMemory: (memory) =>
        set((s) => ({
          memories: [
            ...s.memories,
            {
              ...memory,
              id: uid("mem"),
              created: new Date().toISOString(),
            },
          ].slice(-80),
        })),
      remove: (bucket, id) =>
        set((s) => ({
          [bucket]: (s[bucket] as Array<{ id: string }>).filter((x) => x.id !== id),
        })),
      capture: (kind, payload) => {
        const stamp = new Date().toISOString();
        const s = get();
        if (kind === "idea") {
          const idea: Idea = {
            id: uid("idea"),
            title: payload.title || "Untitled idea",
            description: payload.body || payload.title || "",
            context: payload.context,
            relatedProjectIds: [],
            status: "unvalidated",
            created: stamp,
          };
          set({ ideas: [idea, ...s.ideas] });
        } else if (kind === "commitment") {
          const c: Commitment = {
            id: uid("com"),
            title: payload.title || "Untitled commitment",
            owner: s.profile.name,
            created: stamp,
            due: payload.due || undefined,
            status: "pending",
          };
          set({ commitments: [c, ...s.commitments] });
        } else if (kind === "decision") {
          const d: Decision = {
            id: uid("dec"),
            statement: payload.title || "Decision",
            why: payload.body || "Recorded by you.",
            date: stamp,
            alternatives: payload.alternatives
              ? payload.alternatives.split(",").map((x) => x.trim()).filter(Boolean)
              : [],
            status: "active",
          };
          set({ decisions: [d, ...s.decisions] });
        } else {
          get().addMemory({
            kind: "episodic",
            content: payload.body || payload.title || "",
            source: "capture",
            confidence: "fact",
            tags: ["capture"],
          });
        }
        get().refreshInsights();
      },
      touchProject: (id) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, lastTouched: new Date().toISOString() } : p,
          ),
        })),
      setFocus: (focus) =>
        set((s) => ({ profile: { ...s.profile, currentFocus: focus } })),
    }),
    {
      name: "chief-world-v1",
      storage: safeStorage(),
      skipHydration: true,
      partialize: toPersistedWorld,
      merge: (persisted, current) => ({
        ...(current as CompanionStore),
        ...normalizeWorld({
          ...(current as CompanionWorld),
          ...((persisted as Partial<CompanionWorld>) ?? {}),
        }),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const normalized = normalizeWorld(state as Partial<CompanionWorld>);
        Object.assign(state, normalized);
        state.setHasHydrated(true);
      },
    },
  ),
);