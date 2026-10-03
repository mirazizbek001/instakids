import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/* Brauzer xotirasi (Safari private rejim, cheklangan sozlamalar) xato bersa ham ilova qulamasin */
const store = (area) => ({
  get(key) {
    try {
      return window[area].getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window[area].setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      window[area].removeItem(key);
    } catch {
      /* ignore */
    }
  },
});
const ls = store("localStorage");
const ss = store("sessionStorage");

/* ---------- data layer (localStorage with IndexedDB overflow, tabs sync live) ---------- */
const KEY = "ig_db_v2",
  ME = "ig_me_v2",
  OVERFLOW_SIGNAL = "ig_db_overflow_signal";
// Bir brauzer = bitta faol akkaunt. Eski versiyadagi ko‘p-akkaunt kalitlarini bir marta tozalaymiz.
ls.remove("instakids_recent_accounts");
ls.remove("instakids_switch_account");
const EMPTY = {
  users: [],
  posts: [],
  reels: [],
  stories: [],
  seenStories: [],
  follows: [],
  messages: [],
  deletedMessages: [],
  hiddenChats: [],
  blockedUsers: [],
  blockedByUsers: [],
  notifs: [],
  saved: {},
  searchHistory: [],
};
const normalizeDatabase = (stored) => {
  const next = { ...EMPTY };
  if (!stored || typeof stored !== "object" || Array.isArray(stored))
    return next;
  for (const key of Object.keys(EMPTY)) {
    const fallback = EMPTY[key];
    const value = stored[key];
    if (Array.isArray(fallback)) {
      if (Array.isArray(value)) next[key] = value;
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      next[key] = value;
    }
  }
  return next;
};
const load = () => {
  try {
    return normalizeDatabase(JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    return { ...EMPTY };
  }
};
let overflowDatabasePromise;
const openOverflowDatabase = () => {
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("IndexedDB mavjud emas"));
  if (!overflowDatabasePromise)
    overflowDatabasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("instakids-local-data", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("state");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  return overflowDatabasePromise;
};
const readOverflowDatabase = async () => {
  const database = await openOverflowDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction("state", "readonly")
      .objectStore("state")
      .get("database");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};
const writeOverflowDatabase = async (value) => {
  const database = await openOverflowDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("state", "readwrite");
    transaction.objectStore("state").put(value, "database");
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};
const clearOverflowDatabase = async () => {
  const database = await openOverflowDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("state", "readwrite");
    transaction.objectStore("state").delete("database");
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
};
const readMeId = () => {
  const storedId = ls.get(ME);
  if (storedId) return storedId;
  const legacyId = ss.get(ME);
  if (legacyId) ls.set(ME, legacyId);
  ss.remove(ME);
  return legacyId;
};
const storeMeId = (id) => {
  if (!ls.set(ME, id)) {
    ss.set(ME, id);
    return;
  }
  ss.remove(ME);
};
const clearMeId = () => {
  ls.remove(ME);
  ss.remove(ME);
};
const isAuthenticationFailure = (response, payload) =>
  response.status === 401 ||
  (response.status === 403 &&
    /authentication credentials were not provided|not authenticated/i.test(
      payload?.detail || "",
    ));
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const callSessionId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `call-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const csrfToken = () =>
  decodeURIComponent(
    document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith("csrftoken="))
      ?.split("=")[1] || "",
  );
let _csrfMemo = "";
const ensureCsrfToken = async (force = false) => {
  // Backend uyg'onayotgan / qayta ishga tushayotgan bo'lsa ham, bir necha marta urinib ko'radi
  if (!force) {
    const cookieToken = csrfToken();
    if (cookieToken) {
      _csrfMemo = cookieToken;
      return cookieToken;
    }
  }
  const delays = [0, 800, 1800, 3500, 6000];
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`/plat/csrf/?_=${Date.now()}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!response.ok) continue;
      const data = await response.json().catch(() => ({}));
      const token = csrfToken() || data.csrfToken || "";
      if (token) {
        _csrfMemo = token;
        return token;
      }
    } catch {
      /* tarmoq uzilgan — keyingi urinish */
    }
  }
  return _csrfMemo;
};
const serializeSocialState = (db) => {
  const usersById = new Map(db.users.map((user) => [user.id, user]));
  const username = (id) => usersById.get(id)?.username || id;
  return {
    posts: db.posts.map((post) => ({
      ...post,
      userId: username(post.userId),
      likes: post.likes.map(username),
      comments: post.comments.map((comment) => ({
        ...comment,
        userId: username(comment.userId),
      })),
    })),
    reels: db.reels.map((reel) => ({
      ...reel,
      userId: username(reel.userId),
      likes: reel.likes.map(username),
      comments: (reel.comments || []).map((comment) => ({
        ...comment,
        userId: username(comment.userId),
      })),
    })),
    stories: db.stories.map((story) => ({
      ...story,
      userId: username(story.userId),
    })),
    seenStories: db.seenStories.map((item) => ({
      ...item,
      viewerId: username(item.viewerId),
    })),
    follows: db.follows.map((follow) => ({
      ...follow,
      a: username(follow.a),
      b: username(follow.b),
    })),
    messages: db.messages.map((message) => ({
      ...message,
      from: username(message.from),
      to: username(message.to),
      hiddenFor: (message.hiddenFor || []).map(username),
    })),
    deletedMessages: db.deletedMessages.map((message) => ({
      ...message,
      from: username(message.from),
      to: username(message.to),
    })),
    notifs: db.notifs.map((notif) => ({
      ...notif,
      from: username(notif.from),
      to: username(notif.to),
    })),
    saved: Object.fromEntries(
      Object.entries(db.saved).map(([id, posts]) => [username(id), posts]),
    ),
  };
};
const Ctx = createContext(null);
const useC = () => useContext(Ctx);
const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "hozirgina";
  if (s < 3600) return `${~~(s / 60)} daqiqa oldin`;
  if (s < 86400) return `${~~(s / 3600)} soat oldin`;
  if (s < 604800) return `${~~(s / 86400)} kun oldin`;
  return new Date(t).toLocaleDateString();
};
const hm = (t) =>
  new Date(t).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
const seg = (s) => [...new Intl.Segmenter().segment(s)].map((x) => x.segment);
const readMedia = (file, max = 1000) =>
  new Promise((r) => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result);
    fr.readAsDataURL(file);
  });
const readImg = (file, max = 1000) =>
  new Promise((r) => {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = im.width * k;
        c.height = im.height * k;
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        r(c.toDataURL("image/jpeg", 0.82));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });

const KIDS_BLOCKED_TERMS = [
  "fuck",
  "fucking",
  "shit",
  "bitch",
  "asshole",
  "casino",
  "betting",
  "gambling",
  "drug",
  "drugs",
  "cocaine",
  "heroin",
  "meth",
  "weed",
  "kill",
  "murder",
  "suicide",
  "weapon",
  "gun",
  "bomb",
  "блядь",
  "бля",
  "сука",
  "хуй",
  "пизд",
  "еба",
  "ебать",
  "шлюха",
  "порно",
  "секс",
  "наркот",
  "кокаин",
  "героин",
  "оруж",
  "убий",
  "самоубий",
  "ahmoq",
  "tentak",
  "jalab",
  "siktir",
];
const kidsUnsafeText = (value) => {
  if (!value) return false;
  const normalized = String(value)
    .toLowerCase()
    .replace(/[\W_]+/gu, " ");
  const compact = normalized.replace(/\s/g, "");
  if (
    /(https?:\/\/|www\.|t\.me|telegram\.me|wa\.me|discord\.gg)/i.test(
      String(value),
    )
  )
    return true;
  return KIDS_BLOCKED_TERMS.some((term) => {
    const re = new RegExp(
      `(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`,
      "i",
    );
    return re.test(normalized) || (term.length >= 4 && compact.includes(term));
  });
};
const kidsUnsafeFile = (file) => {
  if (!file) return "Fayl tanlanmadi.";
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
  ];
  if (!allowed.includes(file.type))
    return "Faqat JPG, PNG, WEBP, MP4 yoki WEBM fayllar ruxsat etiladi.";
  if (file.size > 25 * 1024 * 1024) return "Fayl hajmi 25 MB dan oshmasin.";
  if (kidsUnsafeText(file.name))
    return "Bu fayl nomi xavfsizlik filtri tomonidan rad etildi.";
  return "";
};
const kidsUnsafeDataUrl = (value) => {
  if (!value || typeof value !== "string") return "Media fayl noto‘g‘ri.";
  if (
    !/^data:(image\/jpeg|image\/png|image\/webp|video\/mp4|video\/webm|audio\/webm|audio\/ogg|audio\/mp4|audio\/mpeg|audio\/wav)(?:;[a-z0-9=.+_-]+)*;base64,/i.test(
      value,
    )
  )
    return "Media turi ruxsat etilmagan.";
  if (value.length > 36 * 1024 * 1024) return "Media hajmi juda katta.";
  return "";
};
const isKidsHours = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  return hour >= 8 && hour < 22;
};
const kidsHoursMessage =
  "Platforma 08:00–22:00 oralig‘ida ishlaydi (Toshkent vaqti).";

const EMO = {
  "😀": "😀😃😄😁😆😅🤣😂🙂😉😊😇🥰😍🤩😘😋😜🤪😎🤓🥳😏😒😞😔😕🥺😢😭😤😠😡🤯😳🥵🥶😱😰🤗🤔🤭🤫😶😐🙄😮😴🤤🤢🤧😷",
  "👍": "👍👎👊✊🤞✌️🤟🤘👌🤌👈👉👆👇☝️✋👋🤙💪🙏🤝👏🙌👐🤲",
  "❤️": "❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟😻💌",
  "🌹": "🌹🌸🌼🌻🌺🌷🌱🌴🍀🍁🌈☀️🌙⭐🌟✨⚡🔥💧🌊🐶🐱🐭🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🦄🐝🦋",
  "🍕": "🍎🍊🍋🍌🍉🍇🍓🍒🍑🥭🍍🥑🍅🌽🍕🍔🍟🌭🍿🥗🍜🍣🍰🎂🍩🍪🍫🍬☕🍵🥤🍺",
  "🎉": "🎉🎊🎁🎈🏆⚽🏀🎮🎧🎵🎶📸💯✅❌⚠️💬👀🚀✈️🚗🏠📱💻",
};
export function AppProvider({ children }) {
  const navigate = useNavigate();
  const dbRef = useRef(load());
  const [db, setDb] = useState(dbRef.current);
  const [meId, setMeId] = useState(readMeId);
  const me = db.users.find((u) => u.id === meId);
  const overflowStorageRef = useRef(false);
  const skipSocialSyncRef = useRef(0);
  const messageCursorRef = useRef(
    dbRef.current.messages.reduce(
      (cursor, message) => Math.max(cursor, Number(message.t) || 0),
      0,
    ),
  );
  const [suggestionSeed] = useState(() => {
    const next = (Number(ls.get("ig_suggestion_seed")) || 0) + 1;
    ls.set("ig_suggestion_seed", String(next));
    return next;
  });
  const [socialReadyUser, setSocialReadyUser] = useState(null);
  const syncChain = useRef(Promise.resolve());
  const [view, setView] = useState({ n: "home" });
  const [reelId, setReelId] = useState(null);
  const [createPost, setCreatePost] = useState(false);
  const [postId, setPostId] = useState(null);
  const [create, setCreate] = useState(false);
  const [createReel, setCreateReel] = useState(false);
  const [createStory, setCreateStory] = useState(false);
  const [storyId, setStoryId] = useState(null);
  const [toast, setToast] = useState(null);
  const [peer, setPeer] = useState(null);
  const [dark, setDark] = useState(
    () => ls.get("theme") !== "light",
  );
  const [serviceOpen, setServiceOpen] = useState(true);
  const [accessInfo, setAccessInfo] = useState({
    open: true,
    reason: "loading",
    usageLimitMinutes: 30,
    cooldownMinutes: 10,
    usageRemainingSeconds: 1800,
    cooldownSeconds: 0,
    restriction: { active: false, until: null, remainingSeconds: 0 },
  });
  const [callSession, setCallSession] = useState(null);
  const [callLocalStream, setCallLocalStream] = useState(null);
  const [callRemoteStream, setCallRemoteStream] = useState(null);
  const [presenceByUser, setPresenceByUser] = useState({});
  const callRef = useRef(null);
  const callPeerConnectionRef = useRef(null);
  const callLocalStreamRef = useRef(null);
  const pendingCallOfferRef = useRef(null);
  const pendingCallIceRef = useRef([]);
  const callSignalHandlerRef = useRef(null);
  const updateCall = (next) => {
    callRef.current = next;
    setCallSession(next);
  };
  const postCallSignal = async (session, action, payload = {}) => {
    const target = dbRef.current.users.find(
      (user) => user.id === session.peerId,
    );
    if (!target) throw new Error("Foydalanuvchi topilmadi.");
    const token = await ensureCsrfToken();
    const response = await fetch("/plat/calls/signals/", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRFToken": token },
      body: JSON.stringify({
        callId: session.id,
        to: target.username,
        action,
        payload,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(result.error || "Qo‘ng‘iroq signali yuborilmadi.");
  };
  const closeCall = () => {
    callPeerConnectionRef.current?.close();
    callPeerConnectionRef.current = null;
    callLocalStreamRef.current?.getTracks().forEach((track) => track.stop());
    callLocalStreamRef.current = null;
    pendingCallOfferRef.current = null;
    pendingCallIceRef.current = [];
    setCallLocalStream(null);
    setCallRemoteStream(null);
    updateCall(null);
  };
  const createCallPeerConnection = (session) => {
    if (!("RTCPeerConnection" in window)) {
      throw new Error("Bu brauzer qo‘ng‘iroq uchun WebRTCni qo‘llab-quvvatlamaydi.");
    }
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    callPeerConnectionRef.current = connection;
    callLocalStreamRef.current
      ?.getTracks()
      .forEach((track) =>
        connection.addTrack(track, callLocalStreamRef.current),
      );
    connection.onicecandidate = (event) => {
      if (event.candidate)
        postCallSignal(session, "candidate", event.candidate.toJSON()).catch(
          () => {
            /* ignore */
          },
        );
    };
    connection.ontrack = (event) => {
      setCallRemoteStream(event.streams[0]);
      const current = callRef.current;
      if (current?.id === session.id)
        updateCall({
          ...current,
          status: "connected",
          connectedAt: current.connectedAt || Date.now(),
        });
    };
    connection.onconnectionstatechange = () => {
      const current = callRef.current;
      if (current?.id !== session.id) return;
      if (connection.connectionState === "connected")
        updateCall({
          ...current,
          status: "connected",
          connectedAt: current.connectedAt || Date.now(),
        });
      if (connection.connectionState === "disconnected")
        updateCall({ ...current, status: "reconnecting" });
      if (connection.connectionState === "failed")
        updateCall({ ...current, status: "failed" });
    };
    return connection;
  };
  const addPendingCallIce = async (connection) => {
    const candidates = pendingCallIceRef.current.splice(0);
    for (const candidate of candidates) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ignore */
      }
    }
  };
  const answerCallOffer = async (session, description) => {
    const connection =
      callPeerConnectionRef.current || createCallPeerConnection(session);
    await connection.setRemoteDescription(
      new RTCSessionDescription(description),
    );
    await addPendingCallIce(connection);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    await postCallSignal(session, "answer", {
      description: connection.localDescription.toJSON(),
    });
  };
  const acceptCall = async () => {
    const session = callRef.current;
    if (
      !session ||
      session.direction !== "incoming" ||
      session.status !== "ringing"
    )
      return false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Bu brauzer mikrofon/kamera ruxsatini qo‘llab-quvvatlamaydi.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: session.mode === "video",
      });
      callLocalStreamRef.current = stream;
      setCallLocalStream(stream);
      updateCall({
        ...session,
        status: "connecting",
        muted: false,
        cameraOff: false,
      });
      createCallPeerConnection(session);
      await postCallSignal(session, "accept");
      if (pendingCallOfferRef.current) {
        const offer = pendingCallOfferRef.current;
        pendingCallOfferRef.current = null;
        await answerCallOffer(session, offer);
      }
      return true;
    } catch (error) {
      await postCallSignal(session, "reject", {
        reason: "media-unavailable",
      }).catch(() => {});
      closeCall();
      say(
        error.name === "NotAllowedError"
          ? "Mikrofon yoki kameraga ruxsat bering."
          : "Qo‘ng‘iroqni qabul qilib bo‘lmadi.",
      );
      return false;
    }
  };
  const processCallSignal = async (signal) => {
    const peerId = dbRef.current.users.find(
      (user) => user.username === signal.from,
    )?.id;
    if (!peerId) return;
    if (signal.action === "invite") {
      if (callRef.current) {
        await postCallSignal({ id: signal.callId, peerId }, "reject", {
          reason: "busy",
        }).catch(() => {});
        return;
      }
      updateCall({
        id: signal.callId,
        peerId,
        mode: signal.payload.mode,
        direction: "incoming",
        status: "ringing",
        startedAt: Date.now(),
      });
      return;
    }
    const current = callRef.current;
    if (!current || current.id !== signal.callId || current.peerId !== peerId)
      return;
    if (signal.action === "accept") {
      updateCall({ ...current, status: "connecting" });
    } else if (signal.action === "offer") {
      const description = signal.payload.description;
      if (current.direction === "incoming" && current.status === "ringing")
        pendingCallOfferRef.current = description;
      else if (description && callLocalStreamRef.current)
        await answerCallOffer(current, description);
    } else if (signal.action === "answer") {
      const connection = callPeerConnectionRef.current;
      if (connection && signal.payload.description) {
        await connection.setRemoteDescription(
          new RTCSessionDescription(signal.payload.description),
        );
        await addPendingCallIce(connection);
      }
    } else if (signal.action === "candidate" && signal.payload) {
      const connection = callPeerConnectionRef.current;
      if (connection?.remoteDescription) {
        try {
          await connection.addIceCandidate(new RTCIceCandidate(signal.payload));
        } catch {
          /* ignore */
        }
      } else {
        pendingCallIceRef.current.push(signal.payload);
      }
    } else if (signal.action === "reject" || signal.action === "end") {
      closeCall();
      say(
        signal.action === "reject"
          ? "Qo‘ng‘iroq rad etildi."
          : "Qo‘ng‘iroq tugadi.",
      );
    }
  };
  callSignalHandlerRef.current = processCallSignal;
  useEffect(() => {
    let active = true;
    const checkAccess = async () => {
      if (document.hidden && meId) return;
      try {
        const response = await fetch("/plat/access/", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = await response.json();
        if (!active) return;
        setAccessInfo(data);
        setServiceOpen(Boolean(data.open));
      } catch {
        /* Keep the last server-provided schedule during temporary network errors. */
      }
    };
    checkAccess();
    const timer = setInterval(checkAccess, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [meId]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    ls.set("theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    let active = true;
    const reloadDatabase = async () => {
      try {
        const overflow = await readOverflowDatabase();
        if (!active) return;
        if (overflow) {
          overflowStorageRef.current = true;
          dbRef.current = overflow;
        } else {
          overflowStorageRef.current = false;
          dbRef.current = load();
        }
        setDb(dbRef.current);
      } catch {
        /* Fall back to localStorage when IndexedDB is unavailable. */
      }
    };
    const onStorage = (event) => {
      if (event.key === KEY || event.key === OVERFLOW_SIGNAL)
        void reloadDatabase();
    };
    void reloadDatabase();
    addEventListener("storage", onStorage);
    return () => {
      active = false;
      removeEventListener("storage", onStorage);
    };
  }, []);
  const say = (m) => {
    setToast(m);
    clearTimeout(say.t);
    say.t = setTimeout(() => setToast(null), 2600);
  };
  const persistDatabase = (value) => {
    const persistOverflow = () =>
      writeOverflowDatabase(value)
        .then(() => {
          try {
            localStorage.setItem(OVERFLOW_SIGNAL, String(Date.now()));
          } catch {
            /* Other tabs will refresh on their next load. */
          }
        })
        .catch(() =>
          say(
            "Brauzer xotirasi to‘ldi. Qurilmada joy bo‘shating va qayta urinib ko‘ring.",
          ),
        );
    if (overflowStorageRef.current) {
      dbRef.current = value;
      setDb(value);
      persistOverflow();
      return true;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      overflowStorageRef.current = true;
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* Continue with IndexedDB. */
      }
      dbRef.current = value;
      setDb(value);
      persistOverflow();
      return true;
    }
    dbRef.current = value;
    setDb(value);
    return true;
  };
  const save = (fn, { skipRemoteSync = false } = {}) => {
    if (meId && !serviceOpen) {
      say(
        accessInfo.reason === "cooldown"
          ? `Tanaffus: ${Math.ceil((accessInfo.cooldownSeconds || accessInfo.cooldownMinutes * 60) / 60)} daqiqa.`
          : `Platforma yopiq: ${accessInfo.start || "08:00"}–${accessInfo.end || "22:00"}.`,
      );
      return false;
    }
    const n = structuredClone(dbRef.current);
    fn(n);
    if (skipRemoteSync) skipSocialSyncRef.current += 1;
    return persistDatabase(n);
  };
  const sendFastAction = async (action) => {
    const token = await ensureCsrfToken();
    const response = await fetch("/plat/social/fast/", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRFToken": token },
      body: JSON.stringify(action),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(result.error || "Amalni serverga yuborib bo‘lmadi.");
    return result;
  };
  useEffect(() => {
    let active = true;
    const syncFromServer = async () => {
      try {
        // Avval sessionni tekshiramiz. Eski localStorage login yozuvi qolgan bo‘lsa,
        // server sessiyasi yo‘q paytda /plat/social/ ga 403 yubormaymiz.
        const sessionResponse = await fetch("/plat/session/", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!sessionResponse.ok)
          throw new Error("Server sessiyasini tekshirib bo‘lmadi");
        const session = await sessionResponse.json().catch(() => ({}));
        if (!active) return;
        if (!session.authenticated) {
          const existingUser = meId
            ? dbRef.current.users.find((user) => user.id === meId)
            : null;
          if (!existingUser && meId) {
            clearMeId();
            setMeId(null);
            setSocialReadyUser(null);
          }
          return;
        }
        if (meId) {
          const sessionUsername = String(session.username || "").trim().toLowerCase();
          const currentUser = dbRef.current.users.find(
            (user) =>
              user.id === meId ||
              String(user.username || "").trim().toLowerCase() === sessionUsername,
          );
          if (
            !currentUser ||
            String(currentUser.username || "").trim().toLowerCase() !== sessionUsername
          ) {
            const fallbackUser = dbRef.current.users.find(
              (user) =>
                String(user.username || "").trim().toLowerCase() === sessionUsername,
            );
            if (fallbackUser) {
              storeMeId(fallbackUser.id);
              setMeId(fallbackUser.id);
              return;
            }
            if (meId) {
              clearMeId();
              setMeId(null);
              setSocialReadyUser(null);
            }
            return;
          }
        }

        const accountsResponse = await fetch("/plat/users/", {
          credentials: "same-origin",
        });
        if (!accountsResponse.ok) throw new Error("Userlarni yuklab bo‘lmadi");
        const accounts = await accountsResponse.json();
        if (!active) return;
        save((d) => {
          const accountNames = new Set(
            accounts.map((account) => account.username),
          );
          d.users = d.users.filter(
            (user) =>
              !String(user.id).startsWith("server-") ||
              accountNames.has(user.username),
          );
          accounts.forEach((account) => {
            const existing = d.users.find(
              (user) => user.username === account.username,
            );
            if (existing) {
              existing.name = account.name || existing.name;
              existing.email = account.email || existing.email || "";
            } else
              d.users.push({
                id: `server-${account.id}`,
                username: account.username,
                email: account.email || "",
                name: account.name,
                bio: "",
                avatar: null,
                t: Date.now(),
              });
          });
        });
        // Django sessioni haqiqiy akkauntning manbai. LocalStorage o‘chib qolgan bo‘lsa ham
        // sessiondagi akkauntni qayta tiklaymiz — foydalanuvchi qayta login qilmaydi.
        const sessionAccount =
          accounts.find((account) => account.username === session.username) ||
          session;
        if (sessionAccount) {
          const localUser = dbRef.current.users.find(
            (user) => user.username === sessionAccount.username,
          );
          const resolvedId = localUser?.id || `server-${sessionAccount.id}`;
          save((d) => {
            const existing = d.users.find(
              (user) => user.username === sessionAccount.username,
            );
            if (existing) {
              existing.name = sessionAccount.name || existing.name;
              existing.email = sessionAccount.email || existing.email || "";
              existing.isAdmin = Boolean(session.isAdmin);
            } else {
              d.users.push({
                id: resolvedId,
                username: sessionAccount.username,
                email: sessionAccount.email || "",
                name: sessionAccount.name || sessionAccount.username,
                bio: "",
                avatar: null,
                isAdmin: Boolean(session.isAdmin),
                t: Date.now(),
              });
            }
          });
          if (meId !== resolvedId) {
            storeMeId(resolvedId);
            setMeId(resolvedId);
            return;
          }
        }
        if (!meId) return;

        const stateResponse = await fetch("/plat/social/", {
          credentials: "same-origin",
        });
        const remote = await stateResponse.json().catch(() => ({}));
        if (!stateResponse.ok) {
          if (isAuthenticationFailure(stateResponse, remote)) {
            clearMeId();
            setMeId(null);
            setSocialReadyUser(null);
            return;
          }
          throw new Error("Ma’lumotlarni yuklab bo‘lmadi");
        }
        if (!active) return;
        const localId = (username) =>
          dbRef.current.users.find((user) => user.username === username)?.id ||
          username;
        const restored = {
          posts: remote.posts.map((post) => ({
            ...post,
            userId: localId(post.userId),
            likes: post.likes.map(localId),
            comments: post.comments.map((comment) => ({
              ...comment,
              userId: localId(comment.userId),
            })),
          })),
          reels: remote.reels.map((reel) => ({
            ...reel,
            userId: localId(reel.userId),
            likes: reel.likes.map(localId),
            comments: (reel.comments || []).map((comment) => ({
              ...comment,
              userId: localId(comment.userId),
            })),
          })),
          stories: remote.stories.map((story) => ({
            ...story,
            userId: localId(story.userId),
          })),
          seenStories: remote.seenStories.map((item) => ({
            ...item,
            viewerId: localId(item.viewerId),
          })),
          follows: remote.follows.map((follow) => ({
            ...follow,
            a: localId(follow.a),
            b: localId(follow.b),
          })),
          messages: remote.messages.map((message) => ({
            ...message,
            from: localId(message.from),
            to: localId(message.to),
            hiddenFor: (message.hiddenFor || []).map(localId),
            reactions: Object.fromEntries(
              Object.entries(message.reactions || {}).map(
                ([username, emoji]) => [localId(username), emoji],
              ),
            ),
          })),
          deletedMessages: remote.deletedMessages.map((message) => ({
            ...message,
            from: localId(message.from),
            to: localId(message.to),
          })),
          hiddenChats: remote.hiddenChats.map((chat) => ({
            ...chat,
            owner: localId(chat.owner),
            peer: localId(chat.peer),
          })),
          blockedUsers: remote.blockedUsers.map(localId),
          blockedByUsers: remote.blockedByUsers.map(localId),
          notifs: remote.notifs.map((notif) => ({
            ...notif,
            from: localId(notif.from),
            to: localId(notif.to),
          })),
          saved: Object.fromEntries(
            Object.entries(remote.saved).map(([username, posts]) => [
              localId(username),
              posts,
            ]),
          ),
        };
        const serverMessageIds = new Set(
          restored.messages.map((message) => String(message.id)),
        );
        const deletedMessageIds = new Set(
          restored.deletedMessages.map((message) => String(message.id)),
        );
        const hiddenCutoffs = new Map(
          restored.hiddenChats.map((chat) => [chat.peer, chat.cutoff]),
        );
        const hiddenChatMessageIds = new Set(
          restored.hiddenChats
            .flatMap((chat) => chat.messageIds || [])
            .map(String),
        );
        const unsyncedLocalMessages = dbRef.current.messages.filter(
          (message) => {
            if (message.from !== meId && message.to !== meId) return false;
            if (
              serverMessageIds.has(String(message.id)) ||
              deletedMessageIds.has(String(message.id)) ||
              hiddenChatMessageIds.has(String(message.id))
            )
              return false;
            const peerId = message.from === meId ? message.to : message.from;
            return message.t > (hiddenCutoffs.get(peerId) || 0);
          },
        );
        restored.messages = [...restored.messages, ...unsyncedLocalMessages];
        messageCursorRef.current = restored.messages.reduce(
          (cursor, message) =>
            Math.max(cursor, Number(message.t) || 0),
          messageCursorRef.current,
        );
        save((d) => {
          Object.assign(d, restored);
        });
        setSocialReadyUser(meId);
      } catch {
        if (active && meId) say("Server bilan sinxronlash amalga oshmadi");
      }
    };
    syncFromServer();
    return () => {
      active = false;
    };
  }, [meId]);
  const byId = (id) => db.users.find((u) => u.id === id);
  useEffect(() => {
    if (!me || socialReadyUser !== meId) return;
    if (skipSocialSyncRef.current) {
      skipSocialSyncRef.current -= 1;
      return;
    }
    const run = async () => {
      try {
        const body = JSON.stringify(serializeSocialState(dbRef.current));
        const sync = (token) =>
          fetch("/plat/social/", {
            method: "PUT",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": token,
            },
            body,
          });
        let response = await sync(csrfToken());
        let result = await response.json().catch(() => ({}));
        if (
          response.status === 403 &&
          /csrf failed/i.test(result.detail || "")
        ) {
          const freshToken = await ensureCsrfToken(true);
          if (freshToken) {
            response = await sync(freshToken);
            result = await response.json().catch(() => ({}));
          }
        }
        if (isAuthenticationFailure(response, result)) {
          const currentUser = dbRef.current.users.find((user) => user.id === meId);
          if (!currentUser && meId) {
            clearMeId();
            setMeId(null);
            setSocialReadyUser(null);
          }
          return;
        }
        if (response.status === 403 && result.reason) {
          setAccessInfo((current) => ({ ...current, ...result, open: false }));
          setServiceOpen(false);
          return;
        }
        if (!response.ok)
          throw new Error(
            result.error || result.detail || "Sinxronlash amalga oshmadi",
          );
        if (response.ok) {
          if (
            result.moderation?.length ||
            result.rejectedMedia?.length ||
            result.sanitizedMessages?.length ||
            result.blockedMessages?.length
          ) {
            const next = structuredClone(dbRef.current);
            const fields = {
              post: "posts",
              reel: "reels",
              story: "stories",
              message: "messages",
            };
            [
              ...(result.moderation || []),
              ...(result.rejectedMedia || []),
            ].forEach((item) => {
              const field = fields[item.type];
              if (field)
                next[field] = next[field].filter(
                  (content) => String(content.id) !== String(item.id),
                );
            });
            const sanitizedIds = new Set(
              (result.sanitizedMessages || []).map(String),
            );
            next.messages.forEach((message) => {
              if (sanitizedIds.has(String(message.id))) message.text = "";
            });
            const blockedIds = new Set(
              (result.blockedMessages || []).map(String),
            );
            next.messages = next.messages.filter(
              (message) => !blockedIds.has(String(message.id)),
            );
            persistDatabase(next);
            say(
              result.sanitizedMessages?.length
                ? "Rasm chatga yuborildi; xavfsizlik uchun matn olib tashlandi."
                : result.moderation?.length
                  ? "Kontent admin tekshiruviga yuborildi."
                  : result.rejectedMedia?.length
                    ? "Caption 7+ xavfsizlik filtri tomonidan rad etildi."
                    : "Bu foydalanuvchi xabarlarni bloklagan.",
            );
          }
        }
      } catch {
        say("Server bilan sinxronlash amalga oshmadi");
      }
    };
    const timeout = setTimeout(() => {
      syncChain.current = syncChain.current.catch(() => {}).then(run);
    }, 250);
    return () => clearTimeout(timeout);
  }, [db, meId, socialReadyUser]);
  const unreadN = me
    ? db.notifs.filter((n) => n.to === me.id && !n.read).length
    : 0;
  const unreadM = me
    ? new Set(
        db.messages
          .filter((m) => m.to === me.id && !m.read)
          .map((message) => message.from),
      ).size
    : 0;
  const prevN = useRef(0);
  useEffect(() => {
    if (me && unreadN > prevN.current) {
      const n = db.notifs.find((x) => x.to === me.id && !x.read),
        u = n && byId(n.from);
      if (u)
        say(
          `${u.username} ${n.type === "follow" ? "sizni follow qilishni boshladi" : n.type === "like" ? "postingizni yoqtirdi" : "izoh qoldirdi"}`,
        );
    }
    prevN.current = unreadN;
  }, [unreadN]);
  const notify = (d, to, type, x = {}) => {
    if (to !== meId)
      d.notifs.unshift({
        id: uid(),
        to,
        from: meId,
        type,
        t: Date.now(),
        read: false,
        ...x,
      });
  };
  const blockRestrictedAction = () => {
    const restriction = accessInfo.restriction;
    if (!restriction?.active) return false;
    const until = restriction.until
      ? new Date(restriction.until).toLocaleString("uz-UZ")
      : "";
    say(
      `Admin cheklovi faol${until ? `: ${until} gacha` : ""}. Xabar, like va follow vaqtincha yopiq.`,
    );
    return true;
  };
  const logCallMessage = async (session, status) => {
    if (!session || !session.peerId || !meId) return false;
    const target = dbRef.current.users.find((user) => user.id === session.peerId);
    if (!target) return false;
    const duration =
      session.connectedAt && Number.isFinite(session.connectedAt)
        ? Math.max(
            0,
            Math.min(86400, Math.round((Date.now() - session.connectedAt) / 1000)),
          )
        : 0;
    const message = {
      id: uid(),
      from: meId,
      to: session.peerId,
      text: "",
      t: Date.now(),
      read: false,
      callEvent: {
        mode: session.mode || "audio",
        status,
        duration,
      },
    };
    if (!save((d) => d.messages.push(message), { skipRemoteSync: true }))
      return false;
    try {
      await sendFastAction({
        action: "call-log",
        message: { ...message, to: target.username },
      });
      return true;
    } catch (error) {
      save(
        (d) => {
          d.messages = d.messages.filter((item) => item.id !== message.id);
        },
        { skipRemoteSync: true },
      );
      say(error.message);
      return false;
    }
  };
  const startCall = async (peerId, mode) => {
    if (callRef.current) {
      say("Boshqa qo‘ng‘iroq davom etmoqda.");
      return false;
    }
    if (
      dbRef.current.blockedUsers.includes(peerId) ||
      dbRef.current.blockedByUsers.includes(peerId)
    ) {
      say("Bloklangan foydalanuvchiga qo‘ng‘iroq qilib bo‘lmaydi.");
      return false;
    }
    const session = {
      id: callSessionId(),
      peerId,
      mode,
      direction: "outgoing",
      status: "calling",
      startedAt: Date.now(),
      muted: false,
      cameraOff: false,
    };
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Bu brauzer mikrofon/kamera ruxsatini qo‘llab-quvvatlamaydi.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === "video",
      });
      callLocalStreamRef.current = stream;
      setCallLocalStream(stream);
      updateCall(session);
      const connection = createCallPeerConnection(session);
      await postCallSignal(session, "invite", { mode });
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      await postCallSignal(session, "offer", {
        description: connection.localDescription.toJSON(),
      });
      return true;
    } catch (error) {
      closeCall();
      say(
        error.name === "NotAllowedError"
          ? "Qo‘ng‘iroq uchun mikrofon yoki kameraga ruxsat bering."
          : error.message || "Qo‘ng‘iroqni boshlab bo‘lmadi.",
      );
      return false;
    }
  };
  const endCall = async () => {
    const session = callRef.current;
    if (!session) return;
    await logCallMessage(session, "ended");
    await postCallSignal(session, "end").catch(() => {});
    closeCall();
  };
  const rejectCall = async () => {
    const session = callRef.current;
    if (!session) return;
    await logCallMessage(session, "declined");
    await postCallSignal(session, "reject").catch(() => {});
    closeCall();
  };
  const toggleCallMute = () => {
    const session = callRef.current;
    if (!session) return;
    const muted = !session.muted;
    callLocalStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    updateCall({ ...session, muted });
  };
  const toggleCallCamera = () => {
    const session = callRef.current;
    if (!session) return;
    const cameraOff = !session.cameraOff;
    callLocalStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff;
    });
    updateCall({ ...session, cameraOff });
  };
  const A = {
    toast: say,
    validateRegister: ({ username, email, name, password }) => {
      const normalizedUsername = String(username || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return "To‘g‘ri email manzil kiriting";
      if (normalizedUsername.length < 3) return "Username kamida 3 ta belgi";
      if (!name.trim()) return "Ismingizni kiriting";
      if (password.length < 4) return "Parol kamida 4 ta belgi";
      if (
        dbRef.current.users.some(
          (u) => u.username.toLowerCase() === normalizedUsername,
        )
      )
        return "Bu username band";
    },
    register: ({ username, email, name }, account) => {
      const normalizedUsername = String(username || "").trim().toLowerCase();
      const existing = dbRef.current.users.find(
        (user) => user.username.toLowerCase() === normalizedUsername,
      );
      const id = existing?.id || `server-${account.id}`;
      save((d) => {
        const user = d.users.find(
          (item) => item.username.toLowerCase() === normalizedUsername,
        );
        if (user)
          Object.assign(user, {
            username: normalizedUsername,
            name: name.trim(),
            email: email.trim(),
            isAdmin: Boolean(account.isAdmin),
          });
        else
          d.users.push({
            id,
            username: normalizedUsername,
            email: email.trim(),
            name: name.trim(),
            bio: "",
            avatar: null,
            isAdmin: Boolean(account.isAdmin),
            t: Date.now(),
          });
      });
      storeMeId(id);
      setMeId(id);
    },
    login: ({ username }, account) => {
      const normalizedUsername = String(username || "").trim().toLowerCase();
      const existing = dbRef.current.users.find(
        (user) => user.username.toLowerCase() === normalizedUsername,
      );
      const id = existing?.id || `server-${account.id}`;
      save((d) => {
        const user = d.users.find(
          (item) => item.username.toLowerCase() === normalizedUsername,
        );
        if (user) {
          user.name = account.name || user.name;
          user.email = account.email || user.email || "";
          user.username = normalizedUsername;
          user.isAdmin = Boolean(account.isAdmin);
        } else
          d.users.push({
            id,
            username: normalizedUsername,
            email: account.email || "",
            name: account.name,
            bio: "",
            avatar: null,
            isAdmin: Boolean(account.isAdmin),
            t: Date.now(),
          });
      });
      storeMeId(id);
      setMeId(id);
      navigate("/");
    },
    logout: () => {
      fetch("/plat/logout/", {
        method: "POST",
        headers: { "X-CSRFToken": csrfToken() },
      }).catch(() => {});
      clearMeId();
      setMeId(null);
      setSocialReadyUser(null);
    },
    toggleTheme: () => setDark((value) => !value),
    updateAccessInfo: (value) => {
      setAccessInfo((current) => ({ ...current, ...value }));
      if (typeof value.open === "boolean") setServiceOpen(value.open);
    },
    follow: (id) => {
      if (blockRestrictedAction()) return false;
      const user = byId(id);
      if (!user || user.id === meId) return false;
      const had = dbRef.current.follows.some(
        (follow) => follow.a === meId && follow.b === id,
      );
      if (
        !save(
          (d) => {
            if (had)
              d.follows = d.follows.filter(
                (follow) => !(follow.a === meId && follow.b === id),
              );
            else d.follows.push({ a: meId, b: id });
          },
          { skipRemoteSync: true },
        )
      )
        return false;
      say(
        had
          ? `${user.username} follow’dan chiqarildi`
          : `Siz ${user.username} ni follow qilishni boshladingiz ✓`,
      );
      sendFastAction({
        action: had ? "unfollow" : "follow",
        username: user.username,
      }).catch((error) => {
        save(
          (d) => {
            d.follows = d.follows.filter(
              (follow) => !(follow.a === meId && follow.b === id),
            );
            if (had) d.follows.push({ a: meId, b: id });
          },
          { skipRemoteSync: true },
        );
        say(error.message);
      });
      return true;
    },
    like: (id, kind = "post") => {
      if (blockRestrictedAction()) return false;
      const arr =
        kind === "reel" ? dbRef.current.reels : kind === "story" ? dbRef.current.stories : dbRef.current.posts;
      if (!arr.some((item) => item.id === id)) return false;
      const saved = save((d) => {
        const items =
          kind === "reel" ? d.reels : kind === "story" ? d.stories : d.posts;
        const item = items.find((x) => x.id === id);
        if (!item) return;
        item.likes ||= [];
        if (item.likes.includes(meId))
          item.likes = item.likes.filter((x) => x !== meId);
        else item.likes.push(meId);
      }, { skipRemoteSync: true });
      if (!saved) return false;
      sendFastAction({ action: "like", itemId: id, kind })
        .then(() => A.refreshSocialUpdates())
        .catch(async (error) => {
          await A.refreshSocialUpdates();
          say(error.message);
        });
      return true;
    },
    comment: (id, text, kind = "post") => {
      if (blockRestrictedAction()) return false;
      const commentText = text.trim();
      if (!commentText || commentText.length > 500 || kidsUnsafeText(commentText)) {
        say("Haqoratli yoki 7+ ga mos bo‘lmagan izoh yuborilmadi.");
        return false;
      }
      const arr = kind === "reel" ? dbRef.current.reels : dbRef.current.posts;
      if (!arr.some((item) => item.id === id)) return false;
      const comment = { id: uid(), userId: meId, text: commentText, t: Date.now() };
      const saved = save((d) => {
        const arr = kind === "reel" ? d.reels : d.posts;
        const item = arr.find((x) => x.id === id);
        if (!item) return;
        item.comments ||= [];
        item.comments.push(comment);
      }, { skipRemoteSync: true });
      if (!saved) return false;
      sendFastAction({
        action: "comment",
        itemId: id,
        kind,
        commentId: comment.id,
        text: comment.text,
      })
        .then(() => A.refreshSocialUpdates())
        .catch(async (error) => {
          await A.refreshSocialUpdates();
          say(error.message);
        });
      return true;
    },
    editComment: (itemId, commentId, text, kind = "post") => {
      if (blockRestrictedAction()) return false;
      const updatedText = text.trim();
      if (!updatedText || updatedText.length > 500 || kidsUnsafeText(updatedText)) {
        say("Izoh 1–500 belgi bo‘lishi va 7+ xavfsizlik talabiga mos bo‘lishi kerak.");
        return false;
      }
      const arr = kind === "reel" ? dbRef.current.reels : dbRef.current.posts;
      const item = arr.find((entry) => entry.id === itemId);
      const comment = item?.comments?.find((entry) => entry.id === commentId);
      if (!comment || comment.userId !== meId) return false;
      const saved = save((d) => {
        const target = (kind === "reel" ? d.reels : d.posts).find(
          (entry) => entry.id === itemId,
        );
        const current = target?.comments?.find(
          (entry) => entry.id === commentId,
        );
        if (current?.userId === meId) current.text = updatedText;
      }, { skipRemoteSync: true });
      if (!saved) return false;
      sendFastAction({
        action: "edit-comment",
        itemId,
        commentId,
        kind,
        text: updatedText,
      })
        .then(() => A.refreshSocialUpdates())
        .catch(async (error) => {
          await A.refreshSocialUpdates();
          say(error.message);
        });
      return true;
    },
    deleteComment: (itemId, commentId, kind = "post") => {
      const arr = kind === "reel" ? dbRef.current.reels : dbRef.current.posts;
      const item = arr.find((entry) => entry.id === itemId);
      const comment = item?.comments?.find((entry) => entry.id === commentId);
      if (!comment || comment.userId !== meId) return false;
      const saved = save((d) => {
        const target = (kind === "reel" ? d.reels : d.posts).find(
          (entry) => entry.id === itemId,
        );
        if (!target) return;
        target.comments = (target.comments || []).filter(
          (entry) => entry.id !== commentId || entry.userId !== meId,
        );
      }, { skipRemoteSync: true });
      if (!saved) return false;
      sendFastAction({
        action: "delete-comment",
        itemId,
        commentId,
        kind,
      })
        .then(() => A.refreshSocialUpdates())
        .catch(async (error) => {
          await A.refreshSocialUpdates();
          say(error.message);
        });
      return true;
    },
    save: (id) =>
      save((d) => {
        const s = d.saved[meId] || [];
        d.saved[meId] = s.includes(id) ? s.filter((x) => x !== id) : [...s, id];
      }),
    post: (image, caption) => {
      if (blockRestrictedAction()) return false;
      const mediaError = kidsUnsafeDataUrl(image);
      if (mediaError || kidsUnsafeText(caption)) {
        say(mediaError || "Caption 7+ xavfsizlik filtri tomonidan rad etildi.");
        return false;
      }
      const ok = save((d) => {
        d.posts.unshift({
          id: uid(),
          userId: meId,
          image,
          caption,
          t: Date.now(),
          likes: [],
          comments: [],
        });
      });
      if (ok) {
        say("Post ulashildi ✓");
        navigate(`/profile/${meId}`);
      }
      return ok;
    },
    reel: (media, caption) => {
      if (blockRestrictedAction()) return false;
      const mediaError = kidsUnsafeDataUrl(media);
      if (mediaError || kidsUnsafeText(caption)) {
        say(
          mediaError ||
            "Reels matni 7+ xavfsizlik filtri tomonidan rad etildi.",
        );
        return false;
      }
      const saved = save((d) => {
        d.reels.unshift({
          id: uid(),
          userId: meId,
          media,
          type: "video",
          caption,
          t: Date.now(),
          likes: [],
          comments: [],
        });
      });
      if (!saved) return false;
      say("Reels ulashildi ✓");
      navigate("/reels");
      return true;
    },
    story: (media, type = "image", caption = "", sourceReel = false) => {
      if (blockRestrictedAction()) return false;
      const mediaError = kidsUnsafeDataUrl(media);
      if (mediaError || kidsUnsafeText(caption)) {
        say(
          mediaError ||
            "Story matni 7+ xavfsizlik filtri tomonidan rad etildi.",
        );
        return false;
      }
      const ok = save((d) => {
        d.stories = d.stories.filter(
          (s) => !(s.userId === meId && s.t < Date.now() - 864e5),
        );
        d.stories.push({
          id: uid(),
          userId: meId,
          media,
          type,
          caption,
          sourceReel,
          likes: [],
          t: Date.now(),
        });
      });
      if (ok) say("Story qo‘shildi ✓");
      return ok;
    },
    viewStory: (id) => {
      if (
        dbRef.current.seenStories.some(
          (item) => item.viewerId === meId && item.storyId === id,
        )
      )
        return;
      save((d) => {
        d.seenStories.push({ viewerId: meId, storyId: id, t: Date.now() });
      });
    },
    refreshStoryViews: async () => {
      try {
        const response = await fetch("/plat/social/");
        if (!response.ok) return;
        const remote = await response.json();
        const localId = (username) =>
          dbRef.current.users.find((user) => user.username === username)?.id ||
          username;
        const remoteViews = remote.seenStories.map((item) => ({
          ...item,
          viewerId: localId(item.viewerId),
        }));
        save((d) => {
          const views = new Map(
            d.seenStories.map((item) => [
              `${item.storyId}:${item.viewerId}`,
              item,
            ]),
          );
          remoteViews.forEach((item) =>
            views.set(`${item.storyId}:${item.viewerId}`, item),
          );
          d.seenStories = [...views.values()];
        });
      } catch {
        /* ignore */
      }
    },
    addSearch: (id) =>
      save((d) => {
        d.searchHistory = [
          ...d.searchHistory.filter((item) => item !== id),
          id,
        ].slice(-12);
      }),
    removeSearch: (id) =>
      save((d) => {
        d.searchHistory = d.searchHistory.filter((item) => item !== id);
      }),
    clearSearchHistory: () =>
      save((d) => {
        d.searchHistory = [];
      }),
    del: (id) => {
      save((d) => {
        d.posts = d.posts.filter((p) => p.id !== id);
      });
      say("Post o‘chirildi");
    },
    delReel: (id) => {
      save((d) => {
        d.reels = d.reels.filter((r) => !(r.id === id && r.userId === meId));
      });
      say("Reels o‘chirildi");
    },
    send: (to, x) => {
      if (blockRestrictedAction()) return false;
      if (
        dbRef.current.blockedUsers.includes(to) ||
        dbRef.current.blockedByUsers.includes(to)
      ) {
        say("Bu suhbatda xabar yuborib bo‘lmaydi.");
        return false;
      }
      if (kidsUnsafeText(x?.text)) {
        say("Haqoratli yoki 7+ ga mos bo‘lmagan xabar yuborilmadi.");
        return false;
      }
      if (x?.src) {
        const mediaError = kidsUnsafeDataUrl(x.src);
        if (mediaError) {
          say(mediaError);
          return false;
        }
      }
      const target = dbRef.current.users.find((user) => user.id === to);
      if (!target) return false;
      const message = {
        id: uid(),
        from: meId,
        to,
        t: Date.now(),
        read: false,
        ...x,
      };
      if (
        !save(
          (d) => {
            d.messages.push(message);
          },
          { skipRemoteSync: true },
        )
      )
        return false;
      sendFastAction({
        action: "message",
        message: { ...message, to: target.username },
      })
        .then((result) => {
          if (result.moderation?.length) {
            save(
              (d) => {
                d.messages = d.messages.filter(
                  (item) => String(item.id) !== String(message.id),
                );
              },
              { skipRemoteSync: true },
            );
            say("Xabar admin tekshiruviga yuborildi.");
          } else if (result.sanitized) {
            save(
              (d) => {
                const item = d.messages.find(
                  (value) => value.id === message.id,
                );
                if (item) item.text = "";
              },
              { skipRemoteSync: true },
            );
            say("Xabar xavfsizlik uchun tahrirlandi.");
          }
        })
        .catch((error) => {
          save(() => {});
          say(error.message);
        });
      return true;
    },
    reactMessage: (id) => {
      const message = dbRef.current.messages.find(
        (item) => String(item.id) === String(id),
      );
      if (
        !message ||
        message.callEvent ||
        message.mediaType === "audio" ||
        (message.from !== meId && message.to !== meId)
      )
        return false;
      const previous = { ...(message.reactions || {}) };
      const next = { ...previous };
      if (next[meId] === "❤️") delete next[meId];
      else next[meId] = "❤️";
      if (
        !save(
          (d) => {
            const current = d.messages.find(
              (item) => String(item.id) === String(id),
            );
            if (current) current.reactions = next;
          },
          { skipRemoteSync: true },
        )
      )
        return false;
      sendFastAction({ action: "react", messageId: message.id, emoji: "❤️" })
        .then((result) => {
          const reactions = Object.fromEntries(
            Object.entries(result.reactions || {}).map(([username, emoji]) => [
              dbRef.current.users.find((user) => user.username === username)
                ?.id || username,
              emoji,
            ]),
          );
          save(
            (d) => {
              const current = d.messages.find(
                (item) => String(item.id) === String(id),
              );
              if (current) current.reactions = reactions;
            },
            { skipRemoteSync: true },
          );
        })
        .catch((error) => {
          save(
            (d) => {
              const current = d.messages.find(
                (item) => String(item.id) === String(id),
              );
              if (current) current.reactions = previous;
            },
            { skipRemoteSync: true },
          );
          say(error.message);
        });
      return true;
    },
    updateVoiceDuration: (id, duration) => {
      const message = dbRef.current.messages.find(
        (item) => String(item.id) === String(id),
      );
      if (
        !message ||
        message.mediaType !== "audio" ||
        !Number.isFinite(duration)
      )
        return false;
      const corrected = Math.max(1, Math.min(86400, Math.round(duration)));
      if (message.mediaDuration === corrected) return true;
      if (
        !save(
          (d) => {
            const current = d.messages.find(
              (item) => String(item.id) === String(id),
            );
            if (current) current.mediaDuration = corrected;
          },
          { skipRemoteSync: true },
        )
      )
        return false;
      sendFastAction({
        action: "voice-duration",
        messageId: message.id,
        duration: corrected,
      }).catch(() => {});
      return true;
    },
    editMessage: (id, text) => {
      if (blockRestrictedAction()) return false;
      if (kidsUnsafeText(text)) {
        say("Haqoratli yoki 7+ ga mos bo‘lmagan xabar yuborilmadi.");
        return false;
      }
      const message = dbRef.current.messages.find((item) => item.id === id);
      if (!message || message.from !== meId || !text.trim()) return;
      save((d) => {
        const item = d.messages.find((value) => value.id === id);
        item.text = text.trim();
        item.edited = true;
      });
    },
    deleteMessage: (id, everyone = false) => {
      const message = dbRef.current.messages.find((item) => item.id === id);
      if (!message || (everyone && message.from !== meId)) return;
      save((d) => {
        if (everyone) {
          if (!d.deletedMessages.some((item) => item.id === id))
            d.deletedMessages.push({ id, from: message.from, to: message.to });
        } else {
          const item = d.messages.find((value) => value.id === id);
          item.hiddenFor ||= [];
          if (!item.hiddenFor.includes(meId)) item.hiddenFor.push(meId);
        }
      });
    },
    refreshSocialUpdates: async () => {
      try {
        const since = Math.max(0, messageCursorRef.current - 3000);
        const response = await fetch(`/plat/social/updates/?since=${since}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) return;
        const remote = await response.json();
        const localId = (username) =>
          dbRef.current.users.find((user) => user.username === username)?.id ||
          username;
        const restoreInteractions = (items) =>
          (items || []).map((item) => ({
            ...item,
            likes: (item.likes || []).map(localId),
            comments: (item.comments || []).map((comment) => ({
              ...comment,
              userId: localId(comment.userId),
            })),
          }));
        const interactions = {
          posts: restoreInteractions(remote.postInteractions),
          reels: restoreInteractions(remote.reelInteractions),
          stories: restoreInteractions(remote.storyInteractions),
        };
        const interactionsChanged = Object.entries(interactions).some(
          ([key, updates]) => {
            const localItems = new Map(
              dbRef.current[key].map((item) => [String(item.id), item]),
            );
            return updates.some((update) => {
              const item = localItems.get(String(update.id));
              return (
                item &&
                (JSON.stringify(item.likes || []) !==
                  JSON.stringify(update.likes) ||
                  JSON.stringify(item.comments || []) !==
                    JSON.stringify(update.comments))
              );
            });
          },
        );
        const current = dbRef.current.messages;
        const currentById = new Map(
          current.map((message) => [String(message.id), message]),
        );
        const readIds = new Set((remote.readMessageIds || []).map(String));
        const reactionUpdates = new Map(
          (remote.messageReactions || []).map((item) => [
            String(item.id),
            Object.fromEntries(
              Object.entries(item.reactions || {}).map(([username, emoji]) => [
                localId(username),
                emoji,
              ]),
            ),
          ]),
        );
        const durationUpdates = new Map(
          (remote.voiceDurations || []).map((item) => [
            String(item.id),
            item.duration,
          ]),
        );
        const incoming = remote.messages.map((message) => {
          const restored = {
            ...message,
            from: localId(message.from),
            to: localId(message.to),
            hiddenFor: (message.hiddenFor || []).map(localId),
          };
          const local = currentById.get(String(restored.id));
          if (readIds.has(String(restored.id)) || local?.read)
            restored.read = true;
          if (reactionUpdates.has(String(restored.id)))
            restored.reactions = reactionUpdates.get(String(restored.id));
          if (durationUpdates.has(String(restored.id)))
            restored.mediaDuration = durationUpdates.get(String(restored.id));
          return restored;
        });
        messageCursorRef.current = incoming.reduce(
          (cursor, message) => Math.max(cursor, Number(message.t) || 0),
          messageCursorRef.current,
        );
        const deleted = remote.deletedMessages.map((message) => ({
          ...message,
          from: localId(message.from),
          to: localId(message.to),
        }));
        const hiddenChats = remote.hiddenChats.map((chat) => ({
          ...chat,
          owner: localId(chat.owner),
          peer: localId(chat.peer),
        }));
        const blockedUsers = remote.blockedUsers.map(localId);
        const blockedByUsers = remote.blockedByUsers.map(localId);
        const follows = remote.follows.map((follow) => ({
          ...follow,
          a: localId(follow.a),
          b: localId(follow.b),
        }));
        const oldNotifs = new Map(
          dbRef.current.notifs
            .filter((notif) => notif.to === meId)
            .map((notif) => [String(notif.id), notif]),
        );
        const incomingNotifs = remote.notifs.map((notif) => {
          const restored = {
            ...notif,
            from: localId(notif.from),
            to: localId(notif.to),
          };
          if (oldNotifs.get(String(restored.id))?.read) restored.read = true;
          return restored;
        });
        const notifs = [
          ...dbRef.current.notifs.filter((notif) => notif.to !== meId),
          ...incomingNotifs,
        ];
        const messagesChanged =
          incoming.some((message) => {
            const old = currentById.get(String(message.id));
            return (
              !old ||
              old.read !== message.read ||
              old.text !== message.text ||
              old.src !== message.src ||
              old.edited !== message.edited ||
              old.mediaDuration !== message.mediaDuration ||
              JSON.stringify(old.hiddenFor || []) !==
                JSON.stringify(message.hiddenFor || []) ||
              JSON.stringify(old.reactions || {}) !==
                JSON.stringify(message.reactions || {})
            );
          }) ||
          current.some(
            (message) => readIds.has(String(message.id)) && !message.read,
          ) ||
          [...reactionUpdates].some(
            ([id, reactions]) =>
              JSON.stringify(currentById.get(id)?.reactions || {}) !==
              JSON.stringify(reactions),
          ) ||
          [...durationUpdates].some(
            ([id, duration]) => currentById.get(id)?.mediaDuration !== duration,
          );
        const changed =
          messagesChanged ||
          interactionsChanged ||
          JSON.stringify(dbRef.current.follows) !== JSON.stringify(follows) ||
          JSON.stringify(dbRef.current.notifs) !== JSON.stringify(notifs) ||
          JSON.stringify(dbRef.current.deletedMessages) !==
            JSON.stringify(deleted) ||
          JSON.stringify(dbRef.current.hiddenChats) !==
            JSON.stringify(hiddenChats) ||
          JSON.stringify(dbRef.current.blockedUsers) !==
            JSON.stringify(blockedUsers) ||
          JSON.stringify(dbRef.current.blockedByUsers) !==
            JSON.stringify(blockedByUsers);
        if (!changed) return;
        save(
          (d) => {
            const messages = new Map(
              d.messages.map((message) => [message.id, message]),
            );
            incoming.forEach((message) => messages.set(message.id, message));
            messages.forEach((message) => {
              if (readIds.has(String(message.id))) message.read = true;
              if (reactionUpdates.has(String(message.id)))
                message.reactions = reactionUpdates.get(String(message.id));
              if (durationUpdates.has(String(message.id)))
                message.mediaDuration = durationUpdates.get(String(message.id));
            });
            d.messages = [...messages.values()];
            d.deletedMessages = deleted;
            d.hiddenChats = hiddenChats;
            d.blockedUsers = blockedUsers;
            d.blockedByUsers = blockedByUsers;
            d.follows = follows;
            d.notifs = notifs;
            Object.entries(interactions).forEach(([key, updates]) => {
              const byId = new Map(
                updates.map((item) => [String(item.id), item]),
              );
              d[key] = d[key].map((item) => {
                const update = byId.get(String(item.id));
                return update
                  ? { ...item, likes: update.likes, comments: update.comments }
                  : item;
              });
            });
          },
          { skipRemoteSync: true },
        );
      } catch {
        /* ignore */
      }
    },
    deleteChat: async (peerId) => {
      const target = dbRef.current.users.find((user) => user.id === peerId);
      if (!target) return false;
      try {
        const token = await ensureCsrfToken();
        const response = await fetch(
          `/plat/chats/${encodeURIComponent(target.username)}/`,
          {
            method: "DELETE",
            credentials: "same-origin",
            headers: { "X-CSRFToken": token },
          },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Chatni o‘chirib bo‘lmadi");
        save((d) => {
          const hiddenMessageIds = new Set(
            (result.hiddenMessageIds || []).map(String),
          );
          d.hiddenChats = [
            ...d.hiddenChats.filter(
              (chat) => !(chat.owner === meId && chat.peer === peerId),
            ),
            {
              owner: meId,
              peer: peerId,
              cutoff: result.cutoff,
              messageIds: [...hiddenMessageIds],
            },
          ];
          d.messages = d.messages.filter((message) => {
            const matchesChat =
              (message.from === meId && message.to === peerId) ||
              (message.from === peerId && message.to === meId);
            return (
              !matchesChat ||
              (!hiddenMessageIds.has(String(message.id)) &&
                message.t > result.cutoff)
            );
          });
        });
        say("Chat o‘chirildi");
        return true;
      } catch (error) {
        say(error.message || "Chatni o‘chirib bo‘lmadi");
        return false;
      }
    },
    setUserBlocked: async (peerId, shouldBlock) => {
      const target = dbRef.current.users.find((user) => user.id === peerId);
      if (!target) return false;
      try {
        const token = await ensureCsrfToken();
        const response = await fetch(
          `/plat/users/${encodeURIComponent(target.username)}/block/`,
          {
            method: shouldBlock ? "POST" : "DELETE",
            credentials: "same-origin",
            headers: { "X-CSRFToken": token },
          },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Blok sozlamasini saqlab bo‘lmadi");
        save((d) => {
          if (shouldBlock) {
            d.follows = d.follows.filter(
              (follow) =>
                !(
                  (follow.a === meId && follow.b === peerId) ||
                  (follow.a === peerId && follow.b === meId)
                ),
            );
          }
          d.blockedUsers = shouldBlock
            ? [...new Set([...d.blockedUsers, peerId])]
            : d.blockedUsers.filter((id) => id !== peerId);
        });
        say(
          shouldBlock
            ? `${target.username} bloklandi`
            : `${target.username} blokdan chiqarildi`,
        );
        return true;
      } catch (error) {
        say(error.message || "Blok sozlamasini saqlab bo‘lmadi");
        return false;
      }
    },
    reportReel: async (id, reason, details) => {
      try {
        const token = await ensureCsrfToken();
        const response = await fetch(
          `/plat/reels/${encodeURIComponent(id)}/report/`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "X-CSRFToken": token,
            },
            body: JSON.stringify({ reason, details }),
          },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Shikoyat yuborilmadi");
        say("Shikoyat adminga yuborildi");
        return true;
      } catch (error) {
        say(error.message || "Shikoyat yuborilmadi");
        return false;
      }
    },
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleCallMute,
    toggleCallCamera,
    readMsgs: (from) => {
      const unread = dbRef.current.messages.some(
        (message) =>
          message.from === from && message.to === meId && !message.read,
      );
      if (
        !unread ||
        !save(
          (d) => {
            d.messages.forEach((message) => {
              if (message.from === from && message.to === meId)
                message.read = true;
            });
          },
          { skipRemoteSync: true },
        )
      )
        return;
      const sender = dbRef.current.users.find((user) => user.id === from);
      if (sender)
        sendFastAction({ action: "read", from: sender.username }).catch(() =>
          save(() => {}),
        );
      else save(() => {});
    },
    readNotifs: () => {
      if (
        dbRef.current.notifs.some((n) => n.to === meId && !n.read) &&
        save(
          (d) => {
            d.notifs.forEach((n) => {
              if (n.to === meId) n.read = true;
            });
          },
          { skipRemoteSync: true },
        )
      )
        sendFastAction({ action: "read-notifs" }).catch((error) => {
          save(() => {});
          say(error.message || "Bildirishnomalarni saqlab bo‘lmadi");
        });
    },
    deleteAccount: async () => {
      try {
        const response = await fetch("/plat/delete-account/", {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "X-CSRFToken": csrfToken() },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          say(result.error || "Akkauntni o‘chirib bo‘lmadi");
          return false;
        }
        ls.remove(KEY);
        void clearOverflowDatabase().catch(() => {});
        overflowStorageRef.current = false;
        clearMeId();
        setMeId(null);
        setSocialReadyUser(null);
        dbRef.current = load();
        setDb(dbRef.current);
        navigate("/");
        return true;
      } catch {
        say("Server bilan bog‘lanib bo‘lmadi");
        return false;
      }
    },
    deleteUser: async (userId) => {
      const target = dbRef.current.users.find((user) => user.id === userId);
      if (!target) return false;
      try {
        const response = await fetch(
          `/plat/users/${encodeURIComponent(target.username)}/delete/`,
          {
            method: "DELETE",
            credentials: "same-origin",
            headers: { "X-CSRFToken": csrfToken() },
          },
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          say(result.error || "Foydalanuvchini o‘chirib bo‘lmadi");
          return false;
        }
        save((d) => {
          d.users = d.users.filter((user) => user.id !== userId);
          d.posts = d.posts.filter((item) => item.userId !== userId);
          d.reels = d.reels.filter((item) => item.userId !== userId);
          d.stories = d.stories.filter((item) => item.userId !== userId);
          d.follows = d.follows.filter(
            (item) => item.a !== userId && item.b !== userId,
          );
          d.messages = d.messages.filter(
            (item) => item.from !== userId && item.to !== userId,
          );
          d.notifs = d.notifs.filter(
            (item) => item.from !== userId && item.to !== userId,
          );
        });
        say(`${target.username} o‘chirildi ✓`);
        return true;
      } catch {
        say("Server bilan bog‘lanib bo‘lmadi");
        return false;
      }
    },
    edit: (f) => {
      if (f.username.length < 3) return "Username kamida 3 ta belgi";
      if (db.users.some((u) => u.username === f.username && u.id !== meId))
        return "Bu username band";
      save((d) => {
        Object.assign(
          d.users.find((u) => u.id === meId),
          { name: f.name, username: f.username, bio: f.bio, avatar: f.avatar },
        );
      });
      say("Profil saqlandi ✓");
    },
  };
  useEffect(() => {
    if (!me || socialReadyUser !== meId) return;
    // Oldingi so'rov tugamaguncha yangisini yubormaydi, yashirin tabda so'ramaydi (server band bo'lib qolmasligi uchun)
    let active = true;
    let timer;
    let busy = false;
    const tick = async () => {
      clearTimeout(timer);
      if (!document.hidden && !busy) {
        busy = true;
        try {
          await A.refreshSocialUpdates();
        } catch {
          /* ignore */
        } finally {
          busy = false;
        }
      }
      if (active) timer = setTimeout(tick, 1000);
    };
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    timer = setTimeout(tick, 1000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [meId, socialReadyUser]);
  useEffect(() => {
    if (!meId || socialReadyUser !== meId) return;
    let active = true;
    let timer;
    let delay = 2000;
    const pollCallSignals = async () => {
      try {
        if (!document.hidden) {
          const response = await fetch("/plat/calls/signals/", {
            credentials: "same-origin",
          });
          if (response.ok) {
            const signals = await response.json();
            for (const signal of signals)
              await callSignalHandlerRef.current?.(signal);
            delay = callRef.current ? 700 : 2000;
          } else {
            if (response.status === 403) {
              const result = await response.json().catch(() => ({}));
              if (isAuthenticationFailure(response, result)) {
                clearMeId();
                setMeId(null);
                setSocialReadyUser(null);
                return;
              }
            }
            delay = Math.min(delay * 2, 15000); // server band/xato — sekinlashamiz
          }
        }
      } catch {
        delay = Math.min(delay * 2, 15000); // tarmoq uzilgan — server qayta ishga tushguncha kutamiz
      }
      if (active) timer = setTimeout(pollCallSignals, delay);
    };
    pollCallSignals();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [meId, socialReadyUser]);
  useEffect(() => {
    if (!meId) {
      setPresenceByUser({});
      return;
    }
    if (socialReadyUser !== meId) return;
    let active = true;
    let timer;
    const refreshPresence = async () => {
      try {
        if (!document.hidden) {
          const response = await fetch("/plat/presence/", {
            credentials: "same-origin",
          });
          if (response.ok) {
            const data = await response.json();
            const presence = Object.fromEntries(
              data.users.map((item) => {
                const id =
                  dbRef.current.users.find(
                    (user) => user.username === item.username,
                  )?.id || item.username;
                return [id, { online: item.online, lastSeen: item.lastSeen }];
              }),
            );
            if (active)
              setPresenceByUser((current) =>
                JSON.stringify(current) === JSON.stringify(presence)
                  ? current
                  : presence,
              );
          } else if (response.status === 403) {
            const result = await response.json().catch(() => ({}));
            if (isAuthenticationFailure(response, result)) {
              clearMeId();
              setMeId(null);
              setSocialReadyUser(null);
            }
          }
        }
      } catch {
        /* ignore */
      }
      if (active) timer = setTimeout(refreshPresence, 15000);
    };
    refreshPresence();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [meId, socialReadyUser]);
  const followedIds = new Set(
    db.follows.filter((follow) => follow.a === me?.id).map((follow) => follow.b),
  );
  const feed = db.posts
    .filter((post) => post.userId === me?.id || followedIds.has(post.userId))
    .sort((a, b) => b.t - a.t);
  const suggestionPool = db.users.filter(
    (user) => user.id !== me?.id && !followedIds.has(user.id),
  );
  const suggestionOffset = suggestionPool.length
    ? suggestionSeed % suggestionPool.length
    : 0;
  const suggestions = [
    ...suggestionPool.slice(suggestionOffset),
    ...suggestionPool.slice(0, suggestionOffset),
  ].slice(0, 6);

  const open = {
    profile: (id) => {
      setPostId(null);
      setReelId(null);
      navigate(`/profile/${id}`);
    },
    post: setPostId,
    reel: (id) => {
      setReelId(id);
      navigate("/reels");
    },
    story: (id) => setStoryId(id),
    create: () => setCreate(true),
    createStory: () => setCreateStory(true),
  };

  return (
    <Ctx.Provider
      value={{
        db,
        me,
        byId,
        A,
        open,
        feed,
        suggestions,
        dark,
        reelId,
        serviceOpen,
        accessInfo,
        toast,
        unreadN,
        unreadM,
        peer,
        setPeer,
        callSession,
        callLocalStream,
        callRemoteStream,
        presenceByUser,
        createPost,
        setCreatePost,
        postId,
        setPostId,
        create,
        setCreate,
        createReel,
        setCreateReel,
        createStory,
        setCreateStory,
        storyId,
        setStoryId,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export {
  Ctx,
  useC,
  load,
  uid,
  csrfToken,
  ensureCsrfToken,
  serializeSocialState,
  ago,
  hm,
  seg,
  readMedia,
  readImg,
  kidsUnsafeText,
  kidsUnsafeFile,
  kidsUnsafeDataUrl,
  isKidsHours,
  kidsHoursMessage,
  EMO,
};
