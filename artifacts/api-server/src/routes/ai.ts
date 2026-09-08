import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";

type Extraction = {
  summary: string;
  category: "Homework" | "Payments" | "Events" | "Announcements" | "Other";
  needsAction: boolean;
  tasks: Array<{ title: string; dueDate?: string; dueTime?: string; priority: "urgent" | "important" | "normal"; items: string[] }>;
  events: Array<{ title: string; date?: string; time?: string }>;
  childHint?: string;
  confidence: "high" | "medium" | "low";
};

const router: IRouter = Router();

router.post("/ai/extract", requireAuth, async (req, res) => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: "AI extraction is not configured",
      code: "AI_NOT_CONFIGURED",
      message: "Add a GROQ_API_KEY secret to enable SchoolLife extraction.",
    });
    return;
  }

  const prompt = `You are SchoolLife, a family school-planning assistant. Extract only facts present in the message below. Do not invent names, dates, times, amounts, or assignments. Return valid JSON only with this shape:
{
  "summary": "one sentence",
  "category": "Homework|Payments|Events|Announcements|Other",
  "needsAction": true,
  "tasks": [{"title":"...", "dueDate":"...", "dueTime":"...", "priority":"urgent|important|normal", "items":["..."]}],
  "events": [{"title":"...", "date":"...", "time":"..."}],
  "childHint": "name or class if explicitly present",
  "confidence": "high|medium|low"
}
Use empty strings only when a value is not present and empty arrays when there is no task/event. Message:
${text.slice(0, 12000)}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return JSON only. Never fabricate missing details." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      res.status(502).json({ error: "Groq extraction failed", providerStatus: response.status });
      return;
    }
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      res.status(502).json({ error: "Groq returned an empty extraction" });
      return;
    }
    const parsed = JSON.parse(content) as Partial<Extraction>;
    const extraction: Extraction = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "School message reviewed.",
      category: ["Homework", "Payments", "Events", "Announcements", "Other"].includes(parsed.category || "")
        ? parsed.category as Extraction["category"]
        : "Other",
      needsAction: Boolean(parsed.needsAction),
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks.filter((task): task is Extraction["tasks"][number] => Boolean(task && typeof task.title === "string")).map((task) => ({
        title: task.title,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        priority: task.priority === "urgent" || task.priority === "important" ? task.priority : "normal",
        items: Array.isArray(task.items) ? task.items.filter((item): item is string => typeof item === "string") : [],
      })) : [],
      events: Array.isArray(parsed.events) ? parsed.events.filter((event): event is Extraction["events"][number] => Boolean(event && typeof event.title === "string")).map((event) => ({
        title: event.title,
        date: event.date,
        time: event.time,
      })) : [],
      childHint: typeof parsed.childHint === "string" ? parsed.childHint : undefined,
      confidence: parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low",
    };
    res.json({ extraction, provider: "groq", model: process.env.GROQ_MODEL || "llama-3.1-8b-instant" });
  } catch (error) {
    req.log.error({ err: error }, "AI extraction failed");
    res.status(502).json({ error: "AI extraction could not be completed" });
  }
});

export default router;