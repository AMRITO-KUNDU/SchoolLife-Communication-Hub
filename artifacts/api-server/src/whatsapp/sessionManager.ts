import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@workspace/db";
import {
  schoolChildren,
  schoolMessages,
  schoolSources,
  whatsappGroups,
} from "@workspace/db/schema";
import { and, asc, eq } from "drizzle-orm";

export type WhatsappStatus =
  | "stopped"
  | "starting"
  | "awaiting_qr"
  | "awaiting_code"
  | "connected"
  | "reconnecting"
  | "error";

type Session = {
  socket?: WASocket;
  status: WhatsappStatus;
  qrDataUrl?: string;
  pairingCode?: string;
  connectionMode?: "qr" | "code";
  lastError?: string;
  connectedAt?: string;
};

const sessions = new Map<string, Session>();
const logger = pino({ level: "silent" });

function authDirectory(userId: string) {
  const hash = createHash("sha256").update(userId).digest("hex").slice(0, 24);
  return join(process.env.WHATSAPP_AUTH_DIR || join(process.cwd(), ".data", "whatsapp"), hash);
}

function messageText(message: {
  message?: {
    conversation?: string | null;
    extendedTextMessage?: { text?: string | null } | null;
    imageMessage?: { caption?: string | null } | null;
    documentMessage?: { caption?: string | null } | null;
  } | null;
}) {
  return (
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.documentMessage?.caption ||
    ""
  ).trim();
}

function classify(text: string) {
  const normalized = text.toLowerCase();
  if (/fee|payment|invoice|₹|rs\.?\s?\d/.test(normalized)) return "Payments";
  if (/meeting|event|schedule|calendar|trip|practice|test|exam/.test(normalized)) return "Events";
  if (/homework|worksheet|project|submit|bring|due|permission/.test(normalized)) return "Homework";
  return "Announcements";
}

async function updateSource(userId: string, detail: string, lastSync: string) {
  await db
    .insert(schoolSources)
    .values({
      clerkUserId: userId,
      sourceKey: "whatsapp",
      name: "WhatsApp",
      status: "Connected",
      detail,
      lastSync,
    })
    .onConflictDoUpdate({
      target: [schoolSources.clerkUserId, schoolSources.sourceKey],
      set: { status: "Connected", detail, lastSync, updatedAt: new Date() },
    });
}

async function cacheGroups(userId: string, socket: WASocket) {
  const groups = await socket.groupFetchAllParticipating();
  for (const [jid, group] of Object.entries(groups)) {
    await db
      .insert(whatsappGroups)
      .values({
        clerkUserId: userId,
        jid,
        name: group.subject || jid,
      })
      .onConflictDoUpdate({
        target: [whatsappGroups.clerkUserId, whatsappGroups.jid],
        set: { name: group.subject || jid, updatedAt: new Date() },
      });
  }
  const configured = await db
    .select()
    .from(whatsappGroups)
    .where(eq(whatsappGroups.clerkUserId, userId));
  await updateSource(
    userId,
    `${configured.filter((group) => group.enabled).length} school groups selected`,
    "Groups refreshed just now",
  );
  return configured;
}

async function handleIncomingMessage(userId: string, message: {
  key: { id?: string | null; remoteJid?: string | null; fromMe?: boolean | null };
  pushName?: string | null;
  message?: {
    conversation?: string | null;
    extendedTextMessage?: { text?: string | null } | null;
    imageMessage?: { caption?: string | null } | null;
    documentMessage?: { caption?: string | null } | null;
  } | null;
}) {
  const jid = message.key.remoteJid;
  const externalId = message.key.id;
  if (!jid || !jid.endsWith("@g.us") || !externalId || message.key.fromMe) return;
  const selected = await db
    .select()
    .from(whatsappGroups)
    .where(and(eq(whatsappGroups.clerkUserId, userId), eq(whatsappGroups.jid, jid)))
    .limit(1);
  if (!selected[0]?.enabled) return;

  const text = messageText(message);
  if (!text) return;
  const category = classify(text);
  const sender = message.pushName || "WhatsApp school group";
  const groupName = selected[0].name;
  const [firstChild] = await db
    .select({ slug: schoolChildren.slug })
    .from(schoolChildren)
    .where(eq(schoolChildren.clerkUserId, userId))
    .orderBy(asc(schoolChildren.id))
    .limit(1);
  await db
    .insert(schoolMessages)
    .values({
      clerkUserId: userId,
      externalId: `whatsapp:${jid}:${externalId}`,
      threadId: jid,
      sender: `${groupName} · ${sender}`,
      subject: groupName,
      snippet: text.slice(0, 500),
      summary: text.slice(0, 500),
      detected: `WhatsApp · ${category}`,
      category,
      needsAction: category === "Homework" || category === "Payments",
      childId: firstChild?.slug ?? "unassigned",
      source: "whatsapp",
      receivedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [schoolMessages.clerkUserId, schoolMessages.externalId],
    });
}

export async function startWhatsappSession(userId: string, mode: "qr" | "code" = "qr", phoneNumber?: string) {
  const current = sessions.get(userId);
  if (current && ["starting", "awaiting_qr", "connected", "reconnecting"].includes(current.status)) {
    return getWhatsappStatus(userId);
  }

  const directory = authDirectory(userId);
  await mkdir(directory, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(directory);
  const normalizedPhone = phoneNumber?.replace(/\D/g, "");
  if (mode === "code" && (!normalizedPhone || normalizedPhone.length < 8)) {
    throw new Error("A full phone number with country code is required for pairing code login");
  }
  const session: Session = { status: "starting", connectionMode: mode };
  sessions.set(userId, session);

  const socket = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: ["SchoolLife", "Chrome", "1.0.0"],
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  session.socket = socket;
  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      if (mode === "qr") session.status = "awaiting_qr";
      session.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 280 });
      session.lastError = undefined;
    }
    if (connection === "open") {
      session.status = "connected";
      session.qrDataUrl = undefined;
      session.pairingCode = undefined;
      session.lastError = undefined;
      session.connectedAt = new Date().toISOString();
      try {
        await cacheGroups(userId, socket);
        await updateSource(userId, "Choose school groups to import", "Connected just now");
      } catch (error) {
        session.lastError = "Connected, but school groups could not be loaded";
      }
    }
    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      session.socket = undefined;
      session.qrDataUrl = undefined;
      session.pairingCode = undefined;
      session.status = loggedOut ? "error" : "reconnecting";
      session.lastError = loggedOut
        ? "WhatsApp logged this session out. Scan a new QR code to reconnect."
        : "WhatsApp connection dropped. Reconnecting…";
      if (!loggedOut && sessions.get(userId) === session) {
        setTimeout(() => void startWhatsappSession(userId), 1800);
      }
    }
  });
  socket.ev.on("messages.upsert", async ({ messages }) => {
    for (const message of messages) {
      await handleIncomingMessage(userId, message);
    }
  });

  if (mode === "code" && !state.creds.registered) {
    setTimeout(() => {
      void (async () => {
        try {
          session.pairingCode = await socket.requestPairingCode(normalizedPhone!);
          session.status = "awaiting_code";
          session.lastError = undefined;
        } catch (error) {
          session.status = "error";
          session.lastError = error instanceof Error ? error.message : "Pairing code could not be created";
        }
      })();
    }, 1200);
  }

  return getWhatsappStatus(userId);
}

export async function stopWhatsappSession(userId: string) {
  const current = sessions.get(userId);
  if (current?.socket) {
    current.socket.end(undefined);
  }
  sessions.set(userId, { status: "stopped" });
  return getWhatsappStatus(userId);
}

export async function getWhatsappStatus(userId: string) {
  const session = sessions.get(userId);
  return {
    status: session?.status || "stopped",
    qrDataUrl: session?.qrDataUrl,
    pairingCode: session?.pairingCode,
    connectionMode: session?.connectionMode,
    lastError: session?.lastError,
    connectedAt: session?.connectedAt,
  };
}

export async function getWhatsappGroups(userId: string) {
  return db
    .select()
    .from(whatsappGroups)
    .where(eq(whatsappGroups.clerkUserId, userId));
}

export async function setWhatsappGroupEnabled(userId: string, jid: string, enabled: boolean) {
  const updated = await db
    .update(whatsappGroups)
    .set({ enabled, updatedAt: new Date() })
    .where(and(eq(whatsappGroups.clerkUserId, userId), eq(whatsappGroups.jid, jid)))
    .returning();
  if (!updated[0]) return undefined;

  const groups = await getWhatsappGroups(userId);
  await updateSource(
    userId,
    `${groups.filter((group) => group.enabled).length} school groups selected`,
    "Selection saved just now",
  );
  return updated[0];
}