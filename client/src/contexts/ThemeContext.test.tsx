/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getInitialTheme, getThemeToggleLabel, nextTheme, THEME_STORAGE_KEY, ThemeProvider, useTheme } from "./ThemeContext";

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" aria-label={getThemeToggleLabel(theme)} aria-pressed={theme === "dark"} onClick={() => toggleTheme?.()}>
      {theme}
    </button>
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("theme preference helpers", () => {
  it("toggles between light and dark modes", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });

  it("returns accessible labels that describe the next action", () => {
    expect(getThemeToggleLabel("light")).toBe("Switch to dark mode");
    expect(getThemeToggleLabel("dark")).toBe("Switch to light mode");
  });

  it("renders a switchable provider that persists theme state and updates the document", () => {
    render(
      <ThemeProvider defaultTheme="light" switchable>
        <ThemeProbe />
      </ThemeProvider>,
    );

    const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("light");
    expect(document.documentElement).not.toHaveClass("dark");

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Switch to light mode" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button")).toHaveTextContent("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
  });

  it("restores a valid saved preference and ignores invalid values", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    expect(getInitialTheme("light", true)).toBe("dark");
    localStorage.setItem(THEME_STORAGE_KEY, "unexpected");
    expect(getInitialTheme("light", true)).toBe("light");
  });
});
