/**
 * Theme utility for managing light/dark mode with Shadcn variables
 */

export type Theme = 'light' | 'dark' | 'system';

export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme = 'dark'; // Default to dark for Chrome DevTools compatibility

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
    // For Chrome extensions, default to dark theme
    // Chrome DevTools are typically dark
    this.setTheme('dark');
  }

  public setTheme(theme: Theme) {
    this.currentTheme = theme;
    const root = document.documentElement;

    // Remove existing theme classes
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      // Detect system preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(isDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
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
        root.classList.add(e.matches ? 'dark' : 'light');
      }
    });
  }
}

// Export singleton instance
export const themeManager = ThemeManager.getInstance();