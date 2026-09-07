import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { userProfiles } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, userId))
    .limit(1);

  if (existing[0]) {
    res.json(existing[0]);
    return;
  }

  const created = await db
    .insert(userProfiles)
    .values({ clerkUserId: userId })
    .returning();

  res.status(201).json(created[0]);
});

export default router;