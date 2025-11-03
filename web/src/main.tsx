import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import ErrorBoundary from "./components/ErrorBoundary";

if (typeof window !== "undefined" && !(window as any).__saErrorListeners__) {
  window.addEventListener("error", (event) => {
    console.error("[window.error]", event.error || event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[unhandledrejection]", event.reason);
  });
  (window as any).__saErrorListeners__ = true;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
