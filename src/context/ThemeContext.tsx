import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "traditional" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isTraditional: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "cides_app_theme_v1";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return (saved === "traditional" || saved === "dark") ? saved : "dark";
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    if (newTheme === "traditional") {
      document.documentElement.classList.add("theme-traditional");
      document.documentElement.classList.remove("theme-dark");
    } else {
      document.documentElement.classList.remove("theme-traditional");
      document.documentElement.classList.add("theme-dark");
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "traditional" : "dark");
  };

  useEffect(() => {
    if (theme === "traditional") {
      document.documentElement.classList.add("theme-traditional");
      document.documentElement.classList.remove("theme-dark");
    } else {
      document.documentElement.classList.remove("theme-traditional");
      document.documentElement.classList.add("theme-dark");
    }
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isTraditional: theme === "traditional",
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
