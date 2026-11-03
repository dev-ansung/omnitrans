import type { PromptContext } from '../types/index.js';

export function buildTranslationPrompt(context: PromptContext): string {
  const { sourceLang, targetLang, text } = context;
  return `You are an expert translator. Translate the following text from ${sourceLang} to ${targetLang}.
Output only the direct translation. Do not include notes, alternatives, explanations, or quotes.

Source text:
${text.trim()}`;
}
