import { pgTable, serial, text, boolean, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";

export const namedLocationsTable = pgTable("named_locations", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => propertiesTable.id),
  name: text("name").notNull(),
  description: text("description"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNamedLocationSchema = createInsertSchema(namedLocationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNamedLocation = z.infer<typeof insertNamedLocationSchema>;
export type NamedLocation = typeof namedLocationsTable.$inferSelect;
