import { pgTable, integer, text, primaryKey } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties";

export const referenceCountersTable = pgTable("reference_counters", {
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  kind: text("kind").notNull(),
  value: integer("value").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.propertyId, table.year, table.kind] })]);
