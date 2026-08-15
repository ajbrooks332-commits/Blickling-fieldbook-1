import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { actionsTable } from "./actions";
import { usersTable } from "./users";

export const actionImagesTable = pgTable("action_images", {
  id: serial("id").primaryKey(),
  actionId: integer("action_id").notNull().references(() => actionsTable.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  caption: text("caption"),
  // Per-photo idempotency key for offline queue retries.
  photoUuid: text("photo_uuid"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Soft delete: bytes are retained; nothing is permanently purged here.
  deletedAt: timestamp("deleted_at"),
  deletedByUserId: integer("deleted_by_user_id").references(() => usersTable.id),
});

export type ActionImage = typeof actionImagesTable.$inferSelect;
