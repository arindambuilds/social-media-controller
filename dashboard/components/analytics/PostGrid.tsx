'use client';

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

interface Post {
  id: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  captionPreview?: string | null;
  caption?: string | null;
  permalink?: string | null;
  likesCount?: number | null;
  commentsCount?: number | null;
  reach?: number | null;
  publishedAt?: string | null;
}

type SortKey = "recent" | "engagement" | "reach";

const TYPE_ICON: Record<string, string> = {
  VIDEO: "🎬",
  CAROUSEL_ALBUM: "🖼️",
  IMAGE: "📷"
};

function gradientFallback(id: string) {
  const h1 = (id.charCodeAt(0) * 7) % 360;
  const h2 = (id.charCodeAt(id.length - 1) * 13) % 360;
  return `linear-gradient(135deg, hsl(${h1},60%,18%), hsl(${h2},70%,28%))`;
}

function PostCard({ post }: { post: Post }) {
  const [imgErr, setImgErr] = useState(false);
  const eng = (post.likesCount ?? 0) + (post.commentsCount ?? 0);
  const icon = TYPE_ICON[post.mediaType ?? ""] ?? "📷";
  const href = post.permalink ?? "#";
  const caption = post.caption ?? post.captionPreview ?? "";

  return (
    <a
      href={href}
      target={href === "#" ? undefined : "_blank"}
      rel={href === "#" ? undefined : "noopener noreferrer"}
      className="group relative block aspect-square overflow-hidden rounded-xl border border-white/10 transition-all hover:border-cyan-400/50"
    >
      {post.mediaUrl && !imgErr ? (
        <img
          src={post.mediaUrl}
          alt={caption.slice(0, 40) || "Post"}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => setImgErr(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-3xl"
          style={{ background: gradientFallback(post.id) }}
        >
          {icon}
        </div>
      )}

      <div className="absolute inset-0 flex flex-col justify-end space-y-1 bg-black/65 p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
        {caption ? (
          <p className="line-clamp-2 text-[10px] leading-tight text-white">{caption}</p>
        ) : null}
        <div className="flex gap-2 text-[10px] text-white/80">
          <span>❤️ {(post.likesCount ?? 0).toLocaleString("en-IN")}</span>
          <span>💬 {(post.commentsCount ?? 0).toLocaleString("en-IN")}</span>
          {post.reach ? <span>👁 {post.reach.toLocaleString("en-IN")}</span> : null}
        </div>
      </div>

      <div className="absolute right-1.5 top-1.5 rounded bg-black/50 px-1 py-0.5 text-[10px]">
        {icon}
      </div>

      {eng > 0 ? (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
          <div
            className="h-full bg-cyan-400 transition-all duration-700"
            style={{ width: `${Math.min((eng / 300) * 100, 100)}%` }}
          />
        </div>
      ) : null}
    </a>
  );
}

export function PostGrid({ clientId, limit = 12 }: { clientId: string | null; limit?: number }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  useEffect(() => {
    if (!clientId) return;
    void (async () => {
      try {
        const d = await apiFetch<{ posts: Post[] }>(
          `/analytics/${encodeURIComponent(clientId)}/posts?limit=${limit}&sort=${sortBy === "recent" ? "recent" : "engagement"}`
        );
        const raw = d.posts ?? [];
        setPosts(Array.isArray(raw) ? raw : []);
      } catch {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId, limit, sortBy]);

  const sorted = [...posts].sort((a, b) => {
    if (sortBy === "engagement") {
      const ea = (a.likesCount ?? 0) + (a.commentsCount ?? 0);
      const eb = (b.likesCount ?? 0) + (b.commentsCount ?? 0);
      return eb - ea;
    }
    if (sortBy === "reach") {
      return (b.reach ?? 0) - (a.reach ?? 0);
    }
    return (
      new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()
    );
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-white/50">
          Spot the posts that drove results
        </p>
        <div className="flex gap-1">
          {(["recent", "engagement", "reach"] as SortKey[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSortBy(s)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                sortBy === s
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-300"
                  : "border-white/10 text-white/40 hover:border-white/30"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : !sorted.length ? (
        <div className="flex h-40 items-center justify-center text-sm text-white/30">
          No posts yet — connect Instagram to see your content grid.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {sorted.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

