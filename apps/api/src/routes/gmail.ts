import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { getAuthenticatedClient } from "../lib/googleOAuth";

const router: IRouter = Router();

function classifyEmail(subject: string, snippet: string): { category: string; needsAction: boolean } {
  const combined = (subject + " " + snippet).toLowerCase();

  if (combined.includes("homework") || combined.includes("assignment") || combined.includes("due")) {
    return { category: "Homework", needsAction: true };
  }
  if (combined.includes("fee") || combined.includes("payment") || combined.includes("pay") || combined.includes("invoice")) {
    return { category: "Payments", needsAction: true };
  }
  if (combined.includes("event") || combined.includes("trip") || combined.includes("meeting") || combined.includes("sports day")) {
    return { category: "Events", needsAction: false };
  }
  if (combined.includes("notice") || combined.includes("announcement") || combined.includes("newsletter") || combined.includes("dear parent")) {
    return { category: "Announcements", needsAction: false };
  }

  return { category: "Other", needsAction: false };
}

router.get("/gmail/messages", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const oauth2Client = await getAuthenticatedClient(userId);

  if (!oauth2Client) {
    res.status(503).json({
      error: "Gmail is not connected",
      code: "GOOGLE_NOT_CONNECTED",
      message: "Connect your Google account to sync Gmail messages.",
    });
    return;
  }

  try {
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const pageSize = Math.min(Number(req.query.pageSize) || 20, 50);

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: pageSize,
      q: "category:primary",
    });

    const messages = listRes.data.messages || [];
    if (messages.length === 0) {
      res.json({ items: [] });
      return;
    }

    const items = await Promise.all(
      messages.map(async (msg) => {
        if (!msg.id) return null;
        try {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id,
            format: "full",
          });

          const headers = detail.data.payload?.headers || [];
          const getHeader = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

          const sender = getHeader("From") || "School Sender";
          const subject = getHeader("Subject") || "No subject";
          const dateStr = getHeader("Date") || new Date().toISOString();
          const snippet = detail.data.snippet || subject;

          const { category, needsAction } = classifyEmail(subject, snippet);

          return {
            id: msg.id,
            sender,
            subject,
            snippet,
            date: dateStr,
            category,
            needsAction,
          };
        } catch {
          return null;
        }
      }),
    );

    const validItems = items.filter(Boolean);
    res.json({ items: validItems });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch Gmail messages");
    res.status(500).json({ error: "Failed to fetch Gmail messages" });
  }
});

export default router;