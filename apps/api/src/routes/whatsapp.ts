import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const comingSoon = {
  status: "coming_soon" as const,
  message: "WhatsApp school groups are planned for a future release.",
};

router.get("/whatsapp/status", requireAuth, (_req, res) => {
  res.json(comingSoon);
});

router.post("/whatsapp/connect", requireAuth, (_req, res) => {
  res.status(501).json(comingSoon);
});

router.post("/whatsapp/disconnect", requireAuth, (_req, res) => {
  res.status(501).json(comingSoon);
});

router.get("/whatsapp/groups", requireAuth, (_req, res) => {
  res.json({ groups: [], ...comingSoon });
});

router.patch("/whatsapp/groups/:jid", requireAuth, (_req, res) => {
  res.status(501).json(comingSoon);
});

export default router;