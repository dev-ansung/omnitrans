import type { LanguageOption } from '../types/index.js';

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', bcp47: 'en-US' },
  { code: 'zh-TW', name: 'Traditional Chinese', nativeName: '繁體中文', bcp47: 'zh-TW' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', bcp47: 'ja-JP' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', bcp47: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', bcp47: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', bcp47: 'de-DE' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', bcp47: 'ko-KR' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', bcp47: 'vi-VN' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', bcp47: 'th-TH' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', bcp47: 'it-IT' }
];

export function getLanguageByCode(code: string): LanguageOption {
  return LANGUAGES.find((lang) => lang.code === code) ?? LANGUAGES[0]!;
}
