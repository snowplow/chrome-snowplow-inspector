/**
 * Theme utility for managing light/dark mode with Shadcn variables
 */

export type Theme = 'light' | 'dark' | 'system';

export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme = 'system'; // Default to system preferences

  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  constructor() {
    this.initializeTheme();
  }

  private initializeTheme() {
    // Always clear any existing theme classes first
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    // Check for stored preference first
    const storedTheme = localStorage.getItem('snowplow-inspector-theme') as Theme;
    if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
      this.setTheme(storedTheme);
    } else {
      // Clear any old stored preference and default to system preference
      localStorage.removeItem('snowplow-inspector-theme');
      this.setTheme('system');
    }
  }

  public setTheme(theme: Theme) {
    this.currentTheme = theme;
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      // Detect system preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const appliedTheme = isDark ? 'dark' : 'light';
      root.classList.add(appliedTheme);
      console.log(`Theme set to system: ${appliedTheme} (system prefers dark: ${isDark})`);
    } else {
      root.classList.add(theme);
      console.log(`Theme set to: ${theme}`);
    }

    // Store preference
    localStorage.setItem('snowplow-inspector-theme', theme);
  }

  public getTheme(): Theme {
    return this.currentTheme;
  }

  public toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  // Listen for system theme changes
  public watchSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (this.currentTheme === 'system') {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        const appliedTheme = e.matches ? 'dark' : 'light';
        root.classList.add(appliedTheme);
        console.log(`System theme changed to: ${appliedTheme}`);
      }
    });
  }

  // Force reset to system theme (useful for debugging)
  public resetToSystem() {
    localStorage.removeItem('snowplow-inspector-theme');
    this.setTheme('system');
  }
}

// Export singleton instance
export const themeManager = ThemeManager.getInstance();