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

async function callDataForSEO(endpoint: string, body: unknown) {
  const { login, password } = await getCredentials();
  const encoded = Buffer.from(`${login}:${password}`).toString("base64");

  const response = await fetch(`${DATAFORSEO_API}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${encoded}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DataForSEO error: ${response.status} ${error}`);
  }

  return response.json();
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
  const taskResult = await callDataForSEO("/serp/google/organic/task_post", tasks);

  if (!taskResult?.tasks) {
    throw new Error("Failed to create SERP tasks");
  }

  // Wait a moment for tasks to process (in production, use webhooks or polling)
  await new Promise((resolve) => setTimeout(resolve, 15000));

  // Collect task IDs and fetch results
  const taskIds = taskResult.tasks
    .filter((t: { status_code: number }) => t.status_code === 20100)
    .map((t: { id: string }) => t.id);

  let successCount = 0;

  for (let i = 0; i < taskIds.length; i++) {
    try {
      const result = await callDataForSEO(`/serp/google/organic/task_get/regular/${taskIds[i]}`, null);

      const searchedKeyword = client.keywords[i];
      if (!searchedKeyword) continue;

      const items = result?.tasks?.[0]?.result?.[0]?.items || [];

      // Find our domain in results
      const match = items.find(
        (item: { type: string; domain: string }) =>
          item.type === "organic" && item.domain?.includes(client.domain!)
      );

      // Get previous snapshot for delta
      const prevSnapshot = await prisma.rankSnapshot.findFirst({
        where: { keywordId: searchedKeyword.id },
        orderBy: { checkedAt: "desc" },
      });

      // Save snapshot
      await prisma.rankSnapshot.create({
        data: {
          clientId,
          keywordId: searchedKeyword.id,
          position: match ? match.rank_group : null,
          previousPos: prevSnapshot?.position || null,
          url: match?.url || null,
          localPack: false,
        },
      });

      successCount++;
    } catch (err) {
      console.error(`Failed to fetch results for task ${taskIds[i]}:`, err);
    }
  }

  revalidatePath(`/agency/clients/${clientId}/rankings`);
  revalidatePath(`/agency/clients/${clientId}`);
  revalidatePath("/agency/dashboard");

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

  const result = await callDataForSEO("/keywords_data/google_ads/search_volume/live", [
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
