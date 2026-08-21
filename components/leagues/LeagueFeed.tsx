"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addReply,
  createPost,
  deletePost,
  deleteReply,
  toggleLike,
} from "@/app/(app)/leagues/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  POST_MAX_LENGTH,
  REPLY_MAX_LENGTH,
  validatePostBody,
  validateReplyBody,
} from "@/lib/social";
import type { FeedPost, FeedReply } from "@/lib/queries";

const boxClass =
  "w-full rounded-sm border border-border-default bg-surface px-3 py-2 font-body text-sm text-primary placeholder:text-muted focus:border-border-strong focus:outline-none";

// Compact relative time — the feed is glanceable, so "3m", "2h", "5d".
function timeAgo(iso: string): string {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Load one post's replies (client-side, on expand). Pure fetch — no state — so
// the caller decides when to setState, keeping effects clean.
async function fetchThread(postId: number): Promise<FeedReply[]> {
  const supabase = createClient();
  const { data } = await supabase.rpc("league_post_thread", { p_post: postId });
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    authorId: r.author_id,
    authorName: r.author_name,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export function LeagueFeed({
  leagueId,
  posts,
  currentUserId,
  canModerate,
}: {
  leagueId: number;
  posts: FeedPost[];
  currentUserId: string;
  canModerate: boolean;
}) {
  return (
    <div className="space-y-4">
      <Composer leagueId={leagueId} />
      {posts.length === 0 ? (
        <p className="py-8 text-center font-body text-sm text-muted">
          No posts yet — say something to your league.
        </p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              leagueId={leagueId}
              currentUserId={currentUserId}
              canModerate={canModerate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Composer({ leagueId }: { leagueId: number }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const remaining = POST_MAX_LENGTH - [...body].length;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const v = validatePostBody(body);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    start(async () => {
      const res = await createPost(leagueId, body);
      if (res.ok) {
        setBody("");
        setError(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Post to your league…"
        rows={3}
        className={boxClass}
      />
      <div className="flex items-center justify-between">
        <span
          className={`font-mono text-xs ${remaining < 0 ? "text-danger" : "text-muted"}`}
        >
          {remaining}
        </span>
        <Button
          type="submit"
          disabled={pending || body.trim().length === 0 || remaining < 0}
        >
          {pending ? "Posting…" : "Post"}
        </Button>
      </div>
      {error ? <p className="font-body text-xs text-danger">{error}</p> : null}
    </form>
  );
}

function PostCard({
  post,
  leagueId,
  currentUserId,
  canModerate,
}: {
  post: FeedPost;
  leagueId: number;
  currentUserId: string;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [showReplies, setShowReplies] = useState(false);
  const [likePending, startLike] = useTransition();
  const [delPending, startDel] = useTransition();

  const canDelete = post.authorId === currentUserId || canModerate;

  function like() {
    startLike(async () => {
      await toggleLike(post.id, leagueId);
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Delete this post?")) return;
    startDel(async () => {
      await deletePost(post.id, leagueId);
      router.refresh();
    });
  }

  return (
    <article
      className={`rounded-sm border bg-surface p-3 ${
        post.isSystem ? "border-l-2 border-l-accent border-border-default" : "border-border-default"
      }`}
    >
      <header className="flex items-baseline justify-between gap-2">
        <span className="font-body text-sm font-semibold text-primary">
          {post.isSystem ? "🏁 Race Control" : post.authorName ?? "Unknown"}
        </span>
        <span className="shrink-0 font-mono text-xs text-muted">
          {timeAgo(post.createdAt)}
        </span>
      </header>

      <p className="mt-1 font-body text-sm whitespace-pre-wrap text-primary">
        {post.body}
      </p>

      <footer className="mt-2 flex items-center gap-4">
        <button
          onClick={like}
          disabled={likePending}
          className={`font-mono text-xs ${post.likedByMe ? "text-accent" : "text-secondary hover:text-primary"}`}
        >
          {post.likedByMe ? "♥" : "♡"} {post.likeCount}
        </button>
        <button
          onClick={() => setShowReplies((v) => !v)}
          className="font-mono text-xs text-secondary hover:text-primary"
        >
          💬 {post.replyCount}
        </button>
        {canDelete ? (
          <button
            onClick={remove}
            disabled={delPending}
            className="ml-auto font-mono text-xs text-muted hover:text-danger"
          >
            {delPending ? "…" : "Delete"}
          </button>
        ) : null}
      </footer>

      {showReplies ? (
        <ReplyThread
          postId={post.id}
          leagueId={leagueId}
          currentUserId={currentUserId}
          canModerate={canModerate}
        />
      ) : null}
    </article>
  );
}

function ReplyThread({
  postId,
  leagueId,
  currentUserId,
  canModerate,
}: {
  postId: number;
  leagueId: number;
  currentUserId: string;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [replies, setReplies] = useState<FeedReply[] | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let active = true;
    fetchThread(postId).then((rows) => {
      if (active) setReplies(rows);
    });
    return () => {
      active = false;
    };
  }, [postId]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const v = validateReplyBody(body);
    if (!v.ok) {
      setError(v.error);
      return;
    }
    start(async () => {
      const res = await addReply(postId, leagueId, body);
      if (res.ok) {
        setBody("");
        setError(null);
        setReplies(await fetchThread(postId));
        router.refresh(); // update the reply count on the card
      } else {
        setError(res.error);
      }
    });
  }

  function removeReply(replyId: number) {
    start(async () => {
      await deleteReply(replyId, leagueId);
      setReplies(await fetchThread(postId));
      router.refresh();
    });
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border-default pt-3 pl-3">
      {replies === null ? (
        <p className="font-body text-xs text-muted">Loading…</p>
      ) : (
        replies.map((reply) => (
          <div key={reply.id} className="flex items-baseline justify-between gap-2">
            <p className="font-body text-sm text-primary">
              <span className="font-semibold">{reply.authorName ?? "Unknown"}</span>{" "}
              <span className="whitespace-pre-wrap">{reply.body}</span>
            </p>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-xs text-muted">{timeAgo(reply.createdAt)}</span>
              {reply.authorId === currentUserId || canModerate ? (
                <button
                  onClick={() => removeReply(reply.id)}
                  className="font-mono text-xs text-muted hover:text-danger"
                >
                  ✕
                </button>
              ) : null}
            </span>
          </div>
        ))
      )}

      <form onSubmit={submit} className="flex items-center gap-2 pt-1">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Reply…"
          maxLength={REPLY_MAX_LENGTH + 20}
          className={boxClass}
        />
        <Button type="submit" variant="secondary" disabled={pending || body.trim().length === 0}>
          {pending ? "…" : "Reply"}
        </Button>
      </form>
      {error ? <p className="font-body text-xs text-danger">{error}</p> : null}
    </div>
  );
}
