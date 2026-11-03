import type { PromptContext } from '../types/index.js';

export function buildTranslationPrompt(context: PromptContext): string {
  const { sourceLang, targetLang, text, systemPrompt } = context;
  const baseInstruction = systemPrompt && systemPrompt.trim()
    ? systemPrompt.replace('{source}', sourceLang).replace('{target}', targetLang)
    : `You are an expert translator. Translate the following text from ${sourceLang} to ${targetLang}. Output only the direct translation. Do not include notes, alternatives, explanations, or quotes.`;

  return `${baseInstruction}

Source text:
${text.trim()}`;
}
