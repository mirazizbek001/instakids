import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  window.__instakidsInstallPrompt = event;
  window.dispatchEvent(new Event("instakids-installprompt"));
});

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  let activateUpdate = false;
  let refreshing = false;
  let registration;
  let registeredBuildId = import.meta.env.VITE_BUILD_ID;
  const announceUpdate = () =>
    window.dispatchEvent(new Event("instakids-update-ready"));
  const observeRegistration = (value) => {
    if (value.waiting && navigator.serviceWorker.controller) announceUpdate();
    const observeInstalling = (installing) => {
      if (!installing) return;
      const checkInstalled = () => {
        if (
          installing.state === "installed" &&
          navigator.serviceWorker.controller
        )
          announceUpdate();
      };
      installing.addEventListener("statechange", checkInstalled);
      checkInstalled();
    };
    value.addEventListener("updatefound", () =>
      observeInstalling(value.installing),
    );
    observeInstalling(value.installing);
  };
  const registerBuild = (buildId) =>
    navigator.serviceWorker.register(
      `/sw.js?build=${encodeURIComponent(buildId)}`,
      { scope: "/", updateViaCache: "none" },
    );
  const checkForUpdate = async () => {
    try {
      const response = await fetch(`/version.json?check=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const { buildId } = await response.json();
      if (buildId && buildId !== registeredBuildId) {
        registration = await registerBuild(buildId);
        registeredBuildId = buildId;
        observeRegistration(registration);
      } else {
        await registration?.update();
      }
    } catch {
      /* Retry on the next visibility or scheduled check. */
    }
  };
  const reloadWhenVisible = () => {
    if (document.visibilityState === "hidden") {
      const onVisible = () => {
        document.removeEventListener("visibilitychange", onVisible);
        window.location.reload();
      };
      document.addEventListener("visibilitychange", onVisible, { once: true });
      return;
    }
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!activateUpdate || refreshing) return;
    refreshing = true;
    reloadWhenVisible();
  });
  window.addEventListener("instakids-activate-update", () => {
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (!registration?.waiting) return;
      activateUpdate = true;
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    });
  });
  window.addEventListener("load", () => {
    registerBuild(registeredBuildId)
      .then((value) => {
        registration = value;
        observeRegistration(registration);
        void checkForUpdate();
        setInterval(() => void checkForUpdate(), 15 * 60 * 1000);
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) void checkForUpdate();
        });
        window.addEventListener("focus", () => void checkForUpdate());
      })
      .catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
