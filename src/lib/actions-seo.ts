"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const DATAFORSEO_API = "https://api.dataforseo.com/v3";

async function getCredentials() {
  // Try env first, then agency settings
  let login = process.env.DATAFORSEO_LOGIN;
  let password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    const settings = await prisma.agencySettings.findUnique({
      where: { id: "default" },
    });
    login = settings?.dataforseoLogin || undefined;
    password = settings?.dataforseoPwd || undefined;
  }

  if (!login || !password) {
    throw new Error("DataForSEO credentials not configured. Set them in Settings or .env");
  }

  return { login, password };
}

function getAuthHeader(login: string, password: string): string {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

async function postDataForSEO(endpoint: string, body: unknown) {
  const { login, password } = await getCredentials();

  const response = await fetch(`${DATAFORSEO_API}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(login, password),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DataForSEO error: ${response.status} ${error}`);
  }

  return response.json();
}

async function getDataForSEO(endpoint: string) {
  const { login, password } = await getCredentials();

  const response = await fetch(`${DATAFORSEO_API}${endpoint}`, {
    method: "GET",
    headers: {
      Authorization: getAuthHeader(login, password),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DataForSEO error: ${response.status} ${error}`);
  }

  return response.json();
}

/** Normalize a domain for comparison: strip protocol, www, trailing slash */
function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

/** Check if a SERP result domain matches the client's domain */
function domainMatches(resultDomain: string, clientDomain: string): boolean {
  const normResult = normalizeDomain(resultDomain);
  const normClient = normalizeDomain(clientDomain);
  // Match if either contains the other (handles subdomains)
  return normResult === normClient ||
    normResult.endsWith(`.${normClient}`) ||
    normClient.endsWith(`.${normResult}`);
}

export async function checkRankings(clientId: string) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    throw new Error("Unauthorized");
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { keywords: { where: { isTracking: true } } },
  });

  if (!client || !client.domain) throw new Error("Client or domain not found");
  if (client.keywords.length === 0) throw new Error("No keywords to track");

  console.log(`[RANK CHECK] Starting for ${client.name} (${client.domain}), ${client.keywords.length} keywords`);

  // Build SERP tasks — one task per keyword
  const tasks = client.keywords.map((kw) => ({
    keyword: kw.keyword,
    location_code: 2840, // United States
    language_code: "en",
    device: "desktop",
    os: "windows",
    depth: 100, // top 100 results
  }));

  // Post tasks
  const taskResult = await postDataForSEO("/serp/google/organic/task_post", tasks);

  if (!taskResult?.tasks) {
    throw new Error("Failed to create SERP tasks");
  }

  // Collect task IDs
  const taskEntries = taskResult.tasks
    .filter((t: { status_code: number }) => t.status_code === 20100)
    .map((t: { id: string }, idx: number) => ({
      taskId: t.id,
      keywordIndex: idx,
    }));

  console.log(`[RANK CHECK] Created ${taskEntries.length} tasks, polling for results...`);

  let successCount = 0;

  // Poll each task with retries instead of a fixed wait
  for (const entry of taskEntries) {
    const keyword = client.keywords[entry.keywordIndex];
    if (!keyword) continue;

    let result = null;
    const maxAttempts = 8;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Wait between attempts (exponential backoff: 5s, 8s, 12s, 18s, 27s...)
      const waitMs = Math.min(5000 * Math.pow(1.5, attempt - 1), 30000);
      await new Promise((resolve) => setTimeout(resolve, waitMs));

      try {
        // task_get is a GET endpoint
        const response = await getDataForSEO(
          `/serp/google/organic/task_get/regular/${entry.taskId}`
        );

        const taskStatus = response?.tasks?.[0]?.status_code;

        if (taskStatus === 20000) {
          // Task completed successfully
          result = response;
          console.log(`[RANK CHECK] "${keyword.keyword}" — result ready (attempt ${attempt})`);
          break;
        } else if (taskStatus === 20100) {
          // Still processing
          console.log(`[RANK CHECK] "${keyword.keyword}" — still processing (attempt ${attempt}/${maxAttempts})`);
          continue;
        } else {
          console.log(`[RANK CHECK] "${keyword.keyword}" — unexpected status ${taskStatus}`);
          break;
        }
      } catch (err) {
        console.error(`[RANK CHECK] "${keyword.keyword}" — error on attempt ${attempt}:`, err);
        if (attempt === maxAttempts) break;
      }
    }

    if (!result) {
      console.log(`[RANK CHECK] "${keyword.keyword}" — no result after ${maxAttempts} attempts`);
      // Still save a snapshot with null position so we have a record
      await prisma.rankSnapshot.create({
        data: {
          clientId,
          keywordId: keyword.id,
          position: null,
          previousPos: null,
          url: null,
          localPack: false,
        },
      });
      continue;
    }

    const items = result?.tasks?.[0]?.result?.[0]?.items || [];
    const totalResults = items.length;

    // Find our domain in results using normalized matching
    const match = items.find(
      (item: { type: string; domain: string; url: string }) =>
        item.type === "organic" && domainMatches(item.domain || "", client.domain!)
    );

    console.log(
      `[RANK CHECK] "${keyword.keyword}" — scanned ${totalResults} results, ` +
      `match: ${match ? `#${match.rank_group} (${match.domain})` : "NOT FOUND"}`
    );

    // Debug: log first 5 domains if no match found
    if (!match && totalResults > 0) {
      const topDomains = items
        .filter((i: { type: string }) => i.type === "organic")
        .slice(0, 5)
        .map((i: { rank_group: number; domain: string }) => `#${i.rank_group} ${i.domain}`);
      console.log(`[RANK CHECK]   Top 5 domains: ${topDomains.join(", ")}`);
    }

    // Get previous snapshot for delta
    const prevSnapshot = await prisma.rankSnapshot.findFirst({
      where: { keywordId: keyword.id },
      orderBy: { checkedAt: "desc" },
    });

    // Save snapshot
    await prisma.rankSnapshot.create({
      data: {
        clientId,
        keywordId: keyword.id,
        position: match ? match.rank_group : null,
        previousPos: prevSnapshot?.position || null,
        url: match?.url || null,
        localPack: false,
      },
    });

    successCount++;
  }

  revalidatePath(`/agency/clients/${clientId}/rankings`);
  revalidatePath(`/agency/clients/${clientId}`);
  revalidatePath("/agency/dashboard");

  console.log(`[RANK CHECK] Completed: ${successCount}/${client.keywords.length} keywords checked`);
  return { checked: successCount, total: client.keywords.length };
}

export async function getRankHistory(clientId: string, days: number = 30) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const since = new Date();
  since.setDate(since.getDate() - days);

  return prisma.rankSnapshot.findMany({
    where: {
      clientId,
      checkedAt: { gte: since },
    },
    include: { keyword: true },
    orderBy: { checkedAt: "asc" },
  });
}

export async function getKeywordMetrics(keyword: string) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    throw new Error("Unauthorized");
  }

  const result = await postDataForSEO("/keywords_data/google_ads/search_volume/live", [
    {
      keywords: [keyword],
      location_code: 2840,
      language_code: "en",
    },
  ]);

  const data = result?.tasks?.[0]?.result?.[0];

  return {
    keyword: data?.keyword || keyword,
    searchVolume: data?.search_volume || 0,
    competition: data?.competition || "UNKNOWN",
    competitionLevel: data?.competition_level || 0,
    cpc: data?.cpc || 0,
  };
}
