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

test('buildTranslationPrompt supports custom system prompt with {source} and {target} variables', () => {
  const prompt = buildTranslationPrompt({
    sourceLang: 'English',
    targetLang: 'Japanese',
    text: 'Hello world',
    systemPrompt: 'Translate casually from {source} into {target}. No explanations.'
  });

  assert.ok(prompt.includes('Translate casually from English into Japanese. No explanations.'));
  assert.ok(prompt.includes('Hello world'));
  assert.ok(!prompt.includes('{source}'));
  assert.ok(!prompt.includes('{target}'));
});
