import { google } from "googleapis";
import { db } from "@workspace/db";
import { googleTokens } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    "https://schoollife-communication-hub.onrender.com/api/google/callback";

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export async function getAuthenticatedClient(clerkUserId: string) {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return null;
  }

  const record = await db
    .select()
    .from(googleTokens)
    .where(eq(googleTokens.clerkUserId, clerkUserId))
    .limit(1);

  const tokenData = record[0];
  if (!tokenData || !tokenData.accessToken) {
    return null;
  }

  oauth2Client.setCredentials({
    access_token: tokenData.accessToken,
    refresh_token: tokenData.refreshToken || undefined,
    expiry_date: tokenData.expiryDate ? tokenData.expiryDate.getTime() : undefined,
    scope: tokenData.scope || undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    try {
      await db
        .insert(googleTokens)
        .values({
          clerkUserId,
          accessToken: tokens.access_token || tokenData.accessToken,
          refreshToken: tokens.refresh_token || tokenData.refreshToken,
          expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : tokenData.expiryDate,
          scope: tokens.scope || tokenData.scope,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: googleTokens.clerkUserId,
          set: {
            accessToken: tokens.access_token || tokenData.accessToken,
            ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
            expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : tokenData.expiryDate,
            scope: tokens.scope || tokenData.scope,
            updatedAt: new Date(),
          },
        });
    } catch (err) {
      console.error("Failed to update refreshed Google OAuth tokens", err);
    }
  });

  return oauth2Client;
}
