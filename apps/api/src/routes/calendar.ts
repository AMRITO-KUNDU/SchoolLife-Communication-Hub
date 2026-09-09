import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { db } from "@workspace/db";
import { schoolChildren, schoolEvents, schoolSources } from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

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
    const clerkUserId = (req as AuthenticatedRequest).userId;
    const [firstChild] = await db
      .select({ slug: schoolChildren.slug })
      .from(schoolChildren)
      .where(eq(schoolChildren.clerkUserId, clerkUserId))
      .orderBy(asc(schoolChildren.id))
      .limit(1);
    const childId = firstChild?.slug ?? "unassigned";
    await Promise.all(
      items.map(async (event) => {
        const rawStart = event.start?.dateTime ?? event.start?.date;
        const start = rawStart ? new Date(rawStart) : new Date();
        const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
        await db
          .insert(schoolEvents)
          .values({
            clerkUserId,
            externalId: `google:${event.id}`,
            title: event.summary || "Untitled calendar event",
            date: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            time: isAllDay
              ? "All day"
              : start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
            childId,
            kind: "Google Calendar",
            source: "Google Calendar",
          })
          .onConflictDoUpdate({
            target: [schoolEvents.clerkUserId, schoolEvents.externalId],
            set: {
              title: event.summary || "Untitled calendar event",
              updatedAt: new Date(),
            },
          });
      }),
    );
    await db
      .insert(schoolSources)
      .values({
        clerkUserId,
        sourceKey: "calendar",
        name: "Calendar",
        status: "Connected",
        detail: `${items.length} events synced`,
        lastSync: "Synced just now",
      })
      .onConflictDoUpdate({
        target: [schoolSources.clerkUserId, schoolSources.sourceKey],
        set: { status: "Connected", detail: `${items.length} events synced`, lastSync: "Synced just now", updatedAt: new Date() },
      });
    res.json({ items, syncedAt: new Date().toISOString() });
  } catch (error) {
    req.log.error({ err: error }, "Google Calendar sync failed");
    res.status(502).json({
      error: "Google Calendar is unavailable right now",
    });
  }
});

export default router;