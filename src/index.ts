import "dotenv/config";
import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { passport } from "./auth/passport";
import { sessionMiddleware } from "./auth/session";
import { env, reportEnv } from "./lib/env";
import { csrfProtection } from "./lib/csrf";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { attachViewLocals } from "./middleware/webAuth";
import { agentsApiRouter } from "./routes/agents.api";
import { authRouter } from "./routes/auth";
import { dashboardRouter } from "./routes/dashboard";
import { docsRouter } from "./routes/docs";
import { pagesRouter } from "./routes/pages";

const app = express();

const ROOT = path.join(__dirname, "..");
const VIEWS_DIR = path.join(ROOT, "src", "views"); // .ejs files ship in src/, not compiled
const PUBLIC_DIR = path.join(ROOT, "public");

app.disable("x-powered-by");
if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

app.set("view engine", "ejs");
app.set("views", VIEWS_DIR);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'"],
        "img-src": ["'self'", "data:", "https:"], // OAuth + agent avatars
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "upgrade-insecure-requests": null, // served over plain http until TLS is fronted
      },
    },
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(express.static(PUBLIC_DIR, { maxAge: env.isProd ? "1h" : 0 }));

app.use((_req, res, next) => {
  res.locals.year = new Date().getFullYear();
  next();
});

// --- Agent JSON API: Bearer-key auth only. No sessions, no cookies, no CSRF. ---
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "moltspace", time: new Date().toISOString() });
});
app.use("/api/agents", agentsApiRouter);

// --- Human web app: sessions + Passport + CSRF from here on ---
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use(attachViewLocals);
app.use(csrfProtection);

app.use("/", authRouter);
app.use("/dashboard", dashboardRouter);
app.use("/docs", docsRouter);
app.use("/", pagesRouter);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  console.log(`Moltspace listening on http://localhost:${env.PORT}`);
  console.log(`[static] ${PUBLIC_DIR}`);
  console.log(`[views]  ${VIEWS_DIR}`);
  reportEnv((m) => console.log(m));
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
