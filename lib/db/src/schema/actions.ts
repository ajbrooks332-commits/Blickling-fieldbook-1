import { pgTable, serial, text, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";
import { usersTable } from "./users";
import { observationsTable } from "./observations";
import { observationPriorityEnum } from "./observations";

export const actionStatusEnum = pgEnum("action_status", [
  "not_started", "planned", "in_progress", "waiting", "completed", "cancelled"
]);

export const actionsTable = pgTable("actions", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => propertiesTable.id),
  observationId: integer("observation_id").references(() => observationsTable.id),
  referenceNumber: text("reference_number").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  assignedToUserId: integer("assigned_to_user_id").references(() => usersTable.id),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  priority: observationPriorityEnum("priority").notNull().default("normal"),
  status: actionStatusEnum("status").notNull().default("not_started"),
  dueDate: timestamp("due_date"),
  estimatedMinutes: integer("estimated_minutes"),
  equipmentRequired: boolean("equipment_required").notNull().default(false),
  contractorRequired: boolean("contractor_required").notNull().default(false),
  waitingReason: text("waiting_reason"),
  cancellationReason: text("cancellation_reason"),
  completedAt: timestamp("completed_at"),
  completionNote: text("completion_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertActionSchema = createInsertSchema(actionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAction = z.infer<typeof insertActionSchema>;
export type Action = typeof actionsTable.$inferSelect;
