import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./i18n";
import "./theme.scss";
import "./style.scss";

import { AuthContextProvider } from "./context/AuthContext.jsx";
import { ThemeContextProvider } from "./context/ThemeContext.jsx";
import { SocketContextProvider } from "./context/SocketContext.jsx";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <AuthContextProvider>
      <ThemeContextProvider>
        <SocketContextProvider>
          <App />
        </SocketContextProvider>
      </ThemeContextProvider>
    </AuthContextProvider>
  </React.StrictMode>
);