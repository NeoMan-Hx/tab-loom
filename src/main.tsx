import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./styles.css";

const rootElement = document.getElementById("root");

function showFatalError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const target = document.getElementById("root") ?? document.body;
  target.innerHTML = `<div class="fatal-screen"><h1>Tab Loom 加载失败</h1><p>${escapeHtml(message)}</p></div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

window.addEventListener("error", (event) => {
  if (event instanceof ErrorEvent) {
    showFatalError(event.error ?? event.message);
  }
});
window.addEventListener("unhandledrejection", (event) => showFatalError(event.reason));

try {
  if (!rootElement) {
    throw new Error("找不到页面根节点 #root。");
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  showFatalError(error);
}
