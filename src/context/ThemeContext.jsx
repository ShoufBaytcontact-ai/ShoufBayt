import { createContext, useEffect, useState } from "react";

export const ThemeContext = createContext();

export const ThemeContextProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      if (!localStorage.getItem("se_light_default")) {
        localStorage.setItem("se_light_default", "1");
        localStorage.setItem("theme", "light");
        localStorage.setItem("darkMode", "false");
        return false;
      }

      const stored = localStorage.getItem("darkMode");
      return stored == null ? false : JSON.parse(stored);
    } catch {
      return false;
    }
  });

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};