import { useState } from "react";
import { Search, X } from "lucide-react";
import { useC } from "../context/AppContext";
import { Av, FollowBtn } from "../components/Shared";

function SearchPage() {
  const { db, me, open, A } = useC();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const results = query
    ? db.users.filter(
        (u) =>
          u.id !== me.id &&
          (u.username + " " + u.name).toLowerCase().includes(query),
      )
    : [];
  const recent = db.searchHistory
    .map((id) => db.users.find((user) => user.id === id))
    .filter(Boolean)
    .reverse();
  const openUser = (user) => {
    A.addSearch(user.id);
    open.profile(user.id);
  };
  return (
    <div className="mx-auto max-w-[600px] px-4 py-8">
      <h1 className="mb-5 text-2xl font-bold">Qidiruv</h1>
      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-3.5 text-neutral-400"
        />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Foydalanuvchi qidirish"
          className="w-full rounded-xl bg-neutral-100 py-3 pl-11 pr-4 outline-none dark:bg-[#17223b]"
        />
      </div>
      <div className="mt-5">
        {query ? (
          <>
            {results.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl p-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <button
                  onClick={() => openUser(u)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <Av u={u} s={48} />
                  <div>
                    <b className="block text-sm">{u.username}</b>
                    <span className="text-sm text-neutral-500">{u.name}</span>
                  </div>
                </button>
                <FollowBtn id={u.id} />
              </div>
            ))}
            {!results.length && (
              <p className="py-10 text-center text-neutral-500">
                Hech kim topilmadi.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Oxirgi qidiruvlar</h2>
              {recent.length > 0 && (
                <button
                  onClick={A.clearSearchHistory}
                  className="text-sm font-semibold text-black dark:text-white"
                >
                  Hammasini tozalash
                </button>
              )}
            </div>
            {recent.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-xl p-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                <button
                  onClick={() => openUser(user)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Av u={user} s={44} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{user.username}</b>
                    <span className="block truncate text-sm text-neutral-500">
                      {user.name}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => A.removeSearch(user.id)}
                  aria-label={`${user.username} qidiruv tarixidan o‘chirish`}
                  className="rounded-full p-2 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
            {!recent.length && (
              <p className="py-10 text-center text-sm text-neutral-500">
                Qidiruv tarixi hozircha bo‘sh.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
