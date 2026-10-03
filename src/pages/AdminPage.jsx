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
import { Av } from "../components/Shared";

const formatTimeInput = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

function AdminPanel() {
  const { db, me, A, open } = useC();
  const isAdmin = me?.isAdmin;
  const [settings, setSettings] = useState({
    enabled: true,
    start: "08:00",
    end: "22:00",
    usageLimitMinutes: 30,
    cooldownMinutes: 10,
    timezone: "Asia/Tashkent",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [loginActivities, setLoginActivities] = useState([]);
  const [moderationItems, setModerationItems] = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/plat/settings/", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Sozlamalarni olishda xatolik");
        setSettings(data);
      })
      .catch((error) => setSettingsError(error.message));
    fetch("/plat/login-activity/", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return;
        setLoginActivities(await response.json());
      })
      .catch(() => {});
    fetch("/plat/moderation/", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return;
        setModerationItems(await response.json());
      })
      .catch(() => {});
  }, [isAdmin]);

  if (!isAdmin) return null;

  const saveSettings = async (event) => {
    event.preventDefault();
    setSettingsSaving(true);
    setSettingsError("");
    try {
      const token = await ensureCsrfToken();
      const response = await fetch("/plat/settings/", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRFToken": token },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Sozlamalarni saqlab bo‘lmadi");
      setSettings(data);
      const accessResponse = await fetch("/plat/access/", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const accessData = accessResponse.ok ? await accessResponse.json() : data;
      A.updateAccessInfo(accessData);
      A.toast("Ilova vaqtlari saqlandi ✓");
    } catch (error) {
      setSettingsError(error.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const removeUser = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    await A.deleteUser(removeTarget.id);
    setRemoving(false);
    setRemoveTarget(null);
  };

  const reviewModeration = async (item, action, days) => {
    try {
      const token = await ensureCsrfToken();
      const response = await fetch(`/plat/moderation/${item.id}/`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRFToken": token },
        body: JSON.stringify({ action, days }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Tekshiruvni saqlab bo‘lmadi");
      setModerationItems((items) =>
        items.filter((report) => report.id !== item.id),
      );
      A.toast(
        action === "restrict"
          ? `${item.username} ${days} kunga cheklab qo‘yildi`
          : item.type === "reel_report"
            ? action === "approve"
              ? "Shikoyat yopildi"
              : "Reels o‘chirildi"
            : action === "approve"
              ? "Kontent tasdiqlandi"
              : "Kontent rad etildi",
      );
    } catch (error) {
      A.toast(error.message);
    }
  };

  const users = [...db.users].sort((a, b) =>
    a.username.localeCompare(b.username),
  );
  const posts = [...db.posts].sort((a, b) => b.t - a.t);
  const reels = [...db.reels].sort((a, b) => b.t - a.t);
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 text-neutral-900 dark:text-neutral-100">
      <div className="mb-8 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-black dark:text-white">
            Admin panel
          </p>
          <h1 className="text-3xl font-bold">Barcha ma’lumotlar</h1>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm font-semibold dark:border-[#263756] dark:bg-[#17223b]">
          {me?.username}
        </div>
      </div>

      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-[#1d2a45] dark:bg-[#101a30]">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Ilova vaqt sozlamalari</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Toshkent vaqti bo‘yicha umumiy jadval va foydalanish limitini
              boshqaring.
            </p>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold dark:bg-[#17223b]">
            {settings.timezone}
          </span>
        </div>
        <form
          onSubmit={saveSettings}
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
        >
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>Ochilish vaqti</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="00:00"
              value={settings.start}
              onChange={(e) =>
                setSettings((v) => ({
                  ...v,
                  start: formatTimeInput(e.target.value),
                }))
              }
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 outline-none dark:border-[#263756] dark:bg-[#17223b]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>Yopilish vaqti</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              placeholder="00:00"
              value={settings.end}
              onChange={(e) =>
                setSettings((v) => ({
                  ...v,
                  end: formatTimeInput(e.target.value),
                }))
              }
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 outline-none dark:border-[#263756] dark:bg-[#17223b]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>Foydalanish limiti (daq.)</span>
            <input
              type="number"
              min="1"
              max="1440"
              value={settings.usageLimitMinutes}
              onChange={(e) =>
                setSettings((v) => ({
                  ...v,
                  usageLimitMinutes: e.target.value,
                }))
              }
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 outline-none dark:border-[#263756] dark:bg-[#17223b]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>Tanaffus (daq.)</span>
            <input
              type="number"
              min="1"
              max="1440"
              value={settings.cooldownMinutes}
              onChange={(e) =>
                setSettings((v) => ({ ...v, cooldownMinutes: e.target.value }))
              }
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 outline-none dark:border-[#263756] dark:bg-[#17223b]"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={settingsSaving}
              className="w-full rounded-xl bg-black px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              {settingsSaving ? "Saqlanmoqda..." : "Saqlash"}{" "}
            </button>
          </div>
        </form>
        <label className="mt-4 flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) =>
              setSettings((v) => ({ ...v, enabled: e.target.checked }))
            }
            className="h-4 w-4"
          />
          Ilovani vaqt jadvali bo‘yicha ishlatish
        </label>
        {settingsError && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-300">
            {settingsError}
          </p>
        )}
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-[#1d2a45] dark:bg-[#101a30]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Media tekshiruv navbati</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Rasm/video va 18+ deb belgilangan matnlar.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
            {moderationItems.length} ta
          </span>
        </div>
        <div className="space-y-3">
          {moderationItems.length ? (
            moderationItems.map((item) => {
              const content = item.content || {};
              const media = content.image || content.media || content.src;
              const video =
                typeof media === "string" && media.startsWith("data:video/");
              const audio =
                typeof media === "string" && media.startsWith("data:audio/");
              const isReelReport = item.type === "reel_report";
              const reportReasons = {
                adult: "18+ kontent",
                violence: "Zo‘ravonlik",
                harassment: "Haqorat yoki nafrat",
                spam: "Spam yoki aldov",
                other: "Boshqa",
              };
              return (
                <article
                  key={item.id}
                  className="grid gap-4 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="flex min-w-0 gap-3">
                    {media &&
                      (audio ? (
                        <audio src={media} controls className="w-56 shrink-0" />
                      ) : video ? (
                        <video
                          src={media}
                          controls
                          className="max-h-40 w-28 shrink-0 rounded-lg bg-black object-contain"
                        />
                      ) : (
                        <img
                          src={media}
                          alt="Tekshirilayotgan media"
                          className="max-h-40 w-28 shrink-0 rounded-lg bg-neutral-100 object-contain dark:bg-neutral-900"
                        />
                      ))}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <b>{item.username}</b>
                        <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs capitalize dark:bg-neutral-800">
                          {isReelReport ? "Reels shikoyati" : item.type}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {item.time}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                        {content.caption ||
                          content.text ||
                          "Matn biriktirilmagan"}
                      </p>
                      {isReelReport && (
                        <p className="mt-1 text-xs text-neutral-500">
                          Shikoyat yuborgan: {content.reportedBy}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                        {reportReasons[content.reportReason] || item.reason}
                      </p>
                      {content.reportDetails && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-600 dark:text-neutral-300">
                          {content.reportDetails}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                    <button
                      type="button"
                      onClick={() => reviewModeration(item, "approve")}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      {isReelReport ? "Shikoyatni yopish" : "Tasdiqlash"}
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewModeration(item, "reject")}
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      {isReelReport ? "Reelsni o‘chirish" : "Rad etish"}
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewModeration(item, "restrict", 3)}
                      className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950/30"
                    >
                      18+ · 3 kun
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewModeration(item, "restrict", 4)}
                      className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950/30"
                    >
                      18+ · 4 kun
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <p className="py-8 text-center text-sm text-neutral-500">
              Tekshiruv kutilayotgan kontent yo‘q.
            </p>
          )}
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-[#1d2a45] dark:bg-[#101a30]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Kirishlar tarixi</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Kim, qachon va qaysi qurilmadan kirganini ko‘ring.
            </p>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold dark:bg-[#17223b]">
            Oxirgi 100 ta
          </span>
        </div>
        <div className="max-h-[360px] space-y-2 overflow-y-auto">
          {loginActivities.length ? (
            loginActivities.map((activity) => (
              <div
                key={activity.id}
                className="grid gap-2 rounded-xl border border-neutral-200 px-3 py-3 text-sm dark:border-[#263756] sm:grid-cols-[1.2fr_1fr_1fr_1.5fr] sm:items-center"
              >
                <div>
                  <b className="block">{activity.username}</b>
                  <span className="text-xs text-neutral-500">
                    {activity.time}
                  </span>
                </div>
                <span className="text-neutral-500">{activity.device}</span>
                <span className="text-neutral-500">IP: {activity.ip}</span>
                <span
                  className="truncate text-xs text-neutral-500"
                  title={activity.userAgent}
                >
                  {activity.userAgent || "Brauzer ma’lumoti yo‘q"}
                </span>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-neutral-500">
              Hozircha kirishlar tarixi yo‘q.
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-[#1d2a45] dark:bg-[#101a30]">
          <h2 className="mb-4 text-xl font-bold">Foydalanuvchilar ro‘yxati</h2>
          <div className="max-h-[420px] space-y-3 overflow-y-auto">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <div className="flex items-center gap-3">
                  <Av u={user} s={42} />
                  <div>
                    <button
                      type="button"
                      onClick={() => open.profile(user.id)}
                      className="font-semibold hover:text-[#f5a400]"
                    >
                      {user.username}
                    </button>
                    <div className="text-sm text-neutral-500">
                      {user.name || "No name"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${user.username === "admin" ? "bg-blue-500 text-white" : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"}`}
                  >
                    {user.username === "admin" ? "Admin" : "User"}
                  </span>
                  {user.username !== "admin" && (
                    <button
                      onClick={() => setRemoveTarget(user)}
                      className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300"
                    >
                      <Trash2 size={14} className="inline mr-1" />
                      O‘chirish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-[#1d2a45] dark:bg-[#101a30]">
          <h2 className="mb-4 text-xl font-bold">Postlar ro‘yxati</h2>
          <div className="max-h-[420px] space-y-3 overflow-y-auto">
            {posts.map((post) => {
              const owner = users.find((user) => user.id === post.userId);
              return (
                <div
                  key={post.id}
                  className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">
                      {owner?.username || post.userId}
                    </span>
                    <span className="text-neutral-500">
                      {post.likes?.length || 0} like
                    </span>
                  </div>
                  <div className="line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">
                    {post.caption || "No caption"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-[#1d2a45] dark:bg-[#101a30]">
          <h2 className="mb-4 text-xl font-bold">Reels ro‘yxati</h2>
          <div className="max-h-[420px] space-y-3 overflow-y-auto">
            {reels.map((reel) => {
              const owner = users.find((user) => user.id === reel.userId);
              return (
                <div
                  key={reel.id}
                  className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">
                      {owner?.username || reel.userId}
                    </span>
                    <span className="text-neutral-500">
                      {reel.likes?.length || 0} like
                    </span>
                  </div>
                  <div className="line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">
                    {reel.caption || "No caption"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      {removeTarget && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) =>
            event.target === event.currentTarget &&
            !removing &&
            setRemoveTarget(null)
          }
        >
          <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-2xl dark:border-[#263756] dark:bg-[#101a30] dark:text-white">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
              <Trash2 size={21} />
            </div>
            <h2 className="text-lg font-bold">Userni o‘chirish</h2>
            <p className="mt-2 text-sm leading-5 text-neutral-500 dark:text-neutral-400">
              <b className="text-neutral-800 dark:text-neutral-200">
                {removeTarget.username}
              </b>{" "}
              foydalanuvchisini va uning ma’lumotlarini o‘chirishni xohlaysizmi?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={removing}
                onClick={() => setRemoveTarget(null)}
                className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-semibold hover:bg-neutral-100 dark:border-[#263756] dark:hover:bg-[#17223b]"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={removeUser}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {removing ? "O‘chirilmoqda..." : "O‘chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
