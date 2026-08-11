export const observationStatuses = [
  "draft",
  "submitted",
  "under_review",
  "action_required",
  "monitoring",
  "resolved",
  "closed",
  "cancelled",
] as const;

export type ObservationStatus = (typeof observationStatuses)[number];

export const observationTransitions: Record<ObservationStatus, readonly ObservationStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["under_review", "action_required", "monitoring", "resolved", "cancelled"],
  under_review: ["action_required", "monitoring", "resolved", "cancelled"],
  action_required: ["monitoring", "resolved", "cancelled"],
  monitoring: ["action_required", "resolved", "cancelled"],
  resolved: ["monitoring", "closed"],
  closed: ["monitoring"],
  cancelled: ["submitted"],
};

export const actionStatuses = [
  "not_started",
  "planned",
  "in_progress",
  "waiting",
  "completed",
  "cancelled",
] as const;

export type ActionStatus = (typeof actionStatuses)[number];

export const actionTransitions: Record<ActionStatus, readonly ActionStatus[]> = {
  not_started: ["planned", "in_progress", "cancelled"],
  planned: ["in_progress", "waiting", "cancelled"],
  in_progress: ["waiting", "completed", "cancelled"],
  waiting: ["in_progress", "cancelled"],
  completed: ["in_progress"],
  cancelled: ["not_started"],
};

export function canTransition<T extends string>(
  transitions: Record<T, readonly T[]>,
  from: T,
  to: T,
): boolean {
  return from === to || transitions[from].includes(to);
}
