import { useState } from "react";
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
  Phone,
  PlusSquare,
  Search,
  Send,
  Share2,
  Smile,
  Sun,
  Trash2,
  User,
  Video,
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
} from "lucide-react";
import { useC } from "../context/AppContext";
import {
  Av,
  FollowBtn,
  Modal,
  Grid,
  EditProfile,
  ChangePassword,
} from "../components/Shared";

function Profile({ id, goChat }) {
  const { db, me, byId, A, open, dark } = useC();
  const u = byId(id);
  const [tab, setTab] = useState("posts");
  const [edit, setEdit] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [blockedListOpen, setBlockedListOpen] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  const [connectionList, setConnectionList] = useState(null);
  const [connectionSearch, setConnectionSearch] = useState("");
  const now = Date.now();
  const oneDayAgo = now - 864e5;
  if (!u)
    return (
      <p className="py-24 text-center text-neutral-500">
        Foydalanuvchi topilmadi.
      </p>
    );
  const own = u.id === me.id;
  const connectionHidden =
    !own &&
    (db.blockedUsers.includes(u.id) || db.blockedByUsers.includes(u.id));
  const posts = db.posts
    .filter((p) => p.userId === u.id)
    .sort((a, b) => b.t - a.t);
  const savedPosts = (db.saved[me.id] || [])
    .map(
      (i) =>
        db.posts.find((p) => p.id === i) ||
        (db.reels.find((r) => r.id === i)
          ? { ...db.reels.find((r) => r.id === i), kind: "reel" }
          : null),
    )
    .filter(Boolean);
  const fers = db.follows.filter((f) => f.b === u.id).length,
    fing = db.follows.filter((f) => f.a === u.id).length;
  const followingUsers = db.follows
    .filter((f) => f.a === u.id)
    .map((f) => byId(f.b))
    .filter(Boolean);
  const followerUsers = db.follows
    .filter((f) => f.b === u.id)
    .map((f) => byId(f.a))
    .filter(Boolean);
  const connectionUsers = (
    connectionList === "followers" ? followerUsers : followingUsers
  ).filter((user) =>
    `${user.username} ${user.name || ""}`
      .toLowerCase()
      .includes(connectionSearch.trim().toLowerCase()),
  );
  const ownStories = db.stories
    .filter((story) => story.userId === u.id && story.t > oneDayAgo)
    .sort((a, b) => a.t - b.t);
  const profileReels = db.reels
    .filter((reel) => reel.userId === u.id)
    .sort((a, b) => b.t - a.t);
  const visiblePosts =
    tab === "saved" ? savedPosts : tab === "posts" ? posts : [];
  const tabs = [
    ["posts", Grid3X3, "POSTLAR"],
    ["reels", Play, "REELS"],
    ...(own ? [["saved", Bookmark, "SAQLANGAN"]] : []),
  ];
  return (
    <div className="profile-page mobile-profile mx-auto px-4 py-5 sm:py-10">
      <div className="flex items-center gap-6 sm:gap-20">
        <div className="shrink-0 sm:pl-8">
          <Av u={u} s={window.innerWidth < 640 ? 84 : 150} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <h1 className="text-xl font-normal">{u.username}</h1>
            {own && (
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button
                  onClick={open.create}
                  aria-label="Post qo‘shish"
                  title="Post qo‘shish"
                  className="p-1"
                >
                  <PlusSquare size={22} />
                </button>
                <div className="relative">
                  <button
                    aria-label="Sozlamalar"
                    title="Sozlamalar"
                    aria-expanded={settingsOpen}
                    onClick={() => setSettingsOpen((value) => !value)}
                    className="p-1"
                  >
                    <Settings size={22} />
                  </button>
                  {settingsOpen && (
                    <div className="absolute right-0 top-full z-50 mt-3 w-64 overflow-hidden rounded-xl border border-[#38517b] bg-[#17223b] py-2 text-white shadow-2xl">
                      <button
                        onClick={() => {
                          setSettingsOpen(false);
                          setEdit(true);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[#263756]"
                      >
                        <Pencil size={17} /> Profilni tahrirlash
                      </button>
                      <button
                        onClick={() => {
                          setSettingsOpen(false);
                          setChangePassword(true);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[#263756]"
                      >
                        <KeyRound size={17} /> Parolni o‘zgartirish
                      </button>
                      <button
                        onClick={() => {
                          setSettingsOpen(false);
                          setBlockedListOpen(true);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[#263756]"
                      >
                        <X size={17} /> Bloklanganlar ro‘yxati{" "}
                        <span className="ml-auto text-xs text-neutral-400">
                          {db.blockedUsers.length}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          A.toggleTheme();
                          setSettingsOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[#263756]"
                      >
                        {dark ? <Sun size={17} /> : <Moon size={17} />}{" "}
                        {dark ? "Yorug‘ rejim" : "Tungi rejim"}
                      </button>
                      <button
                        onClick={() => {
                          setSettingsOpen(false);
                          A.logout();
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[#263756]"
                      >
                        <LogOut size={17} /> Chiqish
                      </button>
                      <button
                        onClick={async () => {
                          if (
                            window.confirm(
                              "Akkauntingizni butunlay o‘chirishni xohlaysizmi?",
                            )
                          ) {
                            setSettingsOpen(false);
                            await A.deleteAccount();
                          }
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 size={17} /> Akkauntni o‘chirish
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="my-3 flex gap-3 text-[13px] sm:my-5 sm:gap-10 sm:text-[15px]">
            <span>
              <b>{posts.length}</b> ta post
            </span>
            {connectionHidden ? (
              <span className="text-neutral-500">
                Follow ma’lumotlari yopiq
              </span>
            ) : (
              <>
                <button
                  onClick={() => {
                    setConnectionList("followers");
                    setConnectionSearch("");
                  }}
                  className="cursor-pointer"
                >
                  <b>{fers}</b> follower
                </button>
                <button
                  onClick={() => {
                    setConnectionList("following");
                    setConnectionSearch("");
                  }}
                  className="cursor-pointer"
                >
                  <b>{fing}</b> following
                </button>
              </>
            )}
          </div>
          <div className="profile-inline-bio text-sm">
            <b>{u.name}</b>
            {u.bio && <p className="whitespace-pre-line">{u.bio}</p>}
          </div>
        </div>
      </div>
      <div className="profile-mobile-bio mt-3 px-4 text-sm">
        <b>{u.name}</b>
        {u.bio && <p className="whitespace-pre-line">{u.bio}</p>}
      </div>
      {own ? (
        <div className="mt-4 flex w-full gap-2 sm:mt-5 sm:max-w-[680px]">
          <button
            onClick={() => setEdit(true)}
            className="h-11 flex-1 rounded-lg bg-neutral-200 px-3 text-sm font-semibold dark:bg-[#17223b]"
          >
            Profilni tahrirlash
          </button>
          <button
            onClick={() => setTab("saved")}
            className="h-11 flex-1 rounded-lg bg-neutral-200 px-3 text-sm font-semibold dark:bg-[#17223b]"
          >
            Arxivni ko‘rish
          </button>
        </div>
      ) : (
        <div className="mt-4 flex w-full gap-2 sm:mt-5 sm:max-w-[680px]">
          <div className="flex-1 [&>button]:h-11 [&>button]:w-full">
            <FollowBtn id={u.id} big />
          </div>
          <button
            onClick={() => goChat(u.id)}
            className="h-11 flex-1 rounded-lg bg-neutral-200 px-4 text-sm font-semibold dark:bg-[#17223b]"
          >
            Xabar
          </button>
          <button
            onClick={() => A.startCall(u.id, "audio")}
            disabled={connectionHidden}
            aria-label="Audio qo‘ng‘iroq"
            title="Audio qo‘ng‘iroq"
            className="h-11 w-11 rounded-lg bg-emerald-500/10 px-2 text-emerald-600 transition hover:bg-emerald-500/15 disabled:opacity-40 dark:text-emerald-400"
          >
            <Phone size={18} className="mx-auto" />
          </button>
          <button
            onClick={() => A.startCall(u.id, "video")}
            disabled={connectionHidden}
            aria-label="Video qo‘ng‘iroq"
            title="Video qo‘ng‘iroq"
            className="h-11 w-11 rounded-lg bg-amber-500/10 px-2 text-amber-600 transition hover:bg-amber-500/15 disabled:opacity-40 dark:text-amber-400"
          >
            <Video size={18} className="mx-auto" />
          </button>
        </div>
      )}
      {(own || ownStories.length > 0) && (
        <div className="mt-8 flex min-h-[126px] items-start gap-8 sm:mt-10 sm:pl-4">
          <button
            onClick={() =>
              ownStories.length
                ? open.story(ownStories[0].id)
                : open.createStory()
            }
            className="flex w-[76px] shrink-0 flex-col items-center gap-2 text-xs"
          >
            <span
              className={`grid h-[76px] w-[76px] place-items-center rounded-full border-[3px] ${ownStories.length ? "story-ring" : "border-neutral-200 dark:border-[#26292d]"}`}
            >
              <span className="grid h-[66px] w-[66px] place-items-center rounded-full bg-neutral-100 dark:bg-[#17191c]">
                {ownStories.length ? (
                  <Av u={u} s={60} />
                ) : (
                  <Plus
                    size={34}
                    strokeWidth={1.5}
                    className="text-neutral-500"
                  />
                )}
              </span>
            </span>
            <span className="font-semibold">
              {ownStories.length ? "Story" : "Yangi"}
            </span>
          </button>
        </div>
      )}
      <div className="mt-5 flex justify-around border-t border-neutral-200 dark:border-neutral-800 sm:mt-6">
        {tabs.map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-label={label}
            className={`-mt-px flex min-w-20 items-center justify-center gap-2 border-t py-3.5 text-xs font-semibold tracking-widest ${tab === key ? "border-current" : "border-transparent text-neutral-500"}`}
          >
            <Icon size={18} /> <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
      {tab === "reels" ? (
        profileReels.length ? (
          <div className="grid grid-cols-3 gap-1 sm:gap-5">
            {profileReels.map((reel) => (
              <button
                key={reel.id}
                onClick={() => open.reel(reel.id)}
                className="group relative aspect-square overflow-hidden bg-black"
              >
                <video
                  src={reel.media}
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
                <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                  <Play size={34} fill="currentColor" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-neutral-500">
            <Play size={44} className="mx-auto mb-3" strokeWidth={1.3} />
            Hali Reels yo‘q
          </div>
        )
      ) : visiblePosts.length ? (
        <Grid posts={visiblePosts} />
      ) : tab === "posts" && own ? null : (
        <div className="py-20 text-center text-neutral-500">
          <ImagePlus size={44} className="mx-auto mb-3" strokeWidth={1.2} />
          Saqlangan postlar yo‘q
        </div>
      )}
      {edit && <EditProfile close={() => setEdit(false)} />}
      {changePassword && (
        <ChangePassword close={() => setChangePassword(false)} />
      )}
      {blockedListOpen && (
        <Modal close={() => setBlockedListOpen(false)}>
          <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="font-semibold">Bloklanganlar</h2>
            <button
              onClick={() => setBlockedListOpen(false)}
              aria-label="Yopish"
            >
              <X size={20} />
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-3">
            {db.blockedUsers.length ? (
              db.blockedUsers.map((userId) => {
                const user = byId(userId);
                if (!user) return null;
                return (
                  <div
                    key={userId}
                    className="flex items-center gap-3 rounded-lg px-2 py-2"
                  >
                    <button
                      onClick={() => {
                        setBlockedListOpen(false);
                        open.profile(userId);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Av u={user} s={42} />
                      <span className="min-w-0">
                        <b className="block truncate text-sm">
                          {user.username}
                        </b>
                        <span className="block truncate text-xs text-neutral-500">
                          {user.name}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => A.setUserBlocked(userId, false)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      Blokdan chiqarish
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="py-8 text-center text-sm text-neutral-500">
                Bloklangan foydalanuvchilar yo‘q.
              </p>
            )}
          </div>
        </Modal>
      )}
      {connectionList && !connectionHidden && (
        <Modal close={() => setConnectionList(null)}>
          <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="font-semibold">
              {connectionList === "followers" ? "Followers" : "Following"}
            </h2>
            <button onClick={() => setConnectionList(null)} aria-label="Yopish">
              <X size={20} />
            </button>
          </div>
          <label className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-neutral-100 px-3 dark:bg-neutral-800">
            <Search size={18} className="shrink-0 text-neutral-500" />
            <input
              value={connectionSearch}
              onChange={(e) => setConnectionSearch(e.target.value)}
              placeholder="Qidirish"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
            />
          </label>
          <div className="max-h-[55vh] overflow-y-auto no-scrollbar p-3">
            {connectionUsers.length ? (
              connectionUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <button
                    onClick={() => {
                      setConnectionList(null);
                      open.profile(user.id);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <Av u={user} s={42} />
                    <span className="min-w-0">
                      <b className="block truncate text-sm">{user.username}</b>
                      <span className="block truncate text-xs text-neutral-500">
                        {user.name}
                      </span>
                    </span>
                  </button>
                  <FollowBtn id={user.id} />
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-neutral-500">
                {connectionSearch
                  ? "Qidiruv bo‘yicha foydalanuvchi topilmadi."
                  : `Hozircha ${connectionList === "followers" ? "followers" : "following"} yo‘q.`}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default Profile;
