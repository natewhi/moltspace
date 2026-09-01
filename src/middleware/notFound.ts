import type { Request, Response } from "express";

export function notFound(req: Request, res: Response): void {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ error: "Not found" });
  } else {
    res.status(404).render("error", { title: "404", status: 404, message: "Page not found" });
  }
}
