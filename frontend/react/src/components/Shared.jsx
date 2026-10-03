import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Compass,
  Download,
  Flag,
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
  Eye,
  EyeOff,
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
import brandLogo from "../assets/instakids-logo.png";

function Av({ u, s = 44, ring }) {
  const hue =
    ([...(u?.username || "x")].reduce((a, c) => a + c.charCodeAt(0), 0) * 37) %
    360;
  const inner = u?.avatar ? (
    <img
      src={u.avatar}
      alt=""
      className="rounded-full object-cover"
      style={{ width: s, height: s }}
    />
  ) : (
    <div
      className="grid place-items-center rounded-full font-semibold text-white"
      style={{
        width: s,
        height: s,
        fontSize: s / 2.3,
        background: "linear-gradient(135deg,#3a3a3a,#111)",
      }}
    >
      {(u?.name || u?.username || "?")[0].toUpperCase()}
    </div>
  );
  return ring ? (
    <div className="story-ring shrink-0 rounded-full p-[2.5px]">
      <div className="rounded-full bg-white p-[2px] dark:bg-black">{inner}</div>
    </div>
  ) : (
    <div className="shrink-0">{inner}</div>
  );
}
const Logo = ({ c = "" }) => (
  <span
    className={`font-logo bg-clip-text text-[28px] leading-none ${c}`}
    style={{ fontFamily: '"Grand Hotel",cursive' }}
  >
    InstaVibe
  </span>
);
function FollowBtn({ id, big }) {
  const { A, db, me } = useC();
  if (id === me.id) return null;
  const f = db.follows.some((x) => x.a === me.id && x.b === id);
  return (
    <button
      onClick={() => A.follow(id)}
      className={`rounded-lg font-semibold transition active:scale-95 ${big ? "px-6 py-1.5 text-sm" : "px-4 py-1.5 text-xs"} ${f ? "bg-neutral-200 text-neutral-900 dark:bg-[#263756] dark:text-white" : "bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-[#101a30] dark:hover:bg-neutral-200"}`}
    >
      {f ? "Following" : "Follow"}
    </button>
  );
}
function Modal({ close, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-3 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <button onClick={close} className="absolute right-4 top-4 text-white">
        <X size={28} />
      </button>
      <div
        className={`max-h-[92vh] w-full overflow-hidden rounded-2xl border-t-2 border-t-[#f5a400] bg-white text-neutral-900 shadow-2xl dark:border-x dark:border-b dark:border-[#263756] dark:bg-[#101a30] dark:text-neutral-100 ${wide ? "max-w-[1050px]" : "max-w-[520px]"}`}
      >
        {children}
      </div>
    </div>
  );
}
function EmojiPicker({ onPick, cls = "" }) {
  const [tab, setTab] = useState(Object.keys(EMO)[0]);
  return (
    <div
      className={`z-20 w-[300px] rounded-2xl border border-neutral-200 bg-white p-2 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900 ${cls}`}
    >
      <div className="flex justify-between border-b border-neutral-200 pb-1 dark:border-neutral-700">
        {Object.keys(EMO).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg p-1.5 text-lg ${tab === k ? "bg-neutral-100 dark:bg-neutral-800" : "opacity-60"}`}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="mt-2 grid h-[190px] grid-cols-7 content-start gap-0.5 overflow-y-auto no-scrollbar">
        {seg(EMO[tab]).map((e, i) => (
          <button
            key={i}
            onClick={() => onPick(e)}
            className="rounded-lg p-1 text-[22px] hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Google bilan kirish ---------- */
function GoogleSignIn({ onCredential, onError }) {
  const box = useRef(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [state, setState] = useState("loading"); // loading | ready | off
  useEffect(() => {
    let dead = false;
    const init = async () => {
      let clientId = "";
      try {
        const r = await fetch("/plat/config/", { credentials: "same-origin" });
        clientId = (await r.json()).googleClientId || "";
      } catch {
        /* ignore */
      }
      if (dead) return;
      if (!clientId) {
        setState("off");
        return;
      }
      const render = () => {
        if (dead || !window.google?.accounts?.id || !box.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => cb.current(res.credential),
          ux_mode: "popup",
          use_fedcm_for_prompt: true,
          cancel_on_tap_outside: false,
        });
        box.current.innerHTML = "";
        window.google.accounts.id.renderButton(box.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: Math.min(320, box.current.clientWidth || 320),
          locale: "uz",
        });
        setState("ready");
      };
      if (window.google?.accounts?.id) {
        render();
        return;
      }
      let script = document.getElementById("google-gsi");
      if (!script) {
        script = document.createElement("script");
        script.id = "google-gsi";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
      script.addEventListener("error", () => {
        if (!dead) {
          setState("off");
          onError?.("Google xizmatiga ulanib bo‘lmadi.");
        }
      });
    };
    init();
    return () => {
      dead = true;
    };
  }, []);
  if (state === "off") return null;
  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
        yoki
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
      </div>
      <div ref={box} className="flex min-h-[44px] justify-center" />
    </div>
  );
}

export function PwaInstallButton({ compact = false, iconOnly = false }) {
  const [installPrompt, setInstallPrompt] = useState(
    () => window.__instakidsInstallPrompt || null,
  );
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true,
  );
  const [showHelp, setShowHelp] = useState(false);
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const onInstallPromptAvailable = () => {
      const nextPrompt = window.__instakidsInstallPrompt || null;
      setInstallPrompt(nextPrompt);
    };
    const onInstalled = () => {
      window.__instakidsInstallPrompt = null;
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = (event) => setInstalled(event.matches);

    window.addEventListener(
      "instakids-installprompt",
      onInstallPromptAvailable,
    );
    window.addEventListener("appinstalled", onInstalled);
    displayMode.addEventListener?.("change", onDisplayModeChange);
    return () => {
      window.removeEventListener(
        "instakids-installprompt",
        onInstallPromptAvailable,
      );
      window.removeEventListener("appinstalled", onInstalled);
      displayMode.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      window.__instakidsInstallPrompt = null;
      setInstallPrompt(null);
      if (choice?.outcome === "accepted") setInstalled(true);
      else setShowHelp(true);
    } catch {
      setShowHelp(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={install}
        title="InstaKids ilovasini o‘rnatish"
        aria-label={iconOnly ? "InstaKids ilovasini o‘rnatish" : undefined}
        className={
          iconOnly
            ? "mx-auto grid h-11 w-11 place-items-center rounded-lg bg-[#f5a400] text-black transition hover:bg-amber-400"
            : compact
              ? "inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#f5a400] px-2.5 py-2 text-xs font-bold text-black transition hover:bg-amber-400"
              : "mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#f5a400] px-4 py-3 text-sm font-bold text-black transition hover:bg-amber-400"
        }
      >
        <Download size={iconOnly ? 19 : compact ? 16 : 18} />
        {!iconOnly && (compact ? "O‘rnatish" : "Ilovani telefonga o‘rnatish")}
      </button>
      {showHelp && (
        <div
          role="presentation"
          onClick={() => setShowHelp(false)}
          className="fixed inset-0 z-[130] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-5 text-neutral-900 shadow-2xl dark:border-[#263756] dark:bg-[#101a30] dark:text-white"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="pwa-install-title" className="text-base font-bold">
                InstaKids ilovasini o‘rnatish
              </h2>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                aria-label="Yopish"
                className="rounded-full p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#17223b]"
              >
                <X size={20} />
              </button>
            </div>
            {isIos ? (
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                <li>Saytni Safari’da oching.</li>
                <li>Ulashish tugmasini bosing.</li>
                <li>“Bosh ekranga qo‘shish”ni tanlang.</li>
                <li>“Qo‘shish”ni bosing.</li>
              </ol>
            ) : (
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                <li>Brauzer menyusini (⋮) oching.</li>
                <li>
                  “Ilovani o‘rnatish” yoki “Bosh ekranga qo‘shish”ni tanlang.
                </li>
                <li>O‘rnatishni tasdiqlang.</li>
              </ol>
            )}
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="mt-5 w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black"
            >
              Tushunarli
            </button>
          </section>
        </div>
      )}
    </>
  );
}

/* ---------- auth ---------- */
function Auth({ A, accessInfo }) {
  const [reg, setReg] = useState(false);
  const [f, setF] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
  });
  const [err, setErr] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const postJson = async (url, body) => {
    const send = (token) =>
      fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRFToken": token },
        body: JSON.stringify(body),
      });
    let response = await send(await ensureCsrfToken());
    if (response.status === 403) {
      const result = await response
        .clone()
        .json()
        .catch(() => ({}));
      if (/csrf failed/i.test(result.detail || ""))
        response = await send(await ensureCsrfToken(true));
    }
    return response;
  };
  const go = async (e) => {
    e.preventDefault();
    setErr("");
    if (reg && accessInfo?.open === false) {
      setErr(
        `Platforma yopiq. Admin bo‘lsangiz, “Kirish” rejimini tanlang. Ro‘yxatdan o‘tish ${accessInfo.start || "08:00"}–${accessInfo.end || "22:00"} oralig‘ida mumkin.`,
      );
      return;
    }
    const token = await ensureCsrfToken();
    if (!token) {
      setErr(
        "Server hozir javob bermayapti (ishga tushayotgan bo‘lishi mumkin). Bir necha soniyadan keyin qayta bosing.",
      );
      return;
    }
    if (!reg) {
      try {
        const response = await postJson("/plat/login/", f);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          setErr(
            result.error ||
              result.detail ||
              `Kirishda xatolik (${response.status})`,
          );
          return;
        }
        A.login(f, result);
      } catch {
        setErr(
          "Server bilan bog‘lanib bo‘lmadi. Backend ishga tushganini tekshiring.",
        );
      }
      return;
    }
    const validationError = A.validateRegister(f);
    if (validationError) {
      setErr(validationError);
      return;
    }
    try {
      const response = await postJson("/plat/register/", f);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErr(
          result.error ||
            result.detail ||
            `Ro‘yxatdan o‘tishda xatolik (${response.status})`,
        );
        return;
      }
      A.register(f, result);
    } catch {
      setErr(
        "Server bilan bog‘lanib bo‘lmadi. Backend ishga tushganini tekshiring.",
      );
    }
  };
  const googleGo = async (credential) => {
    setErr("");
    const token = await ensureCsrfToken();
    try {
      const response = await fetch("/plat/google/", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRFToken": token },
        body: JSON.stringify({ credential }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErr(
          result.error ||
            result.detail ||
            `Google orqali kirishda xatolik (${response.status})`,
        );
        return;
      }
      A.login({ username: result.username }, result);
    } catch {
      setErr(
        "Server bilan bog‘lanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.",
      );
    }
  };
  const inp =
    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:ring-neutral-800";
  const accessMessage =
    accessInfo?.reason === "cooldown"
      ? `Vaqt tugadi. ${Math.max(1, Math.ceil((accessInfo.cooldownSeconds || 0) / 60))} daqiqalik tanaffus.`
      : accessInfo?.reason === "hours"
        ? `Ilova ${accessInfo.start || "08:00"} da ochiladi va ${accessInfo.end || "22:00"} da yopiladi.`
        : "";
  return (
    <div className="auth-page grid min-h-screen place-items-center px-4 py-8 text-neutral-900 dark:text-neutral-100">
      <div className="w-full max-w-[390px]">
        <form
          onSubmit={go}
          className="auth-card rounded-3xl border border-neutral-200 bg-white/95 px-7 pb-7 pt-8 shadow-[0_24px_70px_rgba(0,0,0,.12)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 dark:shadow-none sm:px-9"
        >
          <div className="mb-5 text-center">
            <img
              src={brandLogo}
              alt="InstaKids"
              className="mx-auto h-28 w-28 rounded-3xl object-cover shadow-lg"
            />
          </div>
          {accessMessage && (
            <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 text-center text-xs font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              {accessMessage}
            </div>
          )}
          {reg && (
            <p className="mb-4 text-center text-sm font-semibold text-neutral-500">
              Do‘stlaringizning rasm va videolarini ko‘rish uchun ro‘yxatdan
              o‘ting.
            </p>
          )}
          <div className="space-y-2">
            {reg && (
              <input
                className={inp}
                type="email"
                placeholder="Email manzilingiz"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value.trim() })}
              />
            )}
            <input
              className={inp}
              placeholder="Username"
              value={f.username}
              onChange={(e) =>
                setF({
                  ...f,
                  username: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9._]/g, ""),
                })
              }
            />
            {reg && (
              <input
                className={inp}
                placeholder="Ism familiya"
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            )}
            <div className="relative">
              <input
                className={inp + " pr-11"}
                type={showPassword ? "text" : "password"}
                placeholder="Parol"
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button className="mt-4 w-full rounded-lg bg-black dark:bg-white dark:text-black py-2 text-sm font-semibold text-white hover:bg-neutral-800 dark:hover:bg-neutral-200">
            {reg ? "Ro‘yxatdan o‘tish" : "Kirish"}
          </button>
          <GoogleSignIn onCredential={googleGo} onError={setErr} />
          {err && (
            <p className="mt-4 text-center text-sm text-red-500">{err}</p>
          )}
        </form>
        <PwaInstallButton />
        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white/90 p-4 text-center text-sm shadow-sm dark:border-[#263756] dark:bg-[#101a30]">
          {reg ? "Akkauntingiz bormi?" : "Akkauntingiz yo‘qmi?"}{" "}
          <button
            onClick={() => {
              setReg(!reg);
              setErr("");
            }}
            className="font-semibold text-black dark:text-white"
          >
            {reg ? "Kirish" : "Ro‘yxatdan o‘tish"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- posts ---------- */
function PostActions({ p, onComment }) {
  const { A, me, db } = useC();
  const liked = p.likes.includes(me.id);
  const saved = (db.saved[me.id] || []).includes(p.id);
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex gap-4">
        <button
          onClick={() => A.like(p.id)}
          className="transition active:scale-125"
        >
          <Heart
            size={26}
            fill={liked ? "#ef4444" : "none"}
            className={liked ? "text-red-500" : ""}
          />
        </button>
        <button onClick={onComment}>
          <MessageCircle size={26} />
        </button>
        <button
          onClick={() =>
            A.toast("Postni chatda yuborish uchun Messages bo‘limiga o‘ting")
          }
        >
          <Send size={26} />
        </button>
      </div>
      <button onClick={() => A.save(p.id)}>
        <Bookmark size={26} fill={saved ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
function CommentBox({ p, kind = "post", autoFocus = false }) {
  const { A } = useC();
  const [t, setT] = useState("");
  const [em, setEm] = useState(false);
  const send = () => {
    if (t.trim()) {
      A.comment(p.id, t.trim(), kind);
      setT("");
      setEm(false);
    }
  };
  return (
    <div className="relative flex items-center gap-2 border-t border-neutral-200 py-2 dark:border-neutral-800">
      <button onClick={() => setEm(!em)}>
        <Smile size={24} />
      </button>
      <input
        value={t}
        autoFocus={autoFocus}
        maxLength={500}
        onChange={(e) => setT(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && send()}
        placeholder="Izoh qo‘shing..."
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      {t.trim() && (
        <button
          onClick={send}
          className="text-sm font-semibold text-black dark:text-white"
        >
          Post
        </button>
      )}
      {em && (
        <EmojiPicker
          onPick={(e) => setT((v) => v + e)}
          cls="absolute bottom-12 left-0"
        />
      )}
    </div>
  );
}
function PostCard({ p }) {
  const { byId, A, me, open } = useC();
  const u = byId(p.userId);
  const [heart, setHeart] = useState(false);
  const [menu, setMenu] = useState(false);
  const dbl = () => {
    if (!p.likes.includes(me.id)) A.like(p.id);
    setHeart(true);
    setTimeout(() => setHeart(false), 700);
  };
  return (
    <article className="ig-card mb-4 pb-4">
      <div className="relative flex items-center gap-3 py-3">
        <button
          onClick={() => open.profile(u.id)}
          className="flex items-center gap-3"
        >
          <Av u={u} s={34} />
          <b className="text-sm">{u.username}</b>
        </button>
        <span className="text-sm text-neutral-500">• {ago(p.t)}</span>
        <button className="ml-auto" onClick={() => setMenu(!menu)}>
          <MoreHorizontal />
        </button>
        {menu && (
          <div className="absolute right-0 top-10 z-10 w-44 overflow-hidden rounded-xl border bg-white text-sm shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
            {p.userId === me.id && (
              <button
                onClick={() => {
                  A.del(p.id);
                  setMenu(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-3 font-semibold text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Trash2 size={16} /> O‘chirish
              </button>
            )}
            <button
              onClick={() => {
                open.profile(u.id);
                setMenu(false);
              }}
              className="w-full px-4 py-3 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Profilga o‘tish
            </button>
          </div>
        )}
      </div>
      <div
        className="ig-media relative overflow-hidden border border-neutral-200 dark:border-neutral-800 sm:rounded-[3px]"
        onDoubleClick={dbl}
      >
        <img
          src={p.image}
          alt=""
          className="block max-h-[760px] w-full select-none object-cover"
        />
        {heart && (
          <Heart
            size={100}
            fill="white"
            className="pop absolute inset-0 m-auto text-white drop-shadow-2xl"
          />
        )}
      </div>
      <PostActions p={p} onComment={() => open.post(p.id)} />
      {p.likes.length > 0 && (
        <div className="text-sm font-semibold">
          {p.likes.length.toLocaleString()} ta yoqtirish
        </div>
      )}
      {p.caption && (
        <p className="mt-1 text-sm">
          <b className="mr-1">{u.username}</b>
          {p.caption}
        </p>
      )}
      {p.comments.length > 0 && (
        <button
          onClick={() => open.post(p.id)}
          className="mt-1 text-sm text-neutral-500"
        >
          Barcha {p.comments.length} ta izohni ko‘rish
        </button>
      )}
      <CommentBox p={p} />
    </article>
  );
}
function PostModal({ id, close }) {
  const { db, byId, open } = useC();
  const p = db.posts.find((x) => x.id === id);
  if (!p) return null;
  const u = byId(p.userId);
  const row = (x, k) => {
    const c = byId(x.userId);
    return (
      <div key={k} className="flex gap-3 py-2">
        <button
          onClick={() => {
            close();
            open.profile(c.id);
          }}
        >
          <Av u={c} s={32} />
        </button>
        <p className="text-sm">
          <b className="mr-1">{c.username}</b>
          {x.text}
          <span className="block text-xs text-neutral-500">{ago(x.t)}</span>
        </p>
      </div>
    );
  };
  return (
    <Modal close={close} wide>
      <div className="flex max-h-[92vh] flex-col md:h-[640px] md:flex-row">
        <div className="grid shrink-0 place-items-center bg-black md:w-[60%]">
          <img
            src={p.image}
            alt=""
            className="max-h-[50vh] w-full object-contain md:max-h-full"
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4">
          <div className="flex items-center gap-3 border-b border-neutral-200 py-3 dark:border-neutral-800">
            <Av u={u} s={34} />
            <b className="text-sm">{u.username}</b>
            <FollowBtn id={u.id} />
          </div>
          <div className="min-h-[80px] flex-1 overflow-y-auto no-scrollbar">
            {p.caption && row({ userId: u.id, text: p.caption, t: p.t }, "cap")}
            {p.comments.map((c) => row(c, c.id))}
            {!p.caption && !p.comments.length && (
              <p className="py-10 text-center text-neutral-500">
                Hali izohlar yo‘q.
              </p>
            )}
          </div>
          <PostActions p={p} onComment={() => {}} />
          {p.likes.length > 0 && (
            <div className="text-sm font-semibold">
              {p.likes.length} ta yoqtirish
            </div>
          )}
          <div className="pb-1 text-[11px] uppercase text-neutral-500">
            {ago(p.t)}
          </div>
          <CommentBox p={p} />
        </div>
      </div>
    </Modal>
  );
}
function Create({ close }) {
  const { A } = useC();
  const [img, setImg] = useState(null);
  const [cap, setCap] = useState("");
  const [em, setEm] = useState(false);
  return (
    <Modal close={close}>
      <div className="flex items-center justify-between border-b border-neutral-200 p-3 dark:border-neutral-800">
        <b className="mx-auto pl-10">Yangi post yaratish</b>
        {img && (
          <button
            onClick={() => {
              if (A.post(img, cap)) close();
            }}
            className="font-semibold text-black dark:text-white"
          >
            Ulashish
          </button>
        )}
      </div>
      {!img ? (
        <label className="grid h-[420px] cursor-pointer place-items-center text-center">
          <div>
            <ImagePlus size={64} strokeWidth={1.2} className="mx-auto" />
            <div className="mt-4 text-xl">Rasmni tanlang</div>
            <span className="mt-4 inline-block rounded-lg bg-black dark:bg-white dark:text-black px-4 py-2 text-sm font-semibold text-white">
              Qurilmadan tanlash
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files[0];
                if (!f) return;
                const err = kidsUnsafeFile(f);
                if (err) {
                  A.toast(err);
                  return;
                }
                setImg(await readImg(f));
                e.target.value = "";
              }}
            />
          </div>
        </label>
      ) : (
        <div className="relative">
          <img src={img} alt="" className="max-h-[50vh] w-full object-cover" />
          <div className="p-3">
            <textarea
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              placeholder="Izoh yozing..."
              className="h-24 w-full resize-none bg-transparent text-sm outline-none"
            />
            <button onClick={() => setEm(!em)}>
              <Smile size={22} />
            </button>
          </div>
          {em && (
            <EmojiPicker
              onPick={(e) => setCap((v) => v + e)}
              cls="absolute bottom-14 left-3"
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function CreateChooser({ close, post, reel }) {
  return (
    <Modal close={close}>
      <div className="create-chooser bg-white p-5 text-neutral-900 dark:bg-[#101a30] dark:text-white">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-neutral-200 dark:bg-[#38517b]" />
        <h2 className="text-center text-lg font-bold">Yaratish</h2>
        <div className="mt-5 grid gap-3">
          <button
            onClick={post}
            className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left transition hover:scale-[1.01] hover:bg-white dark:border-[#263756] dark:bg-[#17223b] dark:hover:bg-[#1d2d4b]"
          >
            <span className="text-amber-500">
              <ImagePlus />
            </span>
            <span>
              <b className="block">Post</b>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Rasm va caption
              </span>
            </span>
          </button>
          <button
            onClick={reel}
            className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-left transition hover:scale-[1.01] hover:bg-white dark:border-[#263756] dark:bg-[#17223b] dark:hover:bg-[#1d2d4b]"
          >
            <span className="text-blue-500">
              <Play />
            </span>
            <span>
              <b className="block">Reels</b>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Qisqa video
              </span>
            </span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
function StoryViewer({ story, close, stories }) {
  const { db, me, byId, open, A } = useC();
  const u = byId(story.userId);
  const [i, setI] = useState(
    Math.max(
      0,
      stories.findIndex((x) => x.id === story.id),
    ),
  );
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoPaused, setVideoPaused] = useState(false);
  const [reply, setReply] = useState("");
  const [showViewers, setShowViewers] = useState(false);
  const current = stories[i] || story;
  const next = () => (i < stories.length - 1 ? setI(i + 1) : close());
  const prev = () => i > 0 && setI(i - 1);
  useEffect(() => {
    setVideoProgress(0);
    setVideoPaused(false);
  }, [i]);
  useEffect(() => {
    A.viewStory(current.id);
  }, [current.id]);
  useEffect(() => {
    if (current.type === "video") return;
    const timer = setTimeout(next, 6000);
    return () => clearTimeout(timer);
  }, [i, stories.length, current.type]);
  const cu = byId(current.userId) || u;
  const viewers = db.seenStories
    .filter(
      (item) => item.storyId === current.id && item.viewerId !== current.userId,
    )
    .map((item) => byId(item.viewerId))
    .filter(Boolean);
  const liked = (current.likes || []).includes(me.id);
  const reelStory =
    current.sourceReel ||
    (current.type === "video" &&
      db.reels.some((reel) => reel.media === current.media));
  useEffect(() => {
    if (showViewers && cu.id === me.id) A.refreshStoryViews();
  }, [showViewers, current.id]);
  const sendReply = () => {
    if (!reply.trim()) return;
    A.send(cu.id, {
      text: reply.trim(),
      storyId: current.id,
      storyOwner: cu.id,
    });
    setReply("");
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/95 p-3 text-white">
      <button
        onClick={close}
        className="absolute right-5 top-5 z-20 rounded-full bg-white/10 p-2"
      >
        <X />
      </button>
      <div className="relative h-[min(92vh,760px)] w-full max-w-[430px] overflow-hidden rounded-xl bg-neutral-900 shadow-2xl">
        <div className="absolute left-3 right-3 top-3 z-10 flex gap-1">
          {stories.map((item, n) => (
            <div
              key={item.id}
              className="h-1 flex-1 overflow-hidden rounded bg-white/30"
            >
              <div
                className={`h-full bg-white ${n === i && item.type !== "video" ? "story-progress" : ""}`}
                style={
                  n < i
                    ? { width: "100%" }
                    : n > i
                      ? { width: 0 }
                      : item.type === "video"
                        ? {
                            width: `${videoProgress}%`,
                            transition: "width .2s linear",
                          }
                        : { animationDuration: "6s" }
                }
              />
            </div>
          ))}
        </div>
        <div className="absolute left-4 right-4 top-7 z-10 flex items-center gap-2">
          <button
            onClick={() => {
              close();
              open.profile(cu.id);
            }}
          >
            <Av u={cu} s={34} />
          </button>
          <b className="text-sm">{cu.username}</b>
          <span className="text-xs text-white/60">• {ago(current.t)}</span>
        </div>
        {current.type === "video" && (
          <>
            <video
              src={current.media}
              autoPlay
              playsInline
              muted={false}
              aria-label="Story videosini pauza qilish yoki davom ettirish"
              onClick={(event) => {
                const video = event.currentTarget;
                if (video.paused) video.play();
                else video.pause();
              }}
              onPlay={() => setVideoPaused(false)}
              onPause={() => setVideoPaused(true)}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                if (video.duration)
                  setVideoProgress((video.currentTime / video.duration) * 100);
              }}
              onEnded={next}
              className="h-full w-full object-contain"
            />
            {videoPaused && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-black/55 text-white">
                  <Play size={32} fill="currentColor" />
                </span>
              </div>
            )}
          </>
        )}
        {current.type !== "video" && (
          <img src={current.media} className="h-full w-full object-cover" />
        )}
        {current.caption && !reelStory && (
          <div className="absolute bottom-20 left-4 right-4 rounded-xl bg-black/45 p-3 text-sm backdrop-blur">
            {current.caption}
          </div>
        )}
        {cu.id === me.id ? (
          <div className="absolute bottom-3 left-3 right-3 z-20">
            <button
              onClick={() => setShowViewers((value) => !value)}
              className="flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-sm"
            >
              <Users size={17} /> {viewers.length} kishi ko‘rdi
            </button>
            {showViewers && (
              <div className="absolute bottom-12 left-0 max-h-52 w-full overflow-y-auto rounded-xl bg-neutral-900/95 p-2">
                {viewers.length ? (
                  viewers.map((viewer) => (
                    <button
                      key={viewer.id}
                      onClick={() => {
                        close();
                        open.profile(viewer.id);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-white/10"
                    >
                      <Av u={viewer} s={32} />
                      <span className="text-sm">{viewer.username}</span>
                    </button>
                  ))
                ) : (
                  <p className="p-3 text-sm text-white/70">
                    Hali hech kim ko‘rmagan
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2">
            <div className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-full border border-white/60 bg-black/30 pl-2 pr-1">
              <label
                title="Video javob yuborish"
                className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full"
              >
                <ImagePlus size={18} />
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const err = kidsUnsafeFile(file);
                    if (err) {
                      A.toast(err);
                      return;
                    }
                    A.send(cu.id, {
                      src: await readMedia(file),
                      mediaType: "video",
                      storyId: current.id,
                      storyOwner: cu.id,
                    });
                    event.target.value = "";
                  }}
                />
              </label>
              <input
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && sendReply()}
                placeholder="Storyga javob yozing..."
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/70"
              />
              <button
                onClick={sendReply}
                disabled={!reply.trim()}
                aria-label="Javob yuborish"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white disabled:opacity-40"
              >
                <Send size={18} />
              </button>
            </div>
            <button
              onClick={() => A.like(current.id, "story")}
              aria-label="Storyga like"
              aria-pressed={liked}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/35"
            >
              <Heart
                size={24}
                fill={liked ? "#ef4444" : "none"}
                className={liked ? "text-red-500" : "text-white"}
              />
            </button>
          </div>
        )}
        <button
          onClick={prev}
          className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-3"
        >
          <ChevronLeft />
        </button>
        <button
          onClick={next}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-3 rotate-180"
        >
          <ChevronLeft />
        </button>
      </div>
    </div>
  );
}
function ShareModal({ reel, close }) {
  const { db, me, A, byId } = useC();
  const [sent, setSent] = useState([]);
  const [sharing, setSharing] = useState(false);
  const friends = db.users.filter((u) => u.id !== me.id);
  const addStory = () => {
    A.story(reel.media, reel.type, "", true);
    close();
    A.toast("Reels storyga qo‘shildi ✓");
  };
  const shareToApps = async () => {
    if (sharing) return;
    setSharing(true);
    const username = byId(reel.userId)?.username || "";
    const text = [`@${username}`, reel.caption].filter(Boolean).join(" ");
    try {
      if (navigator.share) {
        const blob = await (await fetch(reel.media)).blob();
        const extension = blob.type.split("/")[1]?.split(";")[0] || "mp4";
        const file = new File([blob], `reels.${extension}`, {
          type: blob.type || "video/mp4",
        });
        const shareData = { title: "Reels", text, files: [file] };
        if (navigator.canShare?.({ files: [file] }))
          await navigator.share(shareData);
        else await navigator.share({ title: "Reels", text });
      } else {
        await navigator.clipboard.writeText(text || "Reels");
        A.toast("Ulashish menyusi bu brauzerda yo‘q, matn nusxalandi");
      }
    } catch (error) {
      if (error.name !== "AbortError")
        A.toast("Reelsni ilovaga ulashib bo‘lmadi");
    } finally {
      setSharing(false);
    }
  };
  return (
    <Modal close={close}>
      <div className="border-b border-neutral-200 p-4 text-center font-semibold dark:border-neutral-800">
        Ulashish
      </div>
      <div className="p-4">
        <button
          onClick={addStory}
          className="mb-3 flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 text-white">
            <Camera size={22} />
          </span>
          <span>
            <b className="block">Storyga qo‘shish</b>
            <span className="text-xs text-neutral-500">
              Reelsni storyda ulashing
            </span>
          </span>
        </button>
        <button
          onClick={shareToApps}
          disabled={sharing}
          className="mb-5 flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          <span className="grid h-11 w-11 place-items-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <Share2 size={21} />
          </span>
          <span>
            <b className="block">
              {sharing ? "Ulashish ochilmoqda..." : "Boshqa ilovaga yuborish"}
            </b>
            <span className="text-xs text-neutral-500">
              Telegram va boshqa ilovalar
            </span>
          </span>
        </button>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Users size={18} /> Do‘stlarga yuborish
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {friends.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                A.send(u.id, {
                  text: `🎬 Reels: ${reel.caption || "Reels"}`,
                  reelId: reel.id,
                });
                setSent((x) => [...x, u.id]);
              }}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Av u={u} s={44} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-sm">{u.username}</b>
                <span className="text-xs text-neutral-500">{u.name}</span>
              </span>
              {sent.includes(u.id) ? (
                <Check className="text-green-500" />
              ) : (
                <Send size={18} className="text-neutral-500" />
              )}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
function ReelComments({ id, close }) {
  const { db, byId, open } = useC();
  const r = db.reels.find((x) => x.id === id);
  if (!r) return null;
  const owner = byId(r.userId);
  const list = (r.comments || []).slice().sort((a, b) => a.t - b.t);
  const row = (x, k) => {
    const c = byId(x.userId);
    if (!c) return null;
    return (
      <div key={k} className="flex gap-3 py-2">
        <button
          onClick={() => {
            close();
            open.profile(c.id);
          }}
        >
          <Av u={c} s={32} />
        </button>
        <p className="min-w-0 break-words text-sm">
          <b className="mr-1">{c.username}</b>
          {x.text}
          <span className="block text-xs text-neutral-500">{ago(x.t)}</span>
        </p>
      </div>
    );
  };
  return (
    <Modal close={close}>
      <div className="flex max-h-[80vh] min-h-[50vh] flex-col text-neutral-900 dark:text-neutral-100">
        <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
          <b>Izohlar{list.length ? ` (${list.length})` : ""}</b>
          <button onClick={close} aria-label="Yopish">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-[120px] flex-1 overflow-y-auto px-4 no-scrollbar">
          {r.caption &&
            owner &&
            row({ userId: owner.id, text: r.caption, t: r.t }, "cap")}
          {list.map((c) => row(c, c.id))}
          {!list.length && (
            <p className="py-10 text-center text-neutral-500">
              Hali izohlar yo‘q. Birinchi bo‘lib yozing!
            </p>
          )}
        </div>
        <div className="px-4">
          <CommentBox p={r} kind="reel" autoFocus />
        </div>
      </div>
    </Modal>
  );
}
/* ---------- Reels / video helpers ---------- */
const fmtN = (n) => {
  n = n || 0;
  return n >= 1e6
    ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
    : n >= 1e4
      ? Math.round(n / 1e3) + "K"
      : n >= 1e3
        ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K"
        : String(n);
};
const MUTE_KEY = "reelMuted";
function useReelMuted() {
  const [muted, setM] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const h = (e) => setM(e.detail);
    window.addEventListener("reel-muted", h);
    return () => window.removeEventListener("reel-muted", h);
  }, []);
  const set = (v) => {
    setM(v);
    try {
      localStorage.setItem(MUTE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent("reel-muted", { detail: v }));
  };
  return [muted, set];
}
function useVideoAutoplay(ref, muted, setMuted, threshold, key) {
  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= threshold)
          v.play().catch(() => {
            v.muted = true;
            setMuted(true);
            v.play().catch(() => {});
          });
        else v.pause();
      },
      { threshold: [0, threshold] },
    );
    io.observe(v);
    return () => {
      io.disconnect();
      v.pause();
    };
  }, [key]);
}
function Caption({ u, text }) {
  const [more, setMore] = useState(false);
  if (!text) return null;
  const long = text.length > 90;
  return (
    <p className="break-words text-sm">
      <b className="mr-1">{u.username}</b>
      {!more && long ? text.slice(0, 90).trimEnd() + "… " : text}
      {long && !more && (
        <button onClick={() => setMore(true)} className="opacity-70">
          more
        </button>
      )}
    </p>
  );
}
function ReelReport({ r, close }) {
  const { A } = useC();
  const [reportReason, setReportReason] = useState("adult");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const submitReport = async () => {
    if (reportReason === "other" && !reportDetails.trim()) {
      A.toast("Boshqa sababni qisqacha yozing");
      return;
    }
    setReporting(true);
    const sent = await A.reportReel(r.id, reportReason, reportDetails);
    setReporting(false);
    if (sent) close();
  };
  return (
    <Modal close={() => !reporting && close()}>
      <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
        <b>Reels haqida shikoyat</b>
        <button onClick={close} disabled={reporting} aria-label="Yopish">
          <X size={20} />
        </button>
      </div>
      <div className="space-y-4 p-4 text-neutral-900 dark:text-neutral-100">
        <label className="block text-sm font-semibold">
          Sabab
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 font-normal dark:border-neutral-700 dark:bg-neutral-800"
          >
            <option value="adult">18+ kontent</option>
            <option value="violence">Zo‘ravonlik</option>
            <option value="harassment">Haqorat yoki nafrat</option>
            <option value="spam">Spam yoki aldov</option>
            <option value="other">Boshqa</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Izoh <span className="font-normal text-neutral-500">(ixtiyoriy)</span>
          <textarea
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Qo‘shimcha ma’lumot"
            className="mt-1.5 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-800"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={close}
            disabled={reporting}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold dark:border-neutral-700"
          >
            Bekor qilish
          </button>
          <button
            onClick={submitReport}
            disabled={reporting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {reporting ? "Yuborilmoqda..." : "Yuborish"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
function ReelMenu({ r, size = 24, up = false, showOpen = false }) {
  const { me, A, open } = useC();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const own = r.userId === me.id;
  const item =
    "flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800";
  const run = (fn) => () => {
    setMenu(false);
    fn();
  };
  return (
    <div className="relative">
      <button
        onClick={() => setMenu((v) => !v)}
        aria-label="Boshqa amallar"
        aria-expanded={menu}
      >
        <MoreHorizontal size={size} />
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} />
          <div
            className={`absolute right-0 z-30 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 ${up ? "bottom-full mb-2" : "top-full mt-2"}`}
          >
            {showOpen && (
              <button onClick={run(() => open.reel(r.id))} className={item}>
                <Play size={16} /> Reels sifatida ochish
              </button>
            )}
            <button
              onClick={run(() => open.profile(r.userId))}
              className={item}
            >
              <User size={16} /> Profilga o‘tish
            </button>
            {!own && (
              <button
                onClick={run(() => A.story(r.media, r.type, "", true))}
                className={item}
              >
                <Plus size={16} /> Storyga qo‘shish
              </button>
            )}
            {own ? (
              <button
                onClick={run(() => {
                  if (window.confirm("Bu Reelsni o‘chirasizmi?"))
                    A.delReel(r.id);
                })}
                className={item + " font-semibold text-red-500"}
              >
                <Trash2 size={16} /> O‘chirish
              </button>
            ) : (
              <button
                onClick={run(() => setReport(true))}
                className={item + " font-semibold text-red-500"}
              >
                <Flag size={16} /> Shikoyat qilish
              </button>
            )}
          </div>
        </>
      )}
      {report && <ReelReport r={r} close={() => setReport(false)} />}
    </div>
  );
}
function ReelsCard({ r }) {
  const { byId, me, A, open, db } = useC();
  const u = byId(r.userId);
  const [muted, setMuted] = useReelMuted();
  const [paused, setPaused] = useState(false);
  const [share, setShare] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [heart, setHeart] = useState(false);
  const liked = r.likes.includes(me.id);
  const saved = (db.saved[me.id] || []).includes(r.id);
  const video = useRef(null);
  const bar = useRef(null);
  useVideoAutoplay(video, muted, setMuted, 0.65, r.id);
  if (!u) return null;
  const dbl = () => {
    if (!liked) A.like(r.id, "reel");
    setHeart(true);
    setTimeout(() => setHeart(false), 700);
  };
  const tick = (e) => {
    const v = e.currentTarget;
    if (bar.current && v.duration)
      bar.current.style.width = (v.currentTime / v.duration) * 100 + "%";
  };
  const act = "flex flex-col items-center gap-1 transition active:scale-110";
  return (
    <article className="relative mx-auto flex h-full min-h-[calc(100dvh-56px)] w-full max-w-[900px] snap-start items-center justify-center gap-3 px-2 py-2 md:min-h-screen md:px-4">
      <div
        className="relative aspect-[9/16] max-h-[92dvh] w-[min(52dvh,calc(100vw_-_84px),380px)] shrink-0 overflow-hidden rounded-lg bg-black text-white"
        onDoubleClick={dbl}
      >
        {r.type === "video" ? (
          <video
            ref={video}
            src={r.media}
            preload="none"
            loop
            playsInline
            muted={muted}
            aria-label="Reels videosini pauza qilish yoki davom ettirish"
            onTimeUpdate={tick}
            onClick={(e) => {
              const v = e.currentTarget;
              if (v.paused) v.play();
              else v.pause();
            }}
            onPlay={() => setPaused(false)}
            onPause={() => setPaused(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <img
            src={r.media}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain"
          />
        )}
        {paused && r.type === "video" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-black/55">
              <Play size={32} fill="currentColor" />
            </span>
          </div>
        )}
        {heart && (
          <Heart
            size={110}
            fill="white"
            className="pop pointer-events-none absolute inset-0 m-auto text-white drop-shadow-2xl"
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-x-3 bottom-4 space-y-2 pr-11">
          <div className="flex items-center gap-2">
            <button onClick={() => open.profile(u.id)}>
              <Av u={u} s={34} />
            </button>
            <b className="max-w-[40%] truncate text-sm">{u.username}</b>
            {u.id !== me.id && <FollowBtn id={u.id} />}
          </div>
          <Caption u={{ username: "" }} text={r.caption} />
          <p className="text-xs text-white/80">
            ♪ Original audio · {u.username}
          </p>
        </div>
        {r.type === "video" && (
          <button
            onClick={() => setMuted(!muted)}
            aria-label={muted ? "Ovozni yoqish" : "Ovozni o‘chirish"}
            className="absolute bottom-4 right-3 grid h-8 w-8 place-items-center rounded-full bg-black/60"
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        )}
        {r.type === "video" && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
            <div ref={bar} className="h-full w-0 bg-white" />
          </div>
        )}
      </div>
      <div className="z-10 flex shrink-0 flex-col items-center gap-5 self-end pb-4 text-neutral-900 dark:text-white">
        <button
          onClick={() => A.like(r.id, "reel")}
          aria-label="Reelsga like"
          aria-pressed={liked}
          className={act}
        >
          <Heart
            size={28}
            fill={liked ? "#ef4444" : "none"}
            className={liked ? "text-red-500" : ""}
          />
          <span className="text-xs font-semibold">{fmtN(r.likes.length)}</span>
        </button>
        <button
          onClick={() => setCommentsOpen(true)}
          aria-label="Reelsga izoh yozish"
          className={act}
        >
          <MessageCircle size={28} />
          <span className="text-xs font-semibold">
            {fmtN((r.comments || []).length)}
          </span>
        </button>
        <button
          onClick={() => setShare(true)}
          aria-label="Reelsni ulashish"
          className={act}
        >
          <Send size={26} />
        </button>
        <button
          onClick={() => A.save(r.id)}
          aria-label="Saqlash"
          aria-pressed={saved}
          className={act}
        >
          <Bookmark size={27} fill={saved ? "currentColor" : "none"} />
        </button>
        <ReelMenu r={r} up />
        <button
          onClick={() => open.profile(u.id)}
          aria-label="Audio muallifi"
          className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg border-2 border-neutral-400 bg-neutral-800 text-xs font-bold text-white"
        >
          {u.avatar ? (
            <img src={u.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            (u.username || "?")[0].toUpperCase()
          )}
        </button>
      </div>
      {share && <ShareModal reel={r} close={() => setShare(false)} />}
      {commentsOpen && (
        <ReelComments id={r.id} close={() => setCommentsOpen(false)} />
      )}
    </article>
  );
}

function CreateStory({ close }) {
  const { A } = useC();
  const [media, setMedia] = useState(null);
  const [type, setType] = useState("image");
  const [cap, setCap] = useState("");
  return (
    <Modal close={close}>
      <div className="flex items-center justify-between border-b p-3 dark:border-neutral-800">
        <b className="mx-auto pl-8">Yangi story</b>
        {media && (
          <button
            onClick={() => {
              if (A.story(media, type, cap)) close();
            }}
            className="font-semibold text-black dark:text-white"
          >
            Ulashish
          </button>
        )}
      </div>
      {!media ? (
        <label className="grid h-[420px] cursor-pointer place-items-center text-center">
          <div>
            <Camera size={58} className="mx-auto" />
            <div className="mt-4 text-xl">Rasm yoki video tanlang</div>
            <span className="mt-3 inline-block rounded-lg bg-black dark:bg-white dark:text-black px-4 py-2 text-sm font-semibold text-white">
              Qurilmadan tanlash
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const err = kidsUnsafeFile(f);
                  if (err) {
                    A.toast(err);
                    return;
                  }
                  setType(f.type.startsWith("video/") ? "video" : "image");
                  setMedia(await readMedia(f));
                  e.target.value = "";
                }
              }}
            />
          </div>
        </label>
      ) : (
        <div>
          <div className="bg-black">
            <img
              src={type === "image" ? media : ""}
              className={
                type === "image"
                  ? "mx-auto max-h-[55vh] object-contain"
                  : "hidden"
              }
            />
            {type === "video" && (
              <video src={media} controls className="mx-auto max-h-[55vh]" />
            )}
          </div>
          <div className="p-4">
            <textarea
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              placeholder="Storyga yozuv qo‘shing..."
              className="h-20 w-full resize-none bg-transparent outline-none"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
function CreateReel({ close }) {
  const { A } = useC();
  const [media, setMedia] = useState(null);
  const [cap, setCap] = useState("");
  return (
    <Modal close={close}>
      <div className="flex items-center justify-between border-b p-3 dark:border-neutral-800">
        <b className="mx-auto pl-8">Yangi Reels</b>
        {media && (
          <button
            onClick={() => {
              if (A.reel(media, cap)) close();
            }}
            className="font-semibold text-black dark:text-white"
          >
            Ulashish
          </button>
        )}
      </div>
      {!media ? (
        <label className="grid h-[420px] cursor-pointer place-items-center text-center">
          <div>
            <Play size={64} className="mx-auto" />
            <div className="mt-4 text-xl">Reels videosini tanlang</div>
            <span className="mt-3 inline-block rounded-lg bg-black dark:bg-white dark:text-black px-4 py-2 text-sm font-semibold text-white">
              Video tanlash
            </span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const err = kidsUnsafeFile(f);
                  if (err) {
                    A.toast(err);
                    return;
                  }
                  setMedia(await readMedia(f));
                  e.target.value = "";
                }
              }}
            />
          </div>
        </label>
      ) : (
        <div>
          <video
            src={media}
            controls
            className="mx-auto max-h-[55vh] bg-black"
          />
          <div className="p-4">
            <textarea
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              placeholder="Reels haqida yozing..."
              className="h-20 w-full resize-none bg-transparent outline-none"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

function HomeReelCard({ r }) {
  const { byId, me, A, open, db } = useC();
  const u = byId(r.userId);
  const [muted, setMuted] = useReelMuted();
  const [paused, setPaused] = useState(false);
  const [share, setShare] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [heart, setHeart] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const video = useRef(null);
  useVideoAutoplay(video, muted, setMuted, 0.6, r.id);
  if (!u) return null;
  const liked = r.likes.includes(me.id);
  const saved = (db.saved[me.id] || []).includes(r.id);
  const count = (r.comments || []).length;
  const dbl = () => {
    if (!liked) A.like(r.id, "reel");
    setHeart(true);
    setTimeout(() => setHeart(false), 700);
  };
  return (
    <article className="ig-card mb-4 pb-4">
      <div className="flex items-center gap-2 py-3">
        <button
          onClick={() => open.profile(u.id)}
          className="flex items-center gap-3"
        >
          <Av u={u} s={34} />
          <b className="text-sm">{u.username}</b>
        </button>
        <span className="text-sm text-neutral-500">• {ago(r.t)}</span>
        {u.id !== me.id && <FollowBtn id={u.id} />}
        <div className="ml-auto">
          <ReelMenu r={r} size={22} showOpen />
        </div>
      </div>
      <div
        className={`relative w-full overflow-hidden border border-neutral-200 bg-black dark:border-neutral-800 sm:rounded-[3px] ${landscape ? "aspect-video" : "aspect-[4/5]"}`}
        onDoubleClick={dbl}
      >
        <video
          ref={video}
          src={r.media}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) =>
            setLandscape(
              e.currentTarget.videoWidth >= e.currentTarget.videoHeight,
            )
          }
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onClick={(e) => {
            const v = e.currentTarget;
            if (v.paused) v.play();
            else v.pause();
          }}
          className="block h-full w-full cursor-pointer object-cover"
        />
        {paused && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-black/55 text-white">
              <Play size={30} fill="currentColor" />
            </span>
          </div>
        )}
        {heart && (
          <Heart
            size={100}
            fill="white"
            className="pop pointer-events-none absolute inset-0 m-auto text-white drop-shadow-2xl"
          />
        )}
        <button
          onClick={() => setMuted(!muted)}
          aria-label={muted ? "Ovozni yoqish" : "Ovozni o‘chirish"}
          className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-5">
          <button
            onClick={() => A.like(r.id, "reel")}
            aria-label="Like"
            aria-pressed={liked}
            className="flex items-center gap-1.5 transition active:scale-110"
          >
            <Heart
              size={26}
              fill={liked ? "#ef4444" : "none"}
              className={liked ? "text-red-500" : ""}
            />
            <span className="text-sm font-semibold">
              {fmtN(r.likes.length)}
            </span>
          </button>
          <button
            onClick={() => setCommentsOpen(true)}
            aria-label="Izohlar"
            className="flex items-center gap-1.5"
          >
            <MessageCircle size={26} />
            <span className="text-sm font-semibold">{fmtN(count)}</span>
          </button>
          <button onClick={() => setShare(true)} aria-label="Ulashish">
            <Send size={26} />
          </button>
        </div>
        <button
          onClick={() => A.save(r.id)}
          aria-label="Saqlash"
          aria-pressed={saved}
        >
          <Bookmark size={26} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <Caption u={u} text={r.caption} />
      {count > 0 && (
        <button
          onClick={() => setCommentsOpen(true)}
          className="mt-1 text-sm text-neutral-500"
        >
          Barcha {count} ta izohni ko‘rish
        </button>
      )}
      {share && <ShareModal reel={r} close={() => setShare(false)} />}
      {commentsOpen && (
        <ReelComments id={r.id} close={() => setCommentsOpen(false)} />
      )}
    </article>
  );
}

function Grid({ posts }) {
  const { open } = useC();
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-5">
      {posts.map((p) => (
        <button
          key={p.id}
          onClick={() =>
            p.kind === "reel" ? open.reel(p.id) : open.post(p.id)
          }
          className="group relative aspect-square overflow-hidden bg-neutral-100 dark:bg-neutral-900"
        >
          {p.kind === "reel" ? (
            <>
              <video
                src={p.media}
                muted
                preload="metadata"
                className="h-full w-full object-cover"
              />
              <Play
                size={18}
                fill="white"
                className="absolute right-2 top-2 text-white drop-shadow"
              />
            </>
          ) : (
            <img src={p.image} alt="" className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 hidden items-center justify-center gap-5 bg-black/40 font-semibold text-white group-hover:flex">
            <span className="flex items-center gap-1">
              <Heart size={20} fill="white" />
              {p.likes.length}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle size={20} fill="white" />
              {(p.comments || []).length}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function EditProfile({ close }) {
  const { me, A } = useC();
  const [f, setF] = useState({
    name: me.name,
    username: me.username,
    bio: me.bio || "",
    avatar: me.avatar,
  });
  const [err, setErr] = useState("");
  const inp =
    "mt-1 w-full rounded-lg border border-neutral-300 bg-transparent p-3 text-sm outline-none dark:border-neutral-700";
  return (
    <Modal close={close}>
      <div className="p-5">
        <h2 className="text-lg font-bold">Profilni tahrirlash</h2>
        <div className="mt-5 flex flex-col items-center">
          <Av u={{ ...me, ...f }} s={90} />
          <label className="mt-2 cursor-pointer text-sm font-semibold text-black dark:text-white">
            Rasmni almashtirish
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) =>
                e.target.files[0] &&
                setF({ ...f, avatar: await readImg(e.target.files[0], 300) })
              }
            />
          </label>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold">
            Ism
            <input
              className={inp}
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold">
            Username
            <input
              className={inp}
              value={f.username}
              onChange={(e) =>
                setF({
                  ...f,
                  username: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9._]/g, ""),
                })
              }
            />
          </label>
          <label className="block text-sm font-semibold">
            Bio
            <textarea
              className={inp + " h-20 resize-none"}
              value={f.bio}
              onChange={(e) => setF({ ...f, bio: e.target.value })}
            />
          </label>
        </div>
        {err && <p className="mt-2 text-sm text-red-500">{err}</p>}
        <button
          onClick={() => {
            const r = A.edit(f);
            r ? setErr(r) : close();
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-black dark:bg-white dark:text-black py-2.5 font-semibold text-white"
        >
          <Check size={18} /> Saqlash
        </button>
      </div>
    </Modal>
  );
}
function ChangePassword({ close }) {
  const { me, A } = useC();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const change = async (e) => {
    e.preventDefault();
    setErr("");
    if (newPassword.length < 4) {
      setErr("Yangi parol kamida 4 ta belgi bo‘lsin");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("Yangi parollar mos kelmadi");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/plat/change-password/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken(),
        },
        body: JSON.stringify({
          username: me.username,
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setErr(result.error || "Parolni o‘zgartirib bo‘lmadi");
        return;
      }
      close();
      A.toast("Parol muvaffaqiyatli o‘zgartirildi");
    } catch {
      setErr("Server bilan bog‘lanib bo‘lmadi");
    } finally {
      setBusy(false);
    }
  };
  const input =
    "w-full rounded-lg border border-neutral-300 bg-transparent p-3 text-sm outline-none dark:border-neutral-700";
  const passwordInput = (
    value,
    setValue,
    visible,
    setVisible,
    placeholder,
    autoComplete,
    minLength,
  ) => (
    <div className="relative">
      <input
        required
        minLength={minLength}
        autoComplete={autoComplete}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={input + " pr-11"}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={
          visible ? `${placeholder}ni yashirish` : `${placeholder}ni ko‘rsatish`
        }
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
  return (
    <Modal close={close}>
      <form onSubmit={change} className="p-5">
        <h2 className="text-lg font-bold">Parolni o‘zgartirish</h2>
        <div className="mt-5 space-y-3">
          {passwordInput(
            currentPassword,
            setCurrentPassword,
            showCurrent,
            setShowCurrent,
            "Joriy parol",
            "current-password",
          )}
          {passwordInput(
            newPassword,
            setNewPassword,
            showNew,
            setShowNew,
            "Yangi parol",
            "new-password",
            4,
          )}
          {passwordInput(
            confirmPassword,
            setConfirmPassword,
            showConfirm,
            setShowConfirm,
            "Yangi parolni tasdiqlang",
            "new-password",
            4,
          )}
        </div>
        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
        <button
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-black dark:bg-white dark:text-black py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Saqlanmoqda..." : "Saqlash"}
        </button>
      </form>
    </Modal>
  );
}
export {
  Av,
  Logo,
  FollowBtn,
  Modal,
  EmojiPicker,
  Auth,
  PostActions,
  CommentBox,
  PostCard,
  PostModal,
  Create,
  CreateChooser,
  StoryViewer,
  ShareModal,
  ReelsCard,
  CreateStory,
  CreateReel,
  HomeReelCard,
  Grid,
  EditProfile,
  ChangePassword,
};
