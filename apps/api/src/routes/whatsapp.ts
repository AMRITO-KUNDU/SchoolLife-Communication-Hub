import { Router, type IRouter } from "express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import {
  getWhatsappGroups,
  getWhatsappStatus,
  setWhatsappGroupEnabled,
  startWhatsappSession,
  stopWhatsappSession,
} from "../whatsapp/sessionManager";

const router: IRouter = Router();

router.get("/whatsapp/status", requireAuth, async (req, res) => {
  res.json(await getWhatsappStatus((req as AuthenticatedRequest).userId));
});

router.post("/whatsapp/connect", requireAuth, async (req, res) => {
  const mode = req.body?.mode === "code" ? "code" : "qr";
  const phoneNumber = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber : undefined;
  try {
    const status = await startWhatsappSession((req as AuthenticatedRequest).userId, mode, phoneNumber);
    res.status(202).json(status);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "WhatsApp connection could not start" });
  }
});

router.post("/whatsapp/disconnect", requireAuth, async (req, res) => {
  const status = await stopWhatsappSession((req as AuthenticatedRequest).userId);
  res.json(status);
});

router.get("/whatsapp/groups", requireAuth, async (req, res) => {
  const groups = await getWhatsappGroups((req as AuthenticatedRequest).userId);
  res.json({ groups });
});

router.patch("/whatsapp/groups/:jid", requireAuth, async (req, res) => {
  const rawJid = req.params.jid;
  const jid = decodeURIComponent(Array.isArray(rawJid) ? rawJid[0] : rawJid);
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled must be a boolean" });
    return;
  }
  const group = await setWhatsappGroupEnabled(
    (req as AuthenticatedRequest).userId,
    jid,
    enabled,
  );
  if (!group) {
    res.status(404).json({ error: "WhatsApp group not found" });
    return;
  }
  res.json(group);
});

export default router;