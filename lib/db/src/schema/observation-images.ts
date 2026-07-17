import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { observationsTable } from "./observations";
import { usersTable } from "./users";

export const imageTypeEnum = pgEnum("image_type", ["observation", "progress", "completion"]);

export const observationImagesTable = pgTable("observation_images", {
  id: serial("id").primaryKey(),
  observationId: integer("observation_id").notNull().references(() => observationsTable.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  caption: text("caption"),
  imageType: imageTypeEnum("image_type").notNull().default("observation"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ObservationImage = typeof observationImagesTable.$inferSelect;
