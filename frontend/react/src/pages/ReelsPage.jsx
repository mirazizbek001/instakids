import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Play } from "lucide-react";
import { useC } from "../context/AppContext";
import { ReelsCard } from "../components/Shared";

function ReelsPage() {
  const { db, reelId } = useC();
  const box = useRef(null);
  const reels = db.reels.slice().sort((a, b) => b.t - a.t);
  if (reelId) {
    const selected = db.reels.find((r) => r.id === reelId);
    if (selected) {
      const rest = reels.filter((r) => r.id !== reelId);
      reels.splice(0, reels.length, selected, ...rest);
    }
  }
  const go = (d) =>
    box.current?.scrollBy({
      top: d * box.current.clientHeight,
      behavior: "smooth",
    });
  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName)) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div
      ref={box}
      className="reels-page h-[calc(100dvh-56px)] snap-y snap-mandatory overflow-y-auto no-scrollbar md:h-screen"
    >
      {reels.length ? (
        reels.map((r) => <ReelsCard key={r.id} r={r} />)
      ) : (
        <div className="grid h-full place-items-center text-center text-current">
          <div>
            <Play size={64} className="mx-auto mb-3" />
            <h2 className="text-xl font-bold">Hali Reels yo‘q</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Birinchi Reels videosini qo‘shing.
            </p>
          </div>
        </div>
      )}
      {reels.length > 1 && (
        <div className="fixed right-4 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-3 md:flex">
          <button
            onClick={() => go(-1)}
            aria-label="Oldingi Reels"
            className="grid h-10 w-10 place-items-center rounded-full bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600"
          >
            <ChevronUp size={22} />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Keyingi Reels"
            className="grid h-10 w-10 place-items-center rounded-full bg-neutral-200 text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600"
          >
            <ChevronDown size={22} />
          </button>
        </div>
      )}
    </div>
  );
}

export default ReelsPage;
