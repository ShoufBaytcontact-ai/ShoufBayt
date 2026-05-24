import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./theme.scss";

import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeContextProvider } from "./context/ThemeContext.jsx";
import { SocketContextProvider } from "./context/SocketContext.jsx";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeContextProvider>
        <SocketContextProvider>
          <App />
        </SocketContextProvider>
      </ThemeContextProvider>
    </AuthProvider>
  </React.StrictMode>
);