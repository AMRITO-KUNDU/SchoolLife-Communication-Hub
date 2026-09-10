import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/gmail/messages", requireAuth, async (_req, res) => {
  res.status(503).json({
    error: "Gmail is not configured",
    code: "GOOGLE_NOT_CONNECTED",
    message:
      "Connect Google OAuth to enable Gmail sync. Replit Connectors have been removed.",
  });
});

export default router;