import type { AppSettings, AppTheme, SupportedLocale } from '../types/index.js';

const STORAGE_KEY = 'omnitrans-settings';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  locale: 'en',
  enableThinking: false,
  defaultModel: 'e2b',
  temperature: 0.7,
  maxOutputTokens: 1024,
  recentLanguages: ['en', 'zh-TW', 'ja', 'es']
};

export class SettingsStore {
  private storage: Storage;
  private settings: AppSettings;

  constructor(storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage)) {
    this.storage = storage;
    this.settings = this.load();
  }

  private load(): AppSettings {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        recentLanguages: Array.isArray(parsed.recentLanguages)
          ? parsed.recentLanguages
          : DEFAULT_SETTINGS.recentLanguages
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private persist(): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage write errors
    }
  }

  getSettings(): AppSettings {
    return { ...this.settings };
  }

  updateSettings(partial: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.persist();
  }

  setTheme(theme: AppTheme): void {
    this.updateSettings({ theme });
  }

  setLocale(locale: SupportedLocale): void {
    this.updateSettings({ locale });
  }

  setEnableThinking(enableThinking: boolean): void {
    this.updateSettings({ enableThinking });
  }

  addRecentLanguage(code: string): void {
    const list = this.settings.recentLanguages.filter((item) => item !== code);
    list.unshift(code);
    if (list.length > 5) list.length = 5;
    this.updateSettings({ recentLanguages: list });
  }

  removeRecentLanguage(code: string): void {
    const list = this.settings.recentLanguages.filter((item) => item !== code);
    this.updateSettings({ recentLanguages: list });
  }
}
