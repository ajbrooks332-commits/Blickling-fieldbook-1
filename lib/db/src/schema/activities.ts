import { pgTable, serial, text, boolean, integer, timestamp, date, primaryKey } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties";
import { usersTable } from "./users";
import { namedLocationsTable } from "./named-locations";

export const activityTypesTable = pgTable("activity_types", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => propertiesTable.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id),
  activityTypeId: integer("activity_type_id").notNull().references(() => activityTypesTable.id),
  namedLocationId: integer("named_location_id").references(() => namedLocationsTable.id),
  activityDate: date("activity_date").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  notes: text("notes"),
  recordedByUserId: integer("recorded_by_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  deletedByUserId: integer("deleted_by_user_id").references(() => usersTable.id),
});

export const activityLogParticipantsTable = pgTable("activity_log_participants", {
  activityLogId: integer("activity_log_id").notNull().references(() => activityLogsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id),
}, (table) => [primaryKey({ columns: [table.activityLogId, table.userId] })]);

export type ActivityType = typeof activityTypesTable.$inferSelect;
export type ActivityLog = typeof activityLogsTable.$inferSelect;
