import type { Prisma, ScheduledPost, SocialAccount } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt } from "../lib/encryption";

const GRAPH = "https://graph.facebook.com/v19.0";

export type PublishResult = { platformPostId: string };

export async function markScheduledPostFailed(id: string, message: string): Promise<void> {
  await prisma.scheduledPost.update({
    where: { id },
    data: { status: "FAILED", failureReason: message.slice(0, 2000) }
  });
}

export async function markScheduledPostPublished(
  id: string,
  platformPostId: string,
  engagementStats?: Record<string, unknown>
): Promise<void> {
  const stats = engagementStats as Prisma.InputJsonValue | undefined;
  await prisma.scheduledPost.update({
    where: { id },
    data: {
      status: "PUBLISHED",
      platformPostId,
      publishedAt: new Date(),
      engagementStats: stats
    }
  });
}

async function graphJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) }
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = payload.error as { message?: string } | undefined;
    throw new Error(err?.message ?? res.statusText);
  }
  return payload as T;
}

export async function publishToFacebook(account: SocialAccount, post: ScheduledPost): Promise<PublishResult> {
  const token = decrypt(account.encryptedToken);
  const pageId = account.pageId ?? account.platformUserId;
  const caption = post.caption || "";
  const mediaUrls = (post.mediaUrls as string[]) ?? [];
  let attached: string[] = [];

  for (const url of mediaUrls.slice(0, 5)) {
    const photoUrl = `${GRAPH}/${pageId}/photos?${new URLSearchParams({
      url,
      caption: mediaUrls.length === 1 ? caption : "",
      access_token: token,
      published: "false"
    }).toString()}`;
    const photo = await graphJson<{ id: string }>(photoUrl, { method: "POST" });
    if (photo?.id) attached.push(photo.id);
  }

  const params = new URLSearchParams({ access_token: token });
  if (attached.length > 0) {
    attached.forEach((id, i) => params.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
    if (caption) params.append("message", caption);
  } else {
    params.append("message", caption);
  }

  const feedUrl = `${GRAPH}/${pageId}/feed?${params.toString()}`;
  const out = await graphJson<{ id: string }>(feedUrl, { method: "POST" });
  if (!out?.id) throw new Error("Facebook feed publish returned no id.");
  return { platformPostId: out.id };
}

export async function publishToInstagram(account: SocialAccount, post: ScheduledPost): Promise<PublishResult> {
  const token = decrypt(account.encryptedToken);
  const igUserId = account.platformUserId;
  const caption = post.caption || "";
  const mediaUrls = (post.mediaUrls as string[]) ?? [];
  const imageUrl = mediaUrls[0];
  if (!imageUrl) {
    throw new Error("Instagram publishing requires at least one image URL.");
  }

  const createParams = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: token
  });
  const createUrl = `${GRAPH}/${igUserId}/media?${createParams.toString()}`;
  const created = await graphJson<{ id: string }>(createUrl, { method: "POST" });
  if (!created?.id) throw new Error("Instagram media creation failed.");

  const publishParams = new URLSearchParams({
    creation_id: created.id,
    access_token: token
  });
  const publishUrl = `${GRAPH}/${igUserId}/media_publish?${publishParams.toString()}`;
  const published = await graphJson<{ id: string }>(publishUrl, { method: "POST" });
  if (!published?.id) throw new Error("Instagram media_publish failed.");
  return { platformPostId: published.id };
}

export async function publishToLinkedIn(account: SocialAccount, post: ScheduledPost): Promise<PublishResult> {
  const token = decrypt(account.encryptedToken);
  const caption = post.caption || "";

  const body = {
    author: `urn:li:person:${account.platformUserId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: caption },
        shareMediaCategory: "NONE" as const
      }
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0"
    },
    body: JSON.stringify(body)
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((payload as { message?: string }).message ?? res.statusText);
  }
  const id = (payload.id as string) ?? (payload as { value?: string }).value;
  if (!id) throw new Error("LinkedIn UGC post returned no id.");
  return { platformPostId: id };
}
