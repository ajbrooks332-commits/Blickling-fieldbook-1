import type { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function expectedOrigin(req: Request): string {
  return process.env.APP_ORIGIN?.replace(/\/$/, "") ?? `${req.protocol}://${req.get("host")}`;
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");
  const requestedWith = req.get("x-requested-with");
  if (!origin || origin.replace(/\/$/, "") !== expectedOrigin(req) || requestedWith !== "BlicklingFieldbook") {
    res.status(403).json({ error: "Request origin could not be verified" });
    return;
  }
  next();
}

export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store");
  next();
}
