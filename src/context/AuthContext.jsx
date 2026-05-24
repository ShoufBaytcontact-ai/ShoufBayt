import { createContext, useEffect, useState } from "react";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const storedUser = sessionStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser);
    } catch (error) {
      sessionStorage.removeItem("user");
      localStorage.removeItem("user");
      return null;
    }
  });

  const updateUser = (user) => {
    setCurrentUser(user);

    localStorage.removeItem("user");

    if (user) {
      sessionStorage.setItem("user", JSON.stringify(user));
    } else {
      sessionStorage.removeItem("user");
    }
  };

  useEffect(() => {
    localStorage.removeItem("user");

    if (currentUser) {
      sessionStorage.setItem("user", JSON.stringify(currentUser));
    } else {
      sessionStorage.removeItem("user");
    }
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const AuthContextProvider = AuthProvider;