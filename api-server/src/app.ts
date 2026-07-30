import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Remove the X-Powered-By header to avoid advertising the framework
app.disable("x-powered-by");

// ── Security headers ───────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  // Restrictive CSP for an API — no document resources needed
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'",
  );
  next();
});

// ── Structured request logging ─────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0], // strip query string from logs
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS — environment-driven allowlist ───────────────────────────
// Set ALLOWED_ORIGINS to a comma-separated list of permitted origins.
// If unset, all cross-origin browser requests are rejected.
// Server-to-server requests (no Origin header) are always allowed.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // No Origin header → same-origin or server-to-server request
    if (!origin) {
      callback(null, true);
      return;
    }
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      // Do not reflect the origin; return a generic refusal
      callback(new Error("CORS policy: origin not permitted"));
    }
  },
  credentials: false,
};

app.use(cors(corsOptions));

// ── Body parsers ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ─────────────────────────────────────────────────────────
app.use("/api", router);

// ── Generic error handler ──────────────────────────────────────────
// Log the full error server-side; return only a generic message to clients.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
