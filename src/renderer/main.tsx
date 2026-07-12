import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "../App";
import "../index.css";
const root = document.getElementById("root");
if (!root) {
    throw new Error("Missing #root element");
}
if (!window.voidscribe) {
    root.innerHTML =
        '<div style="padding:24px;font-family:system-ui;color:#e6e9f0;background:#030408;min-height:100vh">' +
            "<h2>VoidScribe Code</h2>" +
            "<p>Preload не загрузился — перезапусти <code>npm run dev</code>.</p>" +
            "</div>";
}
else {
    ReactDOM.createRoot(root).render(<React.StrictMode>
      <App />
    </React.StrictMode>);
}
