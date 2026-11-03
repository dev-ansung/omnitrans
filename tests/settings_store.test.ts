import test from 'node:test';
import assert from 'node:assert/strict';
import { SettingsStore } from '../src/stores/settings_store.ts';

class MemoryStorage {
  private data: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.data[key] ?? null;
  }
  setItem(key: string, value: string): void {
    this.data[key] = value;
  }
  removeItem(key: string): void {
    delete this.data[key];
  }
}

test('SettingsStore initializes with default settings: thinking is disabled by default', () => {
  const storage = new MemoryStorage();
  const store = new SettingsStore(storage as unknown as Storage);
  const settings = store.getSettings();

  assert.equal(settings.enableThinking, false);
  assert.equal(settings.theme, 'light');
  assert.equal(settings.locale, 'en');
  assert.equal(settings.defaultModel, 'e2b');
});

test('SettingsStore manages recent languages by promoting to front and allowing removal', () => {
  const storage = new MemoryStorage();
  const store = new SettingsStore(storage as unknown as Storage);

  store.addRecentLanguage('ja');
  let recents = store.getSettings().recentLanguages;
  assert.equal(recents[0], 'ja');

  store.addRecentLanguage('es');
  recents = store.getSettings().recentLanguages;
  assert.equal(recents[0], 'es');
  assert.equal(recents[1], 'ja');

  store.removeRecentLanguage('ja');
  recents = store.getSettings().recentLanguages;
  assert.ok(!recents.includes('ja'));
  assert.equal(recents[0], 'es');
});
