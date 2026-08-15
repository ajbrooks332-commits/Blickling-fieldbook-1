import { Router } from "express";
import ExcelJS from "exceljs";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  actionsTable, activityLogParticipantsTable, activityLogsTable, activityTypesTable,
  categoriesTable, db, namedLocationsTable, observationsTable, usersTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

/**
 * Neutralise spreadsheet formula injection in user-authored text cells.
 * Excel treats leading = + - @ (and tab/CR variants) as formulas.
 */
function safeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value);
  return /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

const asDate = (value: unknown): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

type SheetColumn = { header: string; key: string; width?: number; date?: boolean; user?: boolean };

function addSheet(workbook: ExcelJS.Workbook, name: string, columns: SheetColumn[], rows: Array<Record<string, unknown>>) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width ?? 18 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    const values: Record<string, unknown> = {};
    for (const column of columns) {
      const raw = row[column.key];
      values[column.key] = column.date ? asDate(raw) : column.user ? safeText(raw) : raw ?? null;
    }
    sheet.addRow(values);
  }
  for (const column of columns.filter((c) => c.date)) {
    sheet.getColumn(column.key).numFmt = "yyyy-mm-dd hh:mm";
  }
  return sheet;
}

const taskColumns: SheetColumn[] = [
  { header: "Task ID", key: "id", width: 9 },
  { header: "Reference", key: "reference", width: 14 },
  { header: "Title", key: "title", width: 40, user: true },
  { header: "Description", key: "description", width: 50, user: true },
  { header: "Status", key: "status", width: 13 },
  { header: "Priority", key: "priority", width: 10 },
  { header: "Assignee", key: "assignee", width: 20 },
  { header: "Location", key: "location", width: 22 },
  { header: "Linked Observation Ref", key: "observationRef", width: 20 },
  { header: "Due Date", key: "dueDate", width: 14, date: true },
  { header: "Device Created At", key: "deviceCreatedAt", width: 18, date: true },
  { header: "Synced At", key: "syncedAt", width: 18, date: true },
  { header: "Created At (server)", key: "createdAt", width: 18, date: true },
  { header: "Updated At", key: "updatedAt", width: 18, date: true },
  { header: "Completed At", key: "completedAt", width: 18, date: true },
  { header: "Archived", key: "archived", width: 10 },
  { header: "Archived At", key: "archivedAt", width: 18, date: true },
];

router.get("/export.xlsx", requireAuth, requireRole("administrator", "manager"), async (req, res) => {
  const propertyId = req.authUser!.propertyId!;

  const taskSelect = () => db.select({
    id: actionsTable.id, reference: actionsTable.referenceNumber, title: actionsTable.title,
    description: actionsTable.description, status: actionsTable.status, priority: actionsTable.priority,
    assignee: usersTable.name, location: namedLocationsTable.name, observationRef: observationsTable.referenceNumber,
    dueDate: actionsTable.dueDate, deviceCreatedAt: actionsTable.deviceCreatedAt, syncedAt: actionsTable.syncedAt, createdAt: actionsTable.createdAt,
    updatedAt: actionsTable.updatedAt, completedAt: actionsTable.completedAt, archivedAt: actionsTable.deletedAt,
  }).from(actionsTable)
    .leftJoin(usersTable, eq(actionsTable.assignedToUserId, usersTable.id))
    .leftJoin(namedLocationsTable, eq(actionsTable.namedLocationId, namedLocationsTable.id))
    .leftJoin(observationsTable, eq(actionsTable.observationId, observationsTable.id));

  const [openTasks, allTasks, observations, activities, participants, locations, categories, activityTypes, users] = await Promise.all([
    taskSelect().where(and(eq(actionsTable.propertyId, propertyId), isNull(actionsTable.deletedAt),
      sql`${actionsTable.status} NOT IN ('completed', 'cancelled')`)).orderBy(asc(actionsTable.dueDate)),
    taskSelect().where(eq(actionsTable.propertyId, propertyId)).orderBy(asc(actionsTable.id)),
    db.select({
      id: observationsTable.id, reference: observationsTable.referenceNumber, title: observationsTable.title,
      description: observationsTable.description, category: categoriesTable.name, location: namedLocationsTable.name,
      priority: observationsTable.priority, status: observationsTable.status,
      safetyIssue: observationsTable.safetyIssue, publicAccessAffected: observationsTable.publicAccessAffected,
      latitude: observationsTable.latitude, longitude: observationsTable.longitude,
      reporter: usersTable.name, observedAt: observationsTable.observedAt,
      deviceCreatedAt: observationsTable.deviceCreatedAt, syncedAt: observationsTable.syncedAt,
      createdAt: observationsTable.createdAt, updatedAt: observationsTable.updatedAt, resolvedAt: observationsTable.resolvedAt,
      archivedAt: observationsTable.deletedAt,
    }).from(observationsTable)
      .leftJoin(categoriesTable, eq(observationsTable.categoryId, categoriesTable.id))
      .leftJoin(namedLocationsTable, eq(observationsTable.namedLocationId, namedLocationsTable.id))
      .leftJoin(usersTable, eq(observationsTable.reportedByUserId, usersTable.id))
      .where(eq(observationsTable.propertyId, propertyId)).orderBy(asc(observationsTable.id)),
    db.select({
      id: activityLogsTable.id, activityType: activityTypesTable.name, activityDate: activityLogsTable.activityDate,
      durationMinutes: activityLogsTable.durationMinutes, hoursStatus: activityLogsTable.hoursStatus,
      participantCount: sql<number>`(SELECT count(*)::int FROM activity_log_participants p WHERE p.activity_log_id = ${activityLogsTable.id})`,
      volunteerCount: activityLogsTable.volunteerCount, contractorMinutes: activityLogsTable.contractorMinutes,
      contractorHoursUnknown: activityLogsTable.contractorHoursUnknown, location: namedLocationsTable.name,
      notes: activityLogsTable.notes, recordedBy: usersTable.name, createdAt: activityLogsTable.createdAt,
      archivedAt: activityLogsTable.deletedAt,
    }).from(activityLogsTable)
      .innerJoin(activityTypesTable, eq(activityLogsTable.activityTypeId, activityTypesTable.id))
      .leftJoin(namedLocationsTable, eq(activityLogsTable.namedLocationId, namedLocationsTable.id))
      .leftJoin(usersTable, eq(activityLogsTable.recordedByUserId, usersTable.id))
      .where(eq(activityLogsTable.propertyId, propertyId)).orderBy(asc(activityLogsTable.id)),
    db.select({
      activityLogId: activityLogParticipantsTable.activityLogId, participant: usersTable.name, role: usersTable.role,
      activityDate: activityLogsTable.activityDate, durationMinutes: activityLogsTable.durationMinutes,
    }).from(activityLogParticipantsTable)
      .innerJoin(activityLogsTable, eq(activityLogParticipantsTable.activityLogId, activityLogsTable.id))
      .innerJoin(usersTable, eq(activityLogParticipantsTable.userId, usersTable.id))
      .where(eq(activityLogsTable.propertyId, propertyId)).orderBy(asc(activityLogParticipantsTable.activityLogId)),
    db.select({ id: namedLocationsTable.id, name: namedLocationsTable.name, description: namedLocationsTable.description,
      active: namedLocationsTable.active, createdAt: namedLocationsTable.createdAt })
      .from(namedLocationsTable).where(eq(namedLocationsTable.propertyId, propertyId)).orderBy(asc(namedLocationsTable.name)),
    db.select({ id: categoriesTable.id, name: categoriesTable.name, active: categoriesTable.active })
      .from(categoriesTable).where(eq(categoriesTable.propertyId, propertyId)).orderBy(asc(categoriesTable.name)),
    db.select({ id: activityTypesTable.id, name: activityTypesTable.name, category: activityTypesTable.category, active: activityTypesTable.active })
      .from(activityTypesTable).where(eq(activityTypesTable.propertyId, propertyId)).orderBy(asc(activityTypesTable.name)),
    db.select({ id: usersTable.id, name: usersTable.name, role: usersTable.role, active: usersTable.active })
      .from(usersTable).where(eq(usersTable.propertyId, propertyId)).orderBy(asc(usersTable.name)),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Blickling Fieldbook";
  workbook.created = new Date();

  const toTaskRow = (row: (typeof allTasks)[number]) => ({ ...row, archived: row.archivedAt ? "Yes" : "No" });
  addSheet(workbook, "Open Tasks", taskColumns, openTasks.map(toTaskRow));
  addSheet(workbook, "All Tasks", taskColumns, allTasks.map(toTaskRow));

  addSheet(workbook, "Observations", [
    { header: "Observation ID", key: "id", width: 13 },
    { header: "Reference", key: "reference", width: 14 },
    { header: "Title", key: "title", width: 40, user: true },
    { header: "Description", key: "description", width: 50, user: true },
    { header: "Category", key: "category", width: 20 },
    { header: "Location", key: "location", width: 22 },
    { header: "Priority", key: "priority", width: 10 },
    { header: "Status", key: "status", width: 13 },
    { header: "Safety Issue", key: "safetyIssue", width: 11 },
    { header: "Public Access Affected", key: "publicAccessAffected", width: 19 },
    { header: "Latitude", key: "latitude", width: 11 },
    { header: "Longitude", key: "longitude", width: 11 },
    { header: "Reported By", key: "reporter", width: 20 },
    { header: "Observed At (field)", key: "observedAt", width: 18, date: true },
    { header: "Device Created At", key: "deviceCreatedAt", width: 18, date: true },
    { header: "Synced At", key: "syncedAt", width: 18, date: true },
    { header: "Created At (server)", key: "createdAt", width: 18, date: true },
    { header: "Updated At", key: "updatedAt", width: 18, date: true },
    { header: "Resolved At", key: "resolvedAt", width: 18, date: true },
    { header: "Archived", key: "archived", width: 10 },
    { header: "Archived At", key: "archivedAt", width: 18, date: true },
  ], observations.map((row) => ({ ...row, archived: row.archivedAt ? "Yes" : "No" })));

  addSheet(workbook, "Activities", [
    { header: "Activity ID", key: "id", width: 10 },
    { header: "Activity Type", key: "activityType", width: 26 },
    { header: "Activity Date", key: "activityDate", width: 14, date: true },
    { header: "Elapsed Hours", key: "elapsedHours", width: 13 },
    { header: "Hours Status", key: "hoursStatus", width: 16 },
    { header: "Named Participants", key: "participantCount", width: 16 },
    { header: "Staff Person-Hours", key: "staffPersonHours", width: 16 },
    { header: "Volunteer Count", key: "volunteerCount", width: 14 },
    { header: "Volunteer Person-Hours", key: "volunteerPersonHours", width: 19 },
    { header: "Contractor Hours", key: "contractorHours", width: 15 },
    { header: "Contractor Hours Unknown", key: "contractorHoursUnknown", width: 21 },
    { header: "Location", key: "location", width: 22 },
    { header: "Notes", key: "notes", width: 40, user: true },
    { header: "Recorded By", key: "recordedBy", width: 20 },
    { header: "Created At (server)", key: "createdAt", width: 18, date: true },
    { header: "Archived", key: "archived", width: 10 },
    { header: "Archived At", key: "archivedAt", width: 18, date: true },
  ], activities.map((row) => {
    const elapsedHours = row.durationMinutes / 60;
    return { ...row,
      elapsedHours: Math.round(elapsedHours * 100) / 100,
      staffPersonHours: Math.round(elapsedHours * Number(row.participantCount ?? 0) * 100) / 100,
      volunteerPersonHours: row.volunteerCount ? Math.round(elapsedHours * row.volunteerCount * 100) / 100 : null,
      contractorHours: row.contractorMinutes !== null ? Math.round((row.contractorMinutes / 60) * 100) / 100 : null,
      contractorHoursUnknown: row.contractorHoursUnknown ? "Yes" : "No",
      archived: row.archivedAt ? "Yes" : "No" };
  }));

  addSheet(workbook, "Activity Participants", [
    { header: "Activity ID", key: "activityLogId", width: 10 },
    { header: "Participant", key: "participant", width: 24 },
    { header: "Role", key: "role", width: 14 },
    { header: "Activity Date", key: "activityDate", width: 14, date: true },
    { header: "Person-Hours", key: "personHours", width: 13 },
  ], participants.map((row) => ({ ...row, personHours: Math.round((row.durationMinutes / 60) * 100) / 100 })));

  addSheet(workbook, "Locations", [
    { header: "Location ID", key: "id", width: 10 },
    { header: "Name", key: "name", width: 28, user: true },
    { header: "Description", key: "description", width: 44, user: true },
    { header: "Active", key: "active", width: 9 },
    { header: "Created At", key: "createdAt", width: 18, date: true },
  ], locations.map((row) => ({ ...row, active: row.active ? "Yes" : "No" })));

  addSheet(workbook, "Lookup Values", [
    { header: "Lookup", key: "lookup", width: 18 },
    { header: "ID", key: "id", width: 8 },
    { header: "Value", key: "value", width: 30, user: true },
    { header: "Detail", key: "detail", width: 24, user: true },
    { header: "Active", key: "active", width: 9 },
  ], [
    ...categories.map((row) => ({ lookup: "Category", id: row.id, value: row.name, detail: null as string | null, active: row.active ? "Yes" : "No" })),
    ...activityTypes.map((row) => ({ lookup: "Activity Type", id: row.id, value: row.name, detail: row.category, active: row.active ? "Yes" : "No" })),
    ...users.map((row) => ({ lookup: "User", id: row.id, value: row.name, detail: row.role, active: row.active ? "Yes" : "No" })),
    ...["low", "normal", "high", "urgent"].map((value, index) => ({ lookup: "Priority", id: index + 1, value, detail: null as string | null, active: "Yes" })),
    ...["draft", "submitted", "under_review", "action_required", "monitoring", "resolved", "closed", "cancelled"].map((value, index) => ({ lookup: "Observation Status", id: index + 1, value, detail: null as string | null, active: "Yes" })),
    ...["not_started", "planned", "in_progress", "waiting", "completed", "cancelled"].map((value, index) => ({ lookup: "Task Status", id: index + 1, value, detail: null as string | null, active: "Yes" })),
    ...["elapsed_only", "complete", "estimate"].map((value, index) => ({ lookup: "Hours Status", id: index + 1, value, detail: null as string | null, active: "Yes" })),
  ]);

  addSheet(workbook, "Data Dictionary", [
    { header: "Sheet", key: "sheet", width: 20 },
    { header: "Column", key: "column", width: 26 },
    { header: "Meaning", key: "meaning", width: 90 },
  ], [
    { sheet: "Open Tasks / All Tasks", column: "Task ID / Reference", meaning: "Stable database ID and human reference for the task. References never change." },
    { sheet: "Open Tasks / All Tasks", column: "Status", meaning: "pending, in_progress, completed or cancelled. Open Tasks excludes completed and cancelled." },
    { sheet: "Open Tasks / All Tasks", column: "Due Date", meaning: "Manager-set target date (Excel date value)." },
    { sheet: "Open Tasks / All Tasks", column: "Device Created At", meaning: "When the record was created on the field device (may pre-date server receipt when captured offline)." },
    { sheet: "Open Tasks / All Tasks", column: "Created At (server)", meaning: "When the server first received the record." },
    { sheet: "Open Tasks / All Tasks", column: "Archived / Archived At", meaning: "Soft-archive state. Archived rows are recoverable and appear only in All Tasks." },
    { sheet: "Observations", column: "Observed At (field)", meaning: "When the condition was actually observed in the field. All period reporting uses this timestamp." },
    { sheet: "Observations", column: "Safety Issue / Public Access Affected", meaning: "Field-flagged risk indicators (TRUE/FALSE)." },
    { sheet: "Activities", column: "Elapsed Hours", meaning: "Wall-clock duration of the activity session in hours (duration ÷ 60)." },
    { sheet: "Activities", column: "Hours Status", meaning: "elapsed_only: only elapsed time known; complete: labour numbers verified; estimate: labour numbers estimated." },
    { sheet: "Activities", column: "Staff Person-Hours", meaning: "Elapsed hours × named staff participants. See Activity Participants for the per-person rows." },
    { sheet: "Activities", column: "Volunteer Person-Hours", meaning: "Elapsed hours × volunteer count, when a volunteer count was recorded." },
    { sheet: "Activities", column: "Contractor Hours / Contractor Hours Unknown", meaning: "Contractor labour in hours when known; Unknown = Yes means contractors attended but their hours were not captured." },
    { sheet: "Activity Participants", column: "Person-Hours", meaning: "Elapsed hours attributed to this named participant for this activity." },
    { sheet: "Lookup Values", column: "Lookup / Value", meaning: "Canonical reference values (categories, activity types, users, statuses, priorities) with their stable IDs." },
    { sheet: "All sheets", column: "Text cells", meaning: "User-authored text beginning with = + - @ is prefixed with an apostrophe to neutralise spreadsheet formula injection." },
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="blickling-fieldbook-export-${stamp}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
