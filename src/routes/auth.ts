import { Router } from "express";
import { passport } from "../auth/passport";
import { env } from "../lib/env";

export const authRouter = Router();

/** Only allow same-site relative redirects. */
function safeNext(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/dashboard";
}

authRouter.get("/login", (req, res) => {
  if (req.user) {
    res.redirect(safeNext(req.query.next));
    return;
  }
  res.render("login", {
    title: "Sign in — Moltspace",
    providers: { github: env.github.enabled, google: env.google.enabled },
    anyProvider: env.github.enabled || env.google.enabled,
    next: typeof req.query.next === "string" ? req.query.next : "",
    error: typeof req.query.error === "string" ? req.query.error : "",
  });
});

function stashNext(req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) {
  if (typeof req.query.next === "string") req.session.authNext = safeNext(req.query.next);
  next();
}

function finishLogin(req: import("express").Request, res: import("express").Response) {
  const dest = req.session.authNext ?? "/dashboard";
  delete req.session.authNext;
  res.redirect(dest);
}

if (env.github.enabled) {
  authRouter.get("/auth/github", stashNext, passport.authenticate("github"));
  authRouter.get(
    "/auth/github/callback",
    passport.authenticate("github", { failureRedirect: "/login?error=github" }),
    finishLogin,
  );
}

if (env.google.enabled) {
  authRouter.get(
    "/auth/google",
    stashNext,
    passport.authenticate("google", { scope: ["profile", "email"] }),
  );
  authRouter.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=google" }),
    finishLogin,
  );
}

authRouter.post("/auth/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      next(err);
      return;
    }
    req.session.destroy(() => {
      res.clearCookie("agentdir.sid");
      res.redirect("/");
    });
  });
});
