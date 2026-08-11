import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";
import { errorHandler, notFound } from "./middlewares/error";
import { noStore, requireSameOrigin } from "./middlewares/security";

const PgSession = connectPgSimple(session);
const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(pinoHttp({
  logger,
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url?.split("?")[0] }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org"],
      connectSrc: ["'self'", "https://storage.googleapis.com"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-origin" },
  referrerPolicy: { policy: "no-referrer" },
}));

if (process.env.APP_ORIGIN) {
  app.use(cors({ origin: process.env.APP_ORIGIN, credentials: true }));
}

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "256kb" }));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters");
}

app.use(session({
  name: "blickling.sid",
  store: new PgSession({ pool, tableName: "session", createTableIfMissing: true }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 12 * 60 * 60 * 1000,
    sameSite: "lax",
    path: "/",
  },
}));

app.use("/api", noStore, requireSameOrigin, router);
app.use("/api", notFound);

const builtFrontendDirectory = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../blickling-fieldbook/dist/public",
    );

app.use(express.static(builtFrontendDirectory, {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith("service-worker.js") || filePath.endsWith("manifest.webmanifest")) {
      res.setHeader("Cache-Control", "no-cache");
    } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "public, max-age=3600");
    }
  },
}));

app.get(/^(?!\/api(?:\/|$)).*/, (_req, res, next) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(builtFrontendDirectory, "index.html"), (error) => {
    if (error) next(error);
  });
});

app.use(errorHandler);

export default app;
