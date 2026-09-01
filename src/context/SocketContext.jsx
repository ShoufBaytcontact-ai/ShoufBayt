import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { AuthContext } from "./AuthContext.jsx";
import { SOCKET_URL } from "../lib/apiConfig";

export const SocketContext = createContext({
  socket: null,
  onlineUsers: [],
});

function normalizeId(id) {
  return String(id || "").trim();
}

function getId(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "object") {
    return normalizeId(value.id || value._id || value.userId);
  }

  return normalizeId(value);
}

function getCurrentUserId(currentUser) {
  return (
    getId(currentUser) ||
    getId(currentUser?.user) ||
    getId(currentUser?.data) ||
    getId(currentUser?.userInfo) ||
    getId(currentUser?.profile)
  );
}

export const SocketContextProvider = ({ children }) => {
  const { currentUser } = useContext(AuthContext);

  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const currentUserId = getCurrentUserId(currentUser);

  const socketUrl = useMemo(() => SOCKET_URL, []);

  useEffect(() => {
    const newSocket = io(socketUrl || undefined, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    const handleOnlineUsers = (users) => {
      setOnlineUsers(Array.isArray(users) ? users : []);
    };

    newSocket.on("getOnlineUsers", handleOnlineUsers);

    return () => {
      newSocket.off("getOnlineUsers", handleOnlineUsers);
      newSocket.disconnect();
    };
  }, [socketUrl]);

  useEffect(() => {
    if (!socket || !currentUserId) {
      return;
    }

    socket.emit("addUser", currentUserId);

    const handleConnect = () => {
      socket.emit("addUser", currentUserId);
    };

    socket.on("connect", handleConnect);

    return () => {
      socket.off("connect", handleConnect);
    };
  }, [socket, currentUserId]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};