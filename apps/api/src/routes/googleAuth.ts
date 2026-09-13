import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { googleTokens, schoolSources } from "@workspace/db/schema";
import { getOAuth2Client } from "../lib/googleOAuth";

const router: IRouter = Router();

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
];

router.get("/google/connect", async (req, res) => {
  const auth = getAuth(req) as unknown as {
    userId?: string;
    sessionClaims?: { userId?: string };
  };
  const userId =
    auth?.userId ??
    (typeof auth?.sessionClaims?.userId === "string"
      ? auth.sessionClaims.userId
      : undefined);

  const frontendUrl = (
    process.env.FRONTEND_URL || "https://school-life-communication-hub.vercel.app"
  ).replace(/\/$/, "");

  if (!userId) {
    res.redirect(
      `${frontendUrl}/sign-in?redirect_url=${encodeURIComponent("/api/google/connect")}`,
    );
    return;
  }

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    res.status(503).json({
      error: "Google OAuth credentials not configured",
      message:
        "Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
    });
    return;
  }

  const state = JSON.stringify({ userId });

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });

  res.redirect(url);
});

router.get("/google/callback", async (req, res) => {
  const { code, state, error: googleError } = req.query;
  const frontendUrl = (
    process.env.FRONTEND_URL || "https://school-life-communication-hub.vercel.app"
  ).replace(/\/$/, "");

  if (googleError || !code || typeof code !== "string") {
    req.log?.error({ err: googleError }, "Google OAuth callback error");
    res.redirect(`${frontendUrl}/app?error=google_auth_failed`);
    return;
  }

  let userId: string | undefined;
  if (typeof state === "string") {
    try {
      const parsed = JSON.parse(state) as { userId?: string };
      userId = parsed.userId;
    } catch {
      userId = state;
    }
  }

  if (!userId) {
    res.status(400).json({ error: "Invalid state parameter: missing user ID" });
    return;
  }

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    res.status(503).json({ error: "Google OAuth not configured" });
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      res.redirect(`${frontendUrl}/app?error=google_no_access_token`);
      return;
    }

    const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

    await db
      .insert(googleTokens)
      .values({
        clerkUserId: userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiryDate,
        scope: tokens.scope || null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: googleTokens.clerkUserId,
        set: {
          accessToken: tokens.access_token,
          ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
          expiryDate,
          scope: tokens.scope || null,
          updatedAt: new Date(),
        },
      });

    await db
      .insert(schoolSources)
      .values({
        clerkUserId: userId,
        sourceKey: "email",
        name: "Email",
        status: "Connected",
        detail: "Connected Gmail account",
        lastSync: "Connected just now",
      })
      .onConflictDoUpdate({
        target: [schoolSources.clerkUserId, schoolSources.sourceKey],
        set: {
          status: "Connected",
          detail: "Connected Gmail account",
          lastSync: "Connected just now",
          updatedAt: new Date(),
        },
      });

    await db
      .insert(schoolSources)
      .values({
        clerkUserId: userId,
        sourceKey: "classroom",
        name: "Classroom",
        status: "Connected",
        detail: "Connected Google Classroom",
        lastSync: "Connected just now",
      })
      .onConflictDoUpdate({
        target: [schoolSources.clerkUserId, schoolSources.sourceKey],
        set: {
          status: "Connected",
          detail: "Connected Google Classroom",
          lastSync: "Connected just now",
          updatedAt: new Date(),
        },
      });

    res.redirect(`${frontendUrl}/app?connected=google`);
  } catch (error) {
    req.log?.error({ err: error }, "Failed to exchange Google OAuth code");
    res.redirect(`${frontendUrl}/app?error=token_exchange_failed`);
  }
});

export default router;
