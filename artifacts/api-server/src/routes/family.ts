import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  schoolChildren,
  schoolEvents,
  schoolMessages,
  schoolSources,
  schoolTasks,
  userProfiles,
} from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const sourceDefaults = [
  ["email", "Email", "Connect", "Connect Gmail to read school emails", "Not connected"],
  ["whatsapp", "WhatsApp", "Connect", "Connect a WhatsApp Web session to read selected school groups", "Not connected"],
  ["calendar", "Calendar", "Connect", "Connect Google Calendar to keep dates in one place", "Not connected"],
] as const;

async function ensureProfile(clerkUserId: string) {
  const existing = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkUserId, clerkUserId))
    .limit(1);
  if (existing[0]) return;
  await db.insert(userProfiles).values({ clerkUserId });
}

router.post("/family/children", requireAuth, async (req, res) => {
  const clerkUserId = (req as AuthenticatedRequest).userId;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const grade = typeof req.body?.grade === "string" ? req.body.grade.trim() : "";
  const className = typeof req.body?.className === "string" ? req.body.className.trim() : "";
  const school = typeof req.body?.school === "string" ? req.body.school.trim() : "";
  const subjects = Array.isArray(req.body?.subjects)
    ? req.body.subjects.filter((subject: unknown): subject is string => typeof subject === "string").map((subject: string) => subject.trim()).filter(Boolean)
    : [];
  if (!name || !grade || !className || !school) {
    res.status(400).json({ error: "name, grade, className, and school are required" });
    return;
  }

  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "child";
  const existing = await db
    .select({ slug: schoolChildren.slug })
    .from(schoolChildren)
    .where(eq(schoolChildren.clerkUserId, clerkUserId));
  const usedSlugs = new Set(existing.map((child) => child.slug));
  let slug = baseSlug;
  let suffix = 2;
  while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`;

  const [child] = await db.insert(schoolChildren).values({
    clerkUserId,
    slug,
    name,
    grade,
    className,
    school,
    subjects,
  }).returning();
  res.status(201).json({ ...child, id: String(child.id) });
});

router.post("/family/tasks", requireAuth, async (req, res) => {
  const clerkUserId = (req as AuthenticatedRequest).userId;
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const childId = typeof req.body?.childId === "string" ? req.body.childId.trim() : "";
  if (!title || !childId) {
    res.status(400).json({ error: "title and childId are required" });
    return;
  }
  const [task] = await db.insert(schoolTasks).values({
    clerkUserId,
    title,
    kind: typeof req.body.kind === "string" ? req.body.kind : "Homework",
    priority: ["urgent", "important", "normal"].includes(req.body.priority) ? req.body.priority : "normal",
    childId,
    dueDate: typeof req.body.dueDate === "string" && req.body.dueDate ? req.body.dueDate : "Unscheduled",
    dueTime: typeof req.body.dueTime === "string" ? req.body.dueTime : null,
    source: typeof req.body.source === "string" ? req.body.source : "SchoolLife AI",
    items: Array.isArray(req.body.items) ? req.body.items.filter((item: unknown): item is string => typeof item === "string") : [],
  }).returning();
  res.status(201).json({ ...task, id: String(task.id) });
});

router.get("/family", requireAuth, async (req, res) => {
  const clerkUserId = (req as AuthenticatedRequest).userId;
  await ensureProfile(clerkUserId);
  await Promise.all(sourceDefaults.map(([sourceKey, name, status, detail, lastSync]) =>
    db.insert(schoolSources).values({
      clerkUserId,
      sourceKey,
      name,
      status,
      detail,
      lastSync,
    }).onConflictDoNothing({
      target: [schoolSources.clerkUserId, schoolSources.sourceKey],
    }),
  ));

  const [children, tasks, events, messages, sources] = await Promise.all([
    db.select().from(schoolChildren).where(eq(schoolChildren.clerkUserId, clerkUserId)),
    db.select().from(schoolTasks).where(eq(schoolTasks.clerkUserId, clerkUserId)),
    db.select().from(schoolEvents).where(eq(schoolEvents.clerkUserId, clerkUserId)),
    db.select().from(schoolMessages).where(eq(schoolMessages.clerkUserId, clerkUserId)),
    db.select().from(schoolSources).where(eq(schoolSources.clerkUserId, clerkUserId)),
  ]);

  res.json({
    children,
    tasks: tasks.map((task) => ({ ...task, id: String(task.id), items: task.items ?? [] })),
    events: events.map((event) => ({ ...event, id: String(event.id) })),
    messages: messages.map((message) => ({ ...message, id: String(message.id) })),
    sources: sources.map((source) => ({ ...source, id: source.sourceKey, groups: source.groups ?? [] })),
  });
});

router.patch("/family/tasks/:id", requireAuth, async (req, res) => {
  const clerkUserId = (req as AuthenticatedRequest).userId;
  const taskId = Number(req.params.id);
  const status = req.body?.status;
  if (!Number.isInteger(taskId) || !["open", "completed"].includes(status)) {
    res.status(400).json({ error: "A valid task id and status are required" });
    return;
  }

  const updated = await db
    .update(schoolTasks)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(schoolTasks.id, taskId), eq(schoolTasks.clerkUserId, clerkUserId)))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json({ ...updated[0], id: String(updated[0].id) });
});

export default router;