import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { requireAuth } from "../middlewares/requireAuth";

type CalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  location?: string;
};

type CalendarEventsResponse = {
  nextPageToken?: string;
  items?: CalendarEvent[];
};

const router: IRouter = Router();

router.get("/calendar/events", requireAuth, async (req, res) => {
  const now = new Date();
  const defaultEnd = new Date(now);
  defaultEnd.setDate(defaultEnd.getDate() + 90);
  const timeMin =
    typeof req.query.timeMin === "string"
      ? req.query.timeMin
      : now.toISOString();
  const timeMax =
    typeof req.query.timeMax === "string"
      ? req.query.timeMax
      : defaultEnd.toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    showDeleted: "false",
    maxResults: "250",
  });

  try {
    const connectors = new ReplitConnectors();
    const response = await connectors.proxy(
      "google-calendar",
      `/calendar/v3/calendars/primary/events?${params.toString()}`,
      { method: "GET" },
    );

    if (!response.ok) {
      res.status(response.status).json({
        error: "Google Calendar could not be read",
        providerStatus: response.status,
      });
      return;
    }

    const data = (await response.json()) as CalendarEventsResponse;
    const items = (data.items ?? []).filter(
      (event) => event.status !== "cancelled",
    );
    res.json({ items, syncedAt: new Date().toISOString() });
  } catch (error) {
    req.log.error({ err: error }, "Google Calendar sync failed");
    res.status(502).json({
      error: "Google Calendar is unavailable right now",
    });
  }
});

export default router;