import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Compass,
  Heart,
  Home,
  ImagePlus,
  KeyRound,
  LogOut,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Pencil,
  PlusSquare,
  Search,
  Send,
  Share2,
  Smile,
  Sun,
  Trash2,
  User,
  X,
  ChevronLeft,
  Grid3X3,
  Check,
  Play,
  Plus,
  Users,
  Volume2,
  VolumeX,
  Camera,
  Settings,
  Contact,
} from "lucide-react";
import {
  useC,
  kidsUnsafeFile,
  kidsUnsafeText,
  readMedia,
  readImg,
  ago,
  hm,
  seg,
  EMO,
  ensureCsrfToken,
  csrfToken,
} from "../context/AppContext";
import { Av, FollowBtn } from "../components/Shared";

function Notifs() {
  const { db, me, open, A } = useC();
  const list = db.notifs
    .filter((n) => n.to === me.id)
    .sort((a, b) => b.t - a.t);
  const usersById = new Map(db.users.map((user) => [user.id, user]));
  const postsById = new Map(db.posts.map((post) => [post.id, post]));
  const reelsById = new Map(db.reels.map((reel) => [reel.id, reel]));
  const storiesById = new Map(db.stories.map((story) => [story.id, story]));
  useEffect(() => {
    A.readNotifs();
  }, [list.length]);
  const txt = {
    follow: "sizni follow qilishni boshladi.",
    like: "postingizni yoqtirdi.",
    story_like: "Story’ingizni yoqtirdi.",
    comment: "izoh qoldirdi:",
  };
  return (
    <div className="mx-auto max-w-[600px] px-4 py-8">
      <h1 className="mb-5 text-2xl font-bold">Bildirishnomalar</h1>
      {list.map((n) => {
        const u = usersById.get(n.from),
          p = postsById.get(n.postId),
          reel = reelsById.get(n.reelId),
          story = storiesById.get(n.storyId);
        if (!u) return null;
        return (
          <div
            key={n.id}
            className={`flex items-center gap-3 rounded-xl p-3 ${n.read ? "" : "bg-blue-50 dark:bg-blue-950/30"}`}
          >
            <button onClick={() => open.profile(u.id)}>
              <Av u={u} s={44} />
            </button>
            <p className="min-w-0 flex-1 text-sm">
              <b>{u.username}</b> {txt[n.type]}{" "}
              {n.type === "comment" && <span>{n.text}</span>}{" "}
              <span className="text-neutral-500">{ago(n.t)}</span>
            </p>
            {n.type === "follow" ? (
              <FollowBtn id={u.id} />
            ) : n.type === "story_like" && story ? (
              <button
                onClick={() => open.story(story.id)}
                className="grid h-11 w-11 place-items-center rounded bg-neutral-200 dark:bg-neutral-800"
              >
                {story.type === "video" ? (
                  <Play size={18} />
                ) : (
                  <img
                    src={story.media}
                    alt=""
                    className="h-full w-full rounded object-cover"
                  />
                )}
              </button>
            ) : reel ? (
              <button
                onClick={() => open.reel(reel.id)}
                className="grid h-11 w-11 place-items-center rounded bg-neutral-200 dark:bg-neutral-800"
              >
                <Play size={18} />
              </button>
            ) : (
              p && (
                <button onClick={() => open.post(p.id)}>
                  <img
                    src={p.image}
                    alt=""
                    className="h-11 w-11 rounded object-cover"
                  />
                </button>
              )
            )}
          </div>
        );
      })}
      {!list.length && (
        <div className="py-24 text-center text-neutral-500">
          <Heart size={48} className="mx-auto mb-3" strokeWidth={1.3} />
          Hozircha bildirishnomalar yo‘q.
          <br />
          Kimdir sizni follow qilsa yoki postingizni yoqtirsa shu yerda chiqadi.
        </div>
      )}
    </div>
  );
}

export default Notifs;
