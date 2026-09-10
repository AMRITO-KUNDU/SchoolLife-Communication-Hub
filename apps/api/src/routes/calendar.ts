import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/calendar/events", requireAuth, async (_req, res) => {
  res.status(503).json({
    error: "Google Calendar is not configured",
    code: "GOOGLE_NOT_CONNECTED",
    message:
      "Connect Google OAuth to enable Calendar sync. Replit Connectors have been removed.",
  });
});

export default router;