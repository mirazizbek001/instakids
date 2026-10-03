import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useC } from "../context/AppContext";
import { Av } from "./Shared";

const formatDuration = (seconds) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

export default function CallOverlay() {
  const { callSession, callLocalStream, callRemoteStream, db, A } = useC();
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const remoteAudio = useRef(null);
  const [duration, setDuration] = useState(0);
  const user =
    callSession && db.users.find((item) => item.id === callSession.peerId);
  const incoming =
    callSession?.direction === "incoming" && callSession.status === "ringing";
  const videoCall = callSession?.mode === "video";

  useEffect(() => {
    if (localVideo.current)
      localVideo.current.srcObject = callLocalStream || null;
  }, [callLocalStream]);

  useEffect(() => {
    if (remoteVideo.current)
      remoteVideo.current.srcObject = callRemoteStream || null;
    if (remoteAudio.current)
      remoteAudio.current.srcObject = callRemoteStream || null;
  }, [callRemoteStream, videoCall]);

  useEffect(() => {
    if (callSession?.status !== "connected") {
      setDuration(0);
      return;
    }
    const update = () =>
      setDuration(Math.floor((Date.now() - callSession.connectedAt) / 1000));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [callSession?.status, callSession?.connectedAt]);

  if (!callSession) return null;
  const statusText = incoming
    ? `${videoCall ? "Video" : "Audio"} qo‘ng‘iroq qilmoqda...`
    : callSession.status === "connected"
      ? formatDuration(duration)
      : callSession.status === "failed"
        ? "Aloqa uzildi"
        : callSession.status === "reconnecting"
          ? "Qayta ulanmoqda..."
          : "Chaqirilmoqda...";

  return (
    <div className="fixed inset-0 z-[125] bg-[#050812] text-white sm:grid sm:place-items-center sm:bg-[#050812]/90 sm:p-6 sm:backdrop-blur-md">
      <section className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#101a30] sm:h-[min(88dvh,760px)] sm:max-w-[920px] sm:rounded-2xl sm:border sm:border-[#38517b] sm:shadow-[0_28px_100px_rgba(0,0,0,.65)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(38,55,86,.8),transparent_58%)]" />
        {videoCall && callRemoteStream && (
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className="absolute inset-0 h-full w-full bg-black object-cover sm:object-contain"
          />
        )}
        {!videoCall && <audio ref={remoteAudio} autoPlay />}
        {videoCall && callLocalStream && (
          <video
            ref={localVideo}
            autoPlay
            muted
            playsInline
            className="absolute right-3 top-[calc(env(safe-area-inset-top)+5.5rem)] z-10 aspect-video w-[30vw] max-w-[160px] rounded-xl border border-white/20 bg-black object-cover shadow-xl sm:right-6 sm:top-6 sm:w-[min(28vw,190px)]"
          />
        )}
        <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 bg-gradient-to-b from-black/75 to-transparent px-5 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-7">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              {user?.name || user?.username || "Foydalanuvchi"}
            </h2>
            <p className="mt-1 text-sm text-white/70">
              {incoming
                ? statusText
                : callSession.status === "connected"
                  ? "Ulandi"
                  : statusText}
            </p>
          </div>
          <p className="shrink-0 rounded-full bg-black/35 px-3 py-1.5 text-sm font-semibold tabular-nums backdrop-blur">
            {callSession.status === "connected"
              ? formatDuration(duration)
              : videoCall
                ? "Video"
                : "Audio"}
          </p>
        </header>
        {!videoCall && (
          <div className="relative z-[1] grid flex-1 place-items-center px-5 text-center">
            <Av u={user} s={104} />
          </div>
        )}
        {videoCall && callSession.cameraOff && (
          <p className="absolute left-5 top-[calc(env(safe-area-inset-top)+5.5rem)] z-10 text-xs text-white/70">
            Kamera o‘chiq
          </p>
        )}
        <div className="absolute inset-x-0 bottom-0 z-[2] flex items-center justify-center gap-4 bg-gradient-to-t from-black/85 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-12 sm:gap-6 sm:pb-6">
          {incoming ? (
            <>
              <button
                type="button"
                onClick={A.rejectCall}
                aria-label="Qo‘ng‘iroqni rad etish"
                title="Rad etish"
                className="grid h-14 w-14 place-items-center rounded-full bg-red-600 transition hover:bg-red-500"
              >
                <PhoneOff size={23} />
              </button>
              <button
                type="button"
                onClick={A.acceptCall}
                aria-label="Qo‘ng‘iroqqa javob berish"
                title="Javob berish"
                className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500 transition hover:bg-emerald-400"
              >
                <Phone size={23} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={A.toggleCallMute}
                aria-label={
                  callSession.muted
                    ? "Mikrofonni yoqish"
                    : "Mikrofonni o‘chirish"
                }
                title={
                  callSession.muted
                    ? "Mikrofonni yoqish"
                    : "Mikrofonni o‘chirish"
                }
                className={`grid h-12 w-12 place-items-center rounded-full transition ${callSession.muted ? "bg-white text-[#101a30]" : "bg-white/10 hover:bg-white/20"}`}
              >
                {callSession.muted ? <MicOff size={21} /> : <Mic size={21} />}
              </button>
              {videoCall && (
                <button
                  type="button"
                  onClick={A.toggleCallCamera}
                  aria-label={
                    callSession.cameraOff
                      ? "Kamerani yoqish"
                      : "Kamerani o‘chirish"
                  }
                  title={
                    callSession.cameraOff
                      ? "Kamerani yoqish"
                      : "Kamerani o‘chirish"
                  }
                  className={`grid h-12 w-12 place-items-center rounded-full transition ${callSession.cameraOff ? "bg-white text-[#101a30]" : "bg-white/10 hover:bg-white/20"}`}
                >
                  {callSession.cameraOff ? (
                    <VideoOff size={21} />
                  ) : (
                    <Video size={21} />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={A.endCall}
                aria-label="Qo‘ng‘iroqni tugatish"
                title="Tugatish"
                className="grid h-14 w-14 place-items-center rounded-full bg-red-600 transition hover:bg-red-500"
              >
                <PhoneOff size={23} />
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
