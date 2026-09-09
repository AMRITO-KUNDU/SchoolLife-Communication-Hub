import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const schoolChildren = pgTable(
  "school_children",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    grade: text("grade").notNull(),
    className: text("class_name").notNull(),
    school: text("school").notNull(),
    subjects: jsonb("subjects").$type<string[]>().default([]).notNull(),
    ...timestamps,
  },
  (table) => ({
    ownerSlug: uniqueIndex("school_children_owner_slug_idx").on(
      table.clerkUserId,
      table.slug,
    ),
  }),
);

export const schoolTasks = pgTable(
  "school_tasks",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    priority: text("priority").notNull(),
    childId: text("child_id").notNull(),
    dueDate: text("due_date").notNull(),
    dueTime: text("due_time"),
    source: text("source").notNull(),
    status: text("status").notNull().default("open"),
    items: jsonb("items").$type<string[]>().default([]).notNull(),
    ...timestamps,
  },
  (table) => ({
    ownerExternal: uniqueIndex("school_tasks_owner_external_idx").on(
      table.clerkUserId,
      table.externalId,
    ),
  }),
);

export const schoolEvents = pgTable(
  "school_events",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    externalId: text("external_id"),
    title: text("title").notNull(),
    date: text("date").notNull(),
    time: text("time").notNull(),
    childId: text("child_id").notNull(),
    kind: text("kind").notNull(),
    source: text("source").notNull(),
    ...timestamps,
  },
  (table) => ({
    ownerExternal: uniqueIndex("school_events_owner_external_idx").on(
      table.clerkUserId,
      table.externalId,
    ),
  }),
);

export const schoolMessages = pgTable(
  "school_messages",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    externalId: text("external_id").notNull(),
    threadId: text("thread_id"),
    sender: text("sender").notNull(),
    subject: text("subject").notNull(),
    snippet: text("snippet").notNull(),
    summary: text("summary").notNull(),
    detected: text("detected").notNull(),
    category: text("category").notNull(),
    needsAction: boolean("needs_action").notNull().default(false),
    childId: text("child_id").notNull(),
    source: text("source").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    ownerExternal: uniqueIndex("school_messages_owner_external_idx").on(
      table.clerkUserId,
      table.externalId,
    ),
  }),
);

export const schoolSources = pgTable(
  "school_sources",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    sourceKey: text("source_key").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("Connect"),
    detail: text("detail").notNull(),
    lastSync: text("last_sync").notNull(),
    groups: jsonb("groups").$type<string[]>().default([]).notNull(),
    ...timestamps,
  },
  (table) => ({
    ownerSource: uniqueIndex("school_sources_owner_source_idx").on(
      table.clerkUserId,
      table.sourceKey,
    ),
  }),
);

export const whatsappGroups = pgTable(
  "whatsapp_groups",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    jid: text("jid").notNull(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    ownerJid: uniqueIndex("whatsapp_groups_owner_jid_idx").on(
      table.clerkUserId,
      table.jid,
    ),
  }),
);

export const syncStates = pgTable(
  "school_sync_states",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    provider: text("provider").notNull(),
    cursor: text("cursor"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    ownerProvider: uniqueIndex("school_sync_states_owner_provider_idx").on(
      table.clerkUserId,
      table.provider,
    ),
  }),
);

export type SchoolChild = typeof schoolChildren.$inferSelect;
export type SchoolTask = typeof schoolTasks.$inferSelect;
export type SchoolEvent = typeof schoolEvents.$inferSelect;
export type SchoolMessage = typeof schoolMessages.$inferSelect;
export type SchoolSource = typeof schoolSources.$inferSelect;
export type WhatsappGroup = typeof whatsappGroups.$inferSelect;
export type SyncState = typeof syncStates.$inferSelect;