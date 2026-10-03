import { Compass, Plus } from "lucide-react";
import { useC } from "../context/AppContext";
import { Av, FollowBtn, PostCard, HomeReelCard } from "../components/Shared";

function HomePage() {
  const { db, me, open, feed, suggestions } = useC();
  const now = Date.now();
  const oneDayAgo = now - 864e5;
  const homeItems = [
    ...feed.map((item) => ({ ...item, kind: "post" })),
    ...db.reels
      .filter(
        (r) =>
          r.userId === me.id ||
          db.follows.some((f) => f.a === me.id && f.b === r.userId),
      )
      .map((item) => ({ ...item, kind: "reel" })),
  ].sort((a, b) => b.t - a.t);
  const activeStories = db.stories.filter((s) => s.t > oneDayAgo);
  const storyUsers = [
    me,
    ...db.follows
      .filter((f) => f.a === me.id)
      .map((f) => db.users.find((u) => u.id === f.b))
      .filter(Boolean),
  ].filter(
    (u) => u.id === me.id || activeStories.some((s) => s.userId === u.id),
  );
  return (
    <div className="mx-auto flex max-w-[935px] justify-center gap-16 px-0 pt-2 sm:px-3 lg:pt-5">
      <section className="ig-feed w-full max-w-[630px]">
        {storyUsers.length > 0 && (
          <div className="ig-story-strip mb-3 p-3">
            <div className="no-scrollbar flex gap-4 overflow-x-auto">
              {storyUsers.map((u) => {
                const us = activeStories.filter((s) => s.userId === u.id);
                const unseen = us.some(
                  (s) =>
                    !db.seenStories.some(
                      (v) => v.viewerId === me.id && v.storyId === s.id,
                    ),
                );
                return (
                  <div
                    key={u.id}
                    className="relative w-[66px] shrink-0 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        us.length ? open.story(us[0].id) : open.createStory()
                      }
                      className="flex w-full flex-col items-center gap-1"
                    >
                      <Av u={u} s={56} ring={u.id !== me.id && unseen} />
                      <span className="w-full truncate text-center">
                        {u.id === me.id ? "Sizning" : u.username}
                      </span>
                    </button>
                    {u.id === me.id && (
                      <button
                        type="button"
                        aria-label="Yangi story qo‘shish"
                        onClick={open.createStory}
                        className="absolute right-0 top-7 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-black text-white dark:border-[#0b1224] dark:bg-white dark:text-black"
                      >
                        <Plus size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {homeItems.length ? (
          homeItems.map((item) =>
            item.kind === "reel" ? (
              <HomeReelCard key={`reel-${item.id}`} r={item} />
            ) : (
              <PostCard key={item.id} p={item} />
            ),
          )
        ) : (
          <div className="mt-10 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-current">
              <Compass size={38} />
            </div>
            <h2 className="mt-4 text-xl font-semibold">
              Hozircha postlar yo‘q
            </h2>
            <p className="mt-1 text-neutral-500">
              Odamlarni follow qiling yoki o‘zingiz birinchi postni joylang.
            </p>
          </div>
        )}
      </section>
      <aside className="hidden w-[320px] pt-7 lg:block">
        <div className="flex items-center gap-3">
          <button onClick={() => open.profile(me.id)}>
            <Av u={me} s={56} />
          </button>
          <div className="min-w-0 flex-1">
            <b className="block truncate text-sm">{me.username}</b>
            <span className="text-sm text-neutral-500">{me.name}</span>
          </div>
        </div>
        <div className="mb-3 mt-6 text-sm font-semibold text-neutral-500">
          Siz uchun takliflar
        </div>
        {suggestions.length ? (
          suggestions.slice(0, 6).map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-2">
              <button onClick={() => open.profile(u.id)}>
                <Av u={u} s={40} />
              </button>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm">{u.username}</b>
                <span className="block truncate text-xs text-neutral-500">
                  {u.name}
                </span>
              </div>
              <FollowBtn id={u.id} />
            </div>
          ))
        ) : (
          <p className="text-sm text-neutral-500">
            Boshqa foydalanuvchilar hali yo‘q.
          </p>
        )}
      </aside>
    </div>
  );
}

export default HomePage;
