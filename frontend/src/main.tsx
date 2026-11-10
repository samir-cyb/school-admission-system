import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/anek-bangla/standard.css";
import "@fontsource-variable/noto-sans-bengali/index.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/glass.css";
import { applyTheme } from "./lib/theme";
import { initialLang } from "./i18n/I18nProvider";
import App from "./App";

// Theme and language before the first paint: no flash of the wrong theme.
applyTheme();
document.documentElement.lang = initialLang();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
