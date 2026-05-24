import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { AuthContext } from "./AuthContext.jsx";

export const SocketContext = createContext();

export const SocketContextProvider = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const newSocket = io("http://localhost:4000");

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUser]);

  useEffect(() => {
    if (socket && currentUser) {
      socket.emit("addUser", currentUser.id);
    }
  }, [socket, currentUser]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};