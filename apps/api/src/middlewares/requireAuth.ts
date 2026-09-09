import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export type AuthenticatedRequest = Request & { userId: string };

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const auth = getAuth(req) as unknown as {
    userId?: string;
    sessionClaims?: { userId?: string };
  };
  const userId =
    auth?.userId ??
    (typeof auth?.sessionClaims?.userId === "string"
      ? auth.sessionClaims.userId
      : undefined);

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  (req as AuthenticatedRequest).userId = userId;
  next();
}