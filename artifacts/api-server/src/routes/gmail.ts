import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { requireAuth } from "../middlewares/requireAuth";

type GmailMessage = {
  id: string;
  threadId: string;
  date?: string;
  sender?: string;
  subject?: string;
  snippet?: string;
  labelIds?: string[];
};

type GmailThread = {
  id: string;
  messages?: GmailMessage[];
  messagesTruncated?: boolean;
  error?: string;
};

type GmailSearchResponse = {
  threads?: GmailThread[];
  nextPageToken?: string;
  resultCountEstimate?: number;
};

type InboxItem = {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  category: string;
  needsAction: boolean;
  labelIds: string[];
};

function classify(subject: string, snippet: string) {
  const text = `${subject} ${snippet}`.toLowerCase();
  if (/fee|payment|invoice|₹|rs\.?\s?\d/.test(text)) return "Payments";
  if (/meeting|event|schedule|calendar|trip|practice|test|exam/.test(text)) return "Events";
  if (/homework|worksheet|project|submit|bring|due|permission/.test(text)) return "Homework";
  return "Announcements";
}

const router: IRouter = Router();

router.get("/gmail/messages", requireAuth, async (req, res) => {
  const query =
    typeof req.query.q === "string"
      ? req.query.q
      : "newer_than:30d -category:promotions -category:social -from:me";
  const pageSize =
    typeof req.query.pageSize === "string" &&
    Number.isInteger(Number(req.query.pageSize))
      ? Math.min(Math.max(Number(req.query.pageSize), 1), 50)
      : 30;

  const params = new URLSearchParams({
    q: query,
    pageSize: String(pageSize),
    view: "THREAD_VIEW_MINIMAL",
  });

  try {
    const connectors = new ReplitConnectors();
    const response = await connectors.proxy(
      "google-mail",
      `/gmail/v1/users/me/threads:search?${params.toString()}`,
      { method: "GET" },
    );

    if (!response.ok) {
      res.status(response.status).json({
        error: "Gmail could not be read",
        providerStatus: response.status,
      });
      return;
    }

    const data = (await response.json()) as GmailSearchResponse;
    const items: InboxItem[] = (data.threads ?? [])
      .map((thread) => {
        const latest = [...(thread.messages ?? [])]
          .filter((message) => message.id)
          .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
        if (!latest) return null;
        const sender = latest.sender || "School email";
        const subject = latest.subject || "(No subject)";
        const snippet = latest.snippet || "Open this thread to read the latest message.";
        const category = classify(subject, snippet);
        return {
          id: latest.id,
          threadId: thread.id,
          sender,
          subject,
          snippet,
          date: latest.date || new Date().toISOString(),
          category,
          needsAction: category === "Homework" || category === "Payments",
          labelIds: latest.labelIds ?? [],
        };
      })
      .filter((item): item is InboxItem => item !== null);

    res.json({
      items,
      nextPageToken: data.nextPageToken,
      resultCountEstimate: data.resultCountEstimate,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    req.log.error({ err: error }, "Gmail sync failed");
    res.status(502).json({ error: "Gmail is unavailable right now" });
  }
});

export default router;