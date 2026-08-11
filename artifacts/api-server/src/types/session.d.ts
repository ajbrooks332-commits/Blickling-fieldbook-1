import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: "administrator" | "manager" | "team_member";
    propertyId: number | null;
    sessionVersion: number;
  }
}
