import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

export type UserRole = "administrator" | "manager" | "team_member";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.active, true)))
    .limit(1);

  if (!user || !user.propertyId || user.sessionVersion !== req.session.sessionVersion) {
    req.session.destroy(() => undefined);
    res.clearCookie("blickling.sid", { path: "/" });
    res.status(401).json({ error: "Session is no longer valid" });
    return;
  }

  req.authUser = user;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function requirePasswordChanged(req: Request, res: Response, next: NextFunction): void {
  if (req.authUser?.mustChangePassword) {
    res.status(403).json({ error: "Change the temporary password before using Fieldbook" });
    return;
  }
  next();
}

export function isManager(user: User): boolean {
  return user.role === "administrator" || user.role === "manager";
}

export function canUpdateAction(user: User, assignedToUserId: number | null): boolean {
  return isManager(user) || assignedToUserId === user.id;
}
