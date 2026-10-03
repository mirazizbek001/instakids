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
import { Grid } from "../components/Shared";

function Explore() {
  const { db, me } = useC();
  const ps = db.posts
    .filter((p) => p.userId !== me.id)
    .sort((a, b) => b.t - a.t);
  return (
    <div className="mx-auto max-w-[935px] px-1 py-6 sm:px-5">
      {ps.length ? (
        <Grid posts={ps} />
      ) : (
        <p className="py-24 text-center text-neutral-500">
          Boshqa foydalanuvchilar hali post joylamagan.
        </p>
      )}
    </div>
  );
}

export default Explore;
