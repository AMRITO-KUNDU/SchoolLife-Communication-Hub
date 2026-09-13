import { Router, type IRouter } from "express";
import { google } from "googleapis";
import { db } from "@workspace/db";
import { schoolChildren, schoolEvents, syncStates } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { getAuthenticatedClient } from "../lib/googleOAuth";

const router: IRouter = Router();

async function fetchCalendarItems(userId: string) {
  const oauth2Client = await getAuthenticatedClient(userId);
  if (!oauth2Client) return null;
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  const eventsRes = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 50,
    singleEvents: true,
    orderBy: "startTime",
  });
  return (eventsRes.data.items || []).map((event) => ({
    id: event.id || undefined,
    summary: event.summary || "Untitled Event",
    start: { dateTime: event.start?.dateTime || undefined, date: event.start?.date || undefined },
    end: { dateTime: event.end?.dateTime || undefined, date: event.end?.date || undefined },
  }));
}

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
    const items = await fetchCalendarItems(userId) || [];

    res.json({ items });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to fetch Google Calendar events");
    res.status(500).json({ error: "Failed to fetch Google Calendar events" });
  }
});

router.get("/calendar/audit", requireAuth, async (req, res) => {
  const userId = (req as AuthenticatedRequest).userId;
  try {
    const items = await fetchCalendarItems(userId);
    if (!items) {
      res.status(503).json({ error: "Google Calendar is not connected", code: "GOOGLE_NOT_CONNECTED" });
      return;
    }
    const [child] = await db.select({ id: schoolChildren.id }).from(schoolChildren).where(eq(schoolChildren.clerkUserId, userId)).limit(1);
    const childId = child ? String(child.id) : "school";
    const seen = new Set<string>();
    const checkpoints = items.map((event) => {
      const rawStart = event.start.dateTime || event.start.date;
      const checks: string[] = [];
      if (!event.summary || event.summary === "Untitled Event") checks.push("Add an event title");
      if (!rawStart) checks.push("Add a date or time");
      if (event.id && seen.has(event.id)) checks.push("Review duplicate event");
      if (event.id) seen.add(event.id);
      return { eventId: event.id, title: event.summary, status: checks.length ? "needs_review" : "ready", checks };
    });
    await Promise.all(items.filter((event) => event.id).map(async (event) => {
      const rawStart = event.start.dateTime || event.start.date || new Date().toISOString();
      const date = new Date(rawStart);
      return db.insert(schoolEvents).values({
        clerkUserId: userId,
        externalId: event.id!,
        title: event.summary,
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        time: event.start.date && !event.start.dateTime ? "All day" : date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
        childId,
        kind: "Google Calendar",
        source: "Google Calendar",
      }).onConflictDoUpdate({ target: [schoolEvents.clerkUserId, schoolEvents.externalId], set: { title: event.summary, updatedAt: new Date() } });
    }));
    await db.insert(syncStates).values({ clerkUserId: userId, provider: "calendar_audit", cursor: JSON.stringify({ checkpoints }), lastSyncedAt: new Date() }).onConflictDoUpdate({ target: [syncStates.clerkUserId, syncStates.provider], set: { cursor: JSON.stringify({ checkpoints }), lastSyncedAt: new Date(), updatedAt: new Date() } });
    res.json({ items, checkpoints, auditedAt: new Date().toISOString() });
  } catch (error) {
    req.log?.error({ err: error }, "Failed to audit Google Calendar");
    res.status(500).json({ error: "Failed to audit Google Calendar" });
  }
});

export default router;
