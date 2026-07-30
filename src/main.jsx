import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./estilo.css";

createRoot(document.getElementById("root")).render(<App />);

// Service worker: deixa o app abrir e funcionar sem internet depois da 1ª visita.
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
