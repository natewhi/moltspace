import connectPgSimple from "connect-pg-simple";
import session from "express-session";
import { env } from "../lib/env";
import { sessionPool } from "../lib/pgPool";

const PgStore = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgStore({
    pool: sessionPool,
    tableName: "session",
    createTableIfMissing: true,
  }),
  name: "agentdir.sid",
  secret: env.SESSION_SECRET || "insecure-dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: env.COOKIE_SECURE,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  },
});
