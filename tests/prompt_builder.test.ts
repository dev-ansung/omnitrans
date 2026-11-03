import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTranslationPrompt } from '../src/utils/prompt_builder.ts';

test('buildTranslationPrompt creates strict translation prompt without reasoning instructions', () => {
  const prompt = buildTranslationPrompt({
    sourceLang: 'English',
    targetLang: 'Traditional Chinese',
    text: 'Have a great day!'
  });

  assert.ok(prompt.includes('English'));
  assert.ok(prompt.includes('Traditional Chinese'));
  assert.ok(prompt.includes('Have a great day!'));
  assert.ok(prompt.includes('Output only the direct translation'));
});
