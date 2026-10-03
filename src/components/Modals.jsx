import { useC } from "../context/AppContext";
import {
  PostModal,
  StoryViewer,
  Create,
  CreateChooser,
  CreateReel,
  CreateStory,
} from "./Shared";
import { Clock3 } from "lucide-react";

export default function Modals() {
  const {
    db,
    serviceOpen,
    accessInfo,
    toast,
    postId,
    setPostId,
    storyId,
    setStoryId,
    createPost,
    setCreatePost,
    create,
    setCreate,
    createReel,
    setCreateReel,
    createStory,
    setCreateStory,
  } = useC();
  const now = Date.now();
  const closedForCooldown = accessInfo?.reason === "cooldown";
  const startTime = accessInfo?.start || "08:00";
  const endTime = accessInfo?.end || "22:00";
  const remainingMinutes = Math.ceil(
    (accessInfo?.cooldownSeconds || accessInfo?.cooldownMinutes * 60 || 0) / 60,
  );

  return (
    <>
      {!serviceOpen && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-5 backdrop-blur-md">
          <div className="relative w-full max-w-[390px] overflow-hidden rounded-[28px] border border-neutral-200 bg-white text-neutral-900 shadow-[0_24px_80px_rgba(0,0,0,.28)] dark:border-neutral-800 dark:bg-[#17191c] dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,.55)]">
            <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />
            <div className="p-7 text-center sm:p-8">
              <div className="mx-auto grid h-[74px] w-[74px] place-items-center rounded-[22px] bg-amber-50 text-amber-600 ring-8 ring-amber-50/70 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/5">
                <Clock3 size={34} strokeWidth={1.8} />
              </div>
              <span className="mt-7 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{" "}
                {closedForCooldown ? "Tanaffus" : "Hozircha yopiq"}
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">
                {closedForCooldown ? "Biroz dam oling" : "Keyinroq qayting"}
              </h2>
              <p className="mx-auto mt-2 max-w-[270px] text-sm leading-5 text-neutral-500 dark:text-neutral-400">
                {closedForCooldown
                  ? "Bugungi foydalanish vaqtingiz tugadi. Tez orada yana davom etishingiz mumkin."
                  : "Bolalar platformasi hozir dam olish rejimida."}
              </p>
              <div className="mt-6 flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left dark:border-neutral-800 dark:bg-[#202328]">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    {closedForCooldown ? "Qayta ochiladi" : "Ish vaqti"}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {closedForCooldown
                      ? `${remainingMinutes} daqiqadan so‘ng`
                      : `${startTime} — ${endTime}`}
                  </p>
                </div>
                <p className="text-xs font-medium text-neutral-400">
                  {closedForCooldown ? "Tanaffus" : "Toshkent vaqti"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {postId && <PostModal id={postId} close={() => setPostId(null)} />}
      {storyId &&
        (() => {
          const selected = db.stories.find((s) => s.id === storyId);
          if (!selected) return null;
          const stories = db.stories
            .filter((s) => s.userId === selected.userId && s.t > now - 864e5)
            .sort((a, b) => a.t - b.t);
          const idx = stories.findIndex((s) => s.id === storyId);
          return (
            <StoryViewer
              story={stories[idx] || selected}
              stories={stories.length ? stories : [selected]}
              close={() => setStoryId(null)}
            />
          );
        })()}
      {createPost && <Create close={() => setCreatePost(false)} />}
      {create && (
        <CreateChooser
          close={() => setCreate(false)}
          post={() => {
            setCreate(false);
            setCreatePost(true);
          }}
          reel={() => {
            setCreate(false);
            setCreateReel(true);
          }}
          story={() => {
            setCreate(false);
            setCreateStory(true);
          }}
        />
      )}
      {createReel && <CreateReel close={() => setCreateReel(false)} />}
      {createStory && <CreateStory close={() => setCreateStory(false)} />}
      {toast && (
        <div
          role="status"
          className="toast fixed left-1/2 top-5 z-[130] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-[#263756] bg-[#17223b] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_14px_38px_rgba(2,8,24,.35)] dark:border-[#38517b] dark:bg-[#101a30] md:top-7"
        >
          {toast}
        </div>
      )}
    </>
  );
}
