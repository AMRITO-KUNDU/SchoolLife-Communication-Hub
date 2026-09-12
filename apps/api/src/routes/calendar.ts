import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { getAuthenticatedClient } from "../lib/googleOAuth";

const router: IRouter = Router();

router.get("/calendar/events", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  const oauth2Client = await getAuthenticatedClient(userId);

  if (!oauth2Client) {
    res.status(503).json({
      error: "Google Calendar is not connected",
      code: "GOOGLE_NOT_CONNECTED",
      message: "Connect your Google account to sync Calendar events.",
    });
    return;
  }

  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const now = new Date();
    const timeMin = now.toISOString();

    const eventsRes = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      maxResults: 50,
      singleEvents: true,
      orderBy: "startTime",
    });

    const items = (eventsRes.data.items || []).map((event) => ({
      id: event.id || undefined,
      summary: event.summary || "Untitled Event",
      start: {
        dateTime: event.start?.dateTime || undefined,
        date: event.start?.date || undefined,
      },
    }));

    res.json({ items });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch Google Calendar events");
    res.status(500).json({ error: "Failed to fetch Google Calendar events" });
  }
});

export default router;