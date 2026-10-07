export type Lifecycle =
  | "idea"
  | "exploring"
  | "validating"
  | "committed"
  | "building"
  | "launched"
  | "growing"
  | "paused"
  | "abandoned";

export type MemoryKind =
  | "episodic"
  | "semantic"
  | "procedural"
  | "preference"
  | "decision"
  | "goal"
  | "relationship";

export type Confidence = "fact" | "assumption" | "inference";

export type PermissionLevel =
  | "observe"
  | "suggest"
  | "prepare"
  | "ask"
  | "execute"
  | "autonomous";

export type TaskStatus = "todo" | "doing" | "done" | "blocked";
export type GoalStatus = "active" | "paused" | "done";
export type CommitmentStatus = "pending" | "done" | "dropped";
export type DecisionStatus = "active" | "superseded" | "revisit";
export type IdeaStatus =
  | "unvalidated"
  | "exploring"
  | "validating"
  | "committed"
  | "parked";
export type InsightSeverity = "info" | "attention" | "urgent";
export type PresenceState = "idle" | "listening" | "thinking" | "speaking";

export interface Person {
  id: string;
  name: string;
  role?: string;
  notes?: string;
  email?: string;
}

export interface Goal {
  id: string;
  title: string;
  why?: string;
  priority: 1 | 2 | 3;
  deadline?: string;
  progress: number;
  status: GoalStatus;
  relatedProjectIds: string[];
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  due?: string;
}

export interface Project {
  id: string;
  name: string;
  objective: string;
  status: Lifecycle;
  progress: number;
  tasks: Task[];
  blockers: string[];
  peopleIds: string[];
  resources: string[];
  deadline?: string;
  nextAction?: string;
  repo?: string;
  lastTouched?: string;
  notes?: string;
}

export interface Decision {
  id: string;
  statement: string;
  why: string;
  date: string;
  alternatives: string[];
  supersedes?: string;
  status: DecisionStatus;
  projectId?: string;
}

export interface Commitment {
  id: string;
  title: string;
  owner: string;
  created: string;
  due?: string;
  status: CommitmentStatus;
  relatedProjectId?: string;
  relatedPersonId?: string;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  context?: string;
  relatedProjectIds: string[];
  potentialValue?: string;
  status: IdeaStatus;
  created: string;
}

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  content: string;
  source: string;
  confidence: Confidence;
  created: string;
  tags: string[];
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  severity: InsightSeverity;
  created: string;
  dismissed?: boolean;
  href?: string;
  draftId?: string;
  /** Present when this insight is a gated mutation waiting on approval
   * (policy for this category was below "execute"). `pendingKind` names
   * which MutationPayload bucket it came from; `pendingPayload` is the
   * single item, ready to be re-applied verbatim via applyPending(). */
  pendingKind?: keyof MutationPayload;
  pendingPayload?: unknown;
}

export interface Draft {
  id: string;
  title: string;
  body: string;
  kind: "message" | "plan" | "tasklist" | "email";
  created: string;
  /** Only present when kind === "email" — who it's addressed to. */
  to?: string;
  /** Only present when kind === "email" — the email subject line (body is the message text). */
  subject?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created: string;
  mutations?: AppliedMutation[];
  draft?: Draft;
}

export interface AppliedMutation {
  kind:
    | "memory"
    | "decision"
    | "commitment"
    | "idea"
    | "project"
    | "goal"
    | "insight"
    | "profile"
    | "draft";
  label: string;
}

export interface UserProfile {
  name: string;
  role: string;
  workingStyle: string;
  principles: string[];
  strengths: string[];
  weaknesses: string[];
  currentFocus?: string;
}

export interface PermissionPolicy {
  memoryExtract: PermissionLevel;
  decisions: PermissionLevel;
  commitments: PermissionLevel;
  ideas: PermissionLevel;
  projectUpdate: PermissionLevel;
  goalUpdate: PermissionLevel;
  profileUpdate: PermissionLevel;
  drafts: PermissionLevel;
  emailSend: PermissionLevel;
}

export interface CompanionWorld {
  onboarded: boolean;
  profile: UserProfile;
  goals: Goal[];
  projects: Project[];
  people: Person[];
  decisions: Decision[];
  commitments: Commitment[];
  ideas: Idea[];
  memories: MemoryItem[];
  messages: ChatMessage[];
  insights: Insight[];
  drafts: Draft[];
  policy: PermissionPolicy;
  voiceEnabled: boolean;
  alwaysListening: boolean;
  ambientModeEnabled: boolean;
  launchOnStartup: boolean;
  screenContextEnabled: boolean;
  localFileAccessEnabled: boolean;
  createdAt: string;
}

export interface MutationPayload {
  memories?: Array<{
    kind: MemoryKind;
    content: string;
    confidence?: Confidence;
    tags?: string[];
  }>;
  decisions?: Array<{
    statement: string;
    why: string;
    alternatives?: string[];
    projectId?: string;
    status?: DecisionStatus;
  }>;
  commitments?: Array<{
    title: string;
    due?: string;
    relatedProjectId?: string;
    relatedPersonId?: string;
    status?: CommitmentStatus;
  }>;
  ideas?: Array<{
    title: string;
    description: string;
    context?: string;
    relatedProjectIds?: string[];
    potentialValue?: string;
    status?: IdeaStatus;
  }>;
  projectUpdates?: Array<{
    id?: string;
    name?: string;
    objective?: string;
    status?: Lifecycle;
    progress?: number;
    nextAction?: string;
    blockers?: string[];
    notes?: string;
    addTask?: { title: string; status?: TaskStatus };
  }>;
  goalUpdates?: Array<{
    id?: string;
    title?: string;
    why?: string;
    priority?: 1 | 2 | 3;
    progress?: number;
    status?: GoalStatus;
  }>;
  insights?: Array<{
    title: string;
    body: string;
    severity?: InsightSeverity;
  }>;
  profileUpdates?: Partial<Pick<UserProfile, "workingStyle" | "currentFocus">> & {
    addPrinciple?: string;
    addStrength?: string;
  };
  draft?: {
    title: string;
    body: string;
    kind: "message" | "plan" | "tasklist";
  };
  /**
   * Propose an email to send. Applying this mutation only creates a Draft
   * (kind "email") in world.drafts, gated by policy.emailSend like anything
   * else below "execute" — it never sends anything by itself. The actual
   * send is always a separate, explicit button press from the Drafts tab
   * (src/components/memory/memory-page.tsx), regardless of policy level.
   * That's a deliberate extra safety gate beyond the normal permission
   * ladder: unlike a memory or a decision, a sent email can't be undone and
   * reaches someone else.
   */
  emailDrafts?: Array<{
    to: string;
    subject: string;
    body: string;
  }>;
}

export interface CompanionReply {
  reply: string;
  spoken?: string;
  mutations?: MutationPayload;
}

export const LIFECYCLE_ORDER: Lifecycle[] = [
  "idea",
  "exploring",
  "validating",
  "committed",
  "building",
  "launched",
  "growing",
  "paused",
  "abandoned",
];

export const PERMISSION_ORDER: PermissionLevel[] = [
  "observe",
  "suggest",
  "prepare",
  "ask",
  "execute",
  "autonomous",
];