import { setOfflineFallback } from "@workspace/api-client-react";
import { readOfflineCollection } from "./offlineStore";

/**
 * Serves key GET endpoints from the structured offline store when the network
 * is unavailable, so the whole preloaded active dataset stays viewable — not
 * just pages the service worker happened to cache.
 *
 * The account context is registered after login (and cleared on logout) so
 * one account can never read another account's cached data.
 */
let account: { userId: number; propertyId: number } | null = null;

export function setOfflineAccount(userId: number, propertyId: number): void {
  account = { userId, propertyId };
}
export function clearOfflineAccount(): void {
  account = null;
}
export function getOfflineAccount(): { userId: number; propertyId: number } | null {
  return account;
}

type Row = Record<string, unknown>;

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", "X-Fieldbook-Offline": "1" } });

const byId = (rows: Row[]) => new Map(rows.map((r) => [r.id as number, r]));

async function collections(...names: Parameters<typeof readOfflineCollection>[2][]) {
  if (!account) return null;
  const { userId, propertyId } = account;
  return Promise.all(names.map((name) => readOfflineCollection<Row>(userId, propertyId, name)));
}

const OPEN_ACTION = (status: unknown) => status !== "completed" && status !== "cancelled";

async function handle(url: URL): Promise<Response | null> {
  const path = url.pathname.replace(/\/+$/, "");
  const params = url.searchParams;

  if (path === "/api/categories") {
    const data = await collections("categories");
    return data ? json(data[0]) : null;
  }
  if (path === "/api/locations") {
    const data = await collections("locations");
    return data ? json(data[0]) : null;
  }
  if (path === "/api/activity-types") {
    const data = await collections("activityTypes");
    return data ? json((data[0]).filter((t) => t.active !== false)) : null;
  }
  if (path === "/api/users/assignees") {
    const data = await collections("users");
    return data ? json(data[0].filter((u) => u.active !== false)) : null;
  }

  if (path === "/api/observations") {
    const data = await collections("observations", "categories", "locations", "users", "actions");
    if (!data) return null;
    const [observations, categories, locations, users, actions] = data;
    const cat = byId(categories); const loc = byId(locations); const usr = byId(users);
    const actionCount = new Map<number, number>();
    for (const a of actions) {
      if (a.observationId != null) actionCount.set(a.observationId as number, (actionCount.get(a.observationId as number) ?? 0) + 1);
    }
    let rows: Row[] = observations.map((o): Row => ({
      ...o,
      categoryName: o.categoryId != null ? (cat.get(o.categoryId as number)?.name ?? null) : null,
      categoryColour: o.categoryId != null ? (cat.get(o.categoryId as number)?.displayColour ?? null) : null,
      namedLocationName: o.namedLocationId != null ? (loc.get(o.namedLocationId as number)?.name ?? null) : null,
      reportedByName: o.reportedByUserId != null ? (usr.get(o.reportedByUserId as number)?.name ?? null) : null,
      actionCount: actionCount.get(o.id as number) ?? 0,
    }));
    const status = params.get("status"); if (status) rows = rows.filter((r) => r.status === status);
    const priority = params.get("priority"); if (priority) rows = rows.filter((r) => r.priority === priority);
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const page = Number(params.get("page") ?? 1); const limit = Number(params.get("limit") ?? 20);
    return json({ observations: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit });
  }

  if (path === "/api/actions") {
    const data = await collections("actions", "observations", "locations", "users");
    if (!data) return null;
    const [actions, observations, locations, users] = data;
    const obs = byId(observations); const loc = byId(locations); const usr = byId(users);
    let rows: Row[] = actions.map((a): Row => ({
      ...a,
      observationTitle: a.observationId != null ? (obs.get(a.observationId as number)?.title ?? null) : null,
      observationRef: a.observationId != null ? (obs.get(a.observationId as number)?.referenceNumber ?? null) : null,
      assignedToName: a.assignedToUserId != null ? (usr.get(a.assignedToUserId as number)?.name ?? null) : null,
      namedLocationName: a.namedLocationId != null ? (loc.get(a.namedLocationId as number)?.name ?? null) : null,
    }));
    const bucket = params.get("bucket");
    if (bucket === "open") rows = rows.filter((r) => OPEN_ACTION(r.status));
    if (bucket === "closed" || bucket === "completed") rows = rows.filter((r) => !OPEN_ACTION(r.status));
    const status = params.get("status"); if (status) rows = rows.filter((r) => r.status === status);
    const assigned = params.get("assignedUserId"); if (assigned) rows = rows.filter((r) => String(r.assignedToUserId) === assigned);
    const observationId = params.get("observationId"); if (observationId) rows = rows.filter((r) => String(r.observationId) === observationId);
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const page = Number(params.get("page") ?? 1); const limit = Number(params.get("limit") ?? 20);
    return json({ actions: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit });
  }

  if (path === "/api/activities") {
    const data = await collections("activities", "activityTypes", "activityParticipants", "activityLocations", "locations", "users");
    if (!data) return null;
    const [activities, types, participants, activityLocations, locations, users] = data;
    const typ = byId(types); const loc = byId(locations); const usr = byId(users);
    const partsByLog = new Map<number, Row[]>();
    for (const p of participants) {
      const list = partsByLog.get(p.activityLogId as number) ?? [];
      list.push({ userId: p.userId, name: usr.get(p.userId as number)?.name ?? "Unknown" });
      partsByLog.set(p.activityLogId as number, list);
    }
    const locsByLog = new Map<number, Row[]>();
    for (const l of activityLocations) {
      const list = locsByLog.get(l.activityLogId as number) ?? [];
      list.push({ id: l.namedLocationId, name: loc.get(l.namedLocationId as number)?.name ?? "Unknown" });
      locsByLog.set(l.activityLogId as number, list);
    }
    const rows = activities.filter((a) => a.deletedAt == null).map((a) => {
      const rowParticipants = partsByLog.get(a.id as number) ?? [];
      const duration = Number(a.durationMinutes ?? 0);
      const staff = a.hoursStatus === "staff_participants" ? duration * rowParticipants.length : 0;
      const volunteers = a.volunteerCount != null ? Number(a.volunteerCount) : null;
      return {
        id: a.id, activityTypeId: a.activityTypeId,
        activityTypeName: typ.get(a.activityTypeId as number)?.name ?? "Unknown",
        activityCategory: typ.get(a.activityTypeId as number)?.category ?? null,
        activityDate: a.activityDate, durationMinutes: duration, elapsedMinutes: duration,
        hoursStatus: a.hoursStatus, staffPersonMinutes: staff,
        volunteerCount: volunteers, volunteerPersonMinutes: volunteers != null ? volunteers * duration : null,
        contractorMinutes: a.contractorHoursUnknown ? null : a.contractorMinutes ?? null,
        contractorHoursUnknown: a.contractorHoursUnknown === true,
        notes: a.notes ?? null, recordedByUserId: a.recordedByUserId,
        recordedByName: usr.get(a.recordedByUserId as number)?.name ?? "Unknown",
        createdAt: a.createdAt,
        participants: rowParticipants, locations: locsByLog.get(a.id as number) ?? [],
      };
    });
    rows.sort((a, b) => String(b.activityDate).localeCompare(String(a.activityDate)) || String(b.createdAt).localeCompare(String(a.createdAt)));
    const page = Number(params.get("page") ?? 1); const limit = Number(params.get("limit") ?? 20);
    return json({ activities: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit });
  }

  return null;
}

export function initialiseOfflineFallback(): void {
  setOfflineFallback(async (rawUrl) => {
    if (!account) return null;
    try {
      return await handle(new URL(rawUrl, window.location.origin));
    } catch {
      return null;
    }
  });
}
