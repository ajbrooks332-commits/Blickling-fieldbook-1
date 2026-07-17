import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function generateObservationRef(propertyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.execute(
    sql`SELECT COUNT(*) as count FROM observations WHERE property_id = ${propertyId} AND EXTRACT(YEAR FROM created_at) = ${year}`
  );
  const count = Number((result.rows[0] as any).count) + 1;
  return `BLK-${year}-${String(count).padStart(5, "0")}`;
}

export async function generateActionRef(propertyId: number): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.execute(
    sql`SELECT COUNT(*) as count FROM actions WHERE property_id = ${propertyId} AND EXTRACT(YEAR FROM created_at) = ${year}`
  );
  const count = Number((result.rows[0] as any).count) + 1;
  return `ACT-${year}-${String(count).padStart(5, "0")}`;
}
