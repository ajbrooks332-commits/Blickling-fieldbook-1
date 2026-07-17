import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { observationsTable } from "./observations";
import { actionsTable } from "./actions";
import { propertiesTable } from "./properties";

export const auditEventsTable = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => propertiesTable.id),
  observationId: integer("observation_id").references(() => observationsTable.id),
  actionId: integer("action_id").references(() => actionsTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  eventType: text("event_type").notNull(),
  fieldName: text("field_name"),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditEventSchema = createInsertSchema(auditEventsTable).omit({ id: true, createdAt: true });
export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
