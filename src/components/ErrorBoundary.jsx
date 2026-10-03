import { Component } from "react";

/* Kutilmagan render xatosi butun ilovani oq ekranga aylantirmasligi uchun. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("InstaKids xatosi:", error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-white p-6 text-center text-neutral-900 dark:bg-[#0b1224] dark:text-neutral-100">
        <div className="max-w-sm space-y-4">
          <h1 className="text-xl font-bold">Nimadir xato ketdi</h1>
          <p className="text-sm opacity-75">
            Ilovada kutilmagan xatolik yuz berdi. Sahifani qayta yuklab
            ko‘ring — ma’lumotlaringiz saqlanib qoladi.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-sky-600 px-5 py-2.5 font-semibold text-white hover:bg-sky-500"
          >
            Qayta yuklash
          </button>
        </div>
      </div>
    );
  }
}
