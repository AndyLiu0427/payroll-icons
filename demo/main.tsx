import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "../src/animate.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing from demo/index.html");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
