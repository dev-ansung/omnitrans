export type SupportedLocale = 'en' | 'zh-TW';
export type AppTheme = 'light' | 'dark';

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  bcp47: string;
}

export interface TranslationRecord {
  id: string;
  timestamp: number;
  sourceLang: string;
  targetLang: string;
  sourceText: string;
  translatedText: string;
  mediaType?: 'text' | 'image' | 'audio';
  mediaData?: string;
}

export interface AppSettings {
  theme: AppTheme;
  locale: SupportedLocale;
  enableThinking: boolean;
  defaultModel: string;
  temperature: number;
  maxOutputTokens: number;
  recentLanguages: string[];
}

export interface PromptContext {
  sourceLang: string;
  targetLang: string;
  text: string;
}
