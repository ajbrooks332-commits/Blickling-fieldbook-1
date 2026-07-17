import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { observationsTable } from "./observations";
import { actionsTable } from "./actions";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  observationId: integer("observation_id").references(() => observationsTable.id),
  actionId: integer("action_id").references(() => actionsTable.id),
  body: text("body").notNull(),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNoteSchema = createInsertSchema(notesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notesTable.$inferSelect;
