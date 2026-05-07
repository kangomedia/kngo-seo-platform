import { decrypt } from "@/lib/encryption";

export interface WPCredentials {
  url: string;       // e.g. "https://example.com" (no trailing slash)
  username: string;
  appPassword: string;
}

export interface WPPublishParams {
  title: string;
  content: string;       // HTML
  excerpt?: string;
  status?: "draft" | "publish" | "pending" | "private";
  slug?: string;
  categories?: number[]; // category IDs on the target site
  tags?: number[];
}

export interface WPPostResult {
  id: number;
  link: string;
  status: string;
}

function authHeader({ username, appPassword }: WPCredentials): string {
  // WordPress Application Passwords are sent as Basic auth with spaces removed.
  const cleaned = appPassword.replace(/\s+/g, "");
  return `Basic ${Buffer.from(`${username}:${cleaned}`).toString("base64")}`;
}

/**
 * Decode credentials from the per-client DB columns.
 * Returns null if any required field is missing — callers should then surface
 * "WordPress not configured for this client" to the user.
 */
export function loadCredentials(client: {
  wpUrl: string | null;
  wpUsername: string | null;
  wpAppPasswordEnc: string | null;
}): WPCredentials | null {
  if (!client.wpUrl || !client.wpUsername || !client.wpAppPasswordEnc) return null;
  return {
    url: client.wpUrl.replace(/\/$/, ""),
    username: client.wpUsername,
    appPassword: decrypt(client.wpAppPasswordEnc),
  };
}

/**
 * Verify credentials by hitting /wp-json/wp/v2/users/me. Used by the settings
 * UI to confirm a credential set is valid before saving.
 */
export async function verifyCredentials(creds: WPCredentials): Promise<{ ok: true; userId: number; userName: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${creds.url}/wp-json/wp/v2/users/me?context=edit`, {
      headers: { Authorization: authHeader(creds) },
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    }
    const data = await res.json();
    return { ok: true, userId: data.id, userName: data.name };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createPost(creds: WPCredentials, params: WPPublishParams): Promise<WPPostResult> {
  const body: Record<string, unknown> = {
    title: params.title,
    content: params.content,
    status: params.status ?? "draft",
  };
  if (params.excerpt) body.excerpt = params.excerpt;
  if (params.slug) body.slug = params.slug;
  if (params.categories?.length) body.categories = params.categories;
  if (params.tags?.length) body.tags = params.tags;

  const res = await fetch(`${creds.url}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: authHeader(creds),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WordPress API error: ${res.status} ${res.statusText} ${text}`.trim());
  }

  const data = await res.json();
  return { id: data.id, link: data.link, status: data.status };
}
