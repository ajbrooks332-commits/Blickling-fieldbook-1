import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: "Route not found", path: req.path });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err: error, requestId: req.id, method: req.method, path: req.path }, "Unhandled request error");
  if (res.headersSent) return;
  res.status(500).json({ error: "An unexpected error occurred", requestId: req.id });
}
