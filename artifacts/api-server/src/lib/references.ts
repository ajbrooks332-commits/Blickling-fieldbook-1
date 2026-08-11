import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function nextReference(propertyId: number, kind: "observation" | "action"): Promise<string> {
  const year = new Date().getUTCFullYear();
  const result = await db.execute(sql`
    INSERT INTO reference_counters (property_id, year, kind, value)
    VALUES (${propertyId}, ${year}, ${kind}, 1)
    ON CONFLICT (property_id, year, kind)
    DO UPDATE SET value = reference_counters.value + 1
    RETURNING value
  `);
  const value = Number(result.rows[0]?.value);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("Unable to allocate reference number");
  const prefix = kind === "observation" ? "BLK" : "ACT";
  return `${prefix}-${year}-${String(value).padStart(5, "0")}`;
}

export const generateObservationRef = (propertyId: number) => nextReference(propertyId, "observation");
export const generateActionRef = (propertyId: number) => nextReference(propertyId, "action");
