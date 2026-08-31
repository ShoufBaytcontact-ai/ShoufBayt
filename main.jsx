import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthContextProvider } from "./context/AuthContext.jsx";
import { ThemeContextProvider } from "./context/ThemeContext.jsx";
import { SocketContextProvider } from "./context/SocketContext.jsx";
import "./theme.scss";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <AuthContextProvider>
    <ThemeContextProvider>
      <SocketContextProvider>
        <App />
      </SocketContextProvider>
    </ThemeContextProvider>
  </AuthContextProvider>
);