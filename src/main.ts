import { createIcons, icons } from 'lucide';
import { LANGUAGES, getLanguageByCode } from './constants/languages.js';
import { getDictionary } from './i18n/index.js';
import { HistoryStore } from './stores/history_store.js';
import { ModelStore } from './stores/model_store.js';
import { SettingsStore } from './stores/settings_store.js';
import { TtsService } from './services/tts_service.js';
import { buildTranslationPrompt } from './utils/prompt_builder.js';
import type { TranslationRecord } from './types/index.js';

const settingsStore = new SettingsStore();
const historyStore = new HistoryStore();
const modelStore = new ModelStore();
const ttsService = new TtsService();

let activeAttachment: { type: 'image' | 'audio'; dataUrl: string; name: string } | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let isRecording = false;

// DOM Elements
const viewTranslate = document.getElementById('viewTranslate')!;
const viewHistory = document.getElementById('viewHistory')!;
const viewSettings = document.getElementById('viewSettings')!;
const navTabTranslate = document.getElementById('navTabTranslate')!;
const navTabHistory = document.getElementById('navTabHistory')!;
const navTabSettings = document.getElementById('navTabSettings')!;

const selectSourceLang = document.getElementById('selectSourceLang') as HTMLSelectElement;
const selectTargetLang = document.getElementById('selectTargetLang') as HTMLSelectElement;
const btnSwapLanguages = document.getElementById('btnSwapLanguages')!;
const recentLanguagePills = document.getElementById('recentLanguagePills')!;

const inputSourceText = document.getElementById('inputSourceText') as HTMLTextAreaElement;
const cameraFileInput = document.getElementById('cameraFileInput') as HTMLInputElement;
const btnMicRecord = document.getElementById('btnMicRecord')!;
const btnPlaySourceTts = document.getElementById('btnPlaySourceTts')!;
const btnTranslate = document.getElementById('btnTranslate')!;
const mediaAttachmentPreview = document.getElementById('mediaAttachmentPreview')!;
const mediaAttachmentContent = document.getElementById('mediaAttachmentContent')!;
const btnRemoveAttachment = document.getElementById('btnRemoveAttachment')!;

const outputTranslatedText = document.getElementById('outputTranslatedText')!;
const btnPlayTargetTts = document.getElementById('btnPlayTargetTts')!;
const btnCopyTranslation = document.getElementById('btnCopyTranslation')!;

const inputHistorySearch = document.getElementById('inputHistorySearch') as HTMLInputElement;
const historyListContainer = document.getElementById('historyListContainer')!;
const btnClearHistory = document.getElementById('btnClearHistory')!;

const badgeE2B = document.getElementById('badgeE2B')!;
const labelE2BStatus = document.getElementById('labelE2BStatus')!;
const btnDownloadE2B = document.getElementById('btnDownloadE2B')!;
const btnDeleteE2B = document.getElementById('btnDeleteE2B')!;
const e2bProgressBarContainer = document.getElementById('e2bProgressBarContainer')!;
const e2bProgressBar = document.getElementById('e2bProgressBar')!;
const e2bProgressText = document.getElementById('e2bProgressText')!;
const e2bSpeedText = document.getElementById('e2bSpeedText')!;

const toggleThinking = document.getElementById('toggleThinking') as HTMLInputElement;
const toggleTheme = document.getElementById('toggleTheme') as HTMLInputElement;
const selectUiLanguage = document.getElementById('selectUiLanguage') as HTMLSelectElement;
const labelStoragePersistence = document.getElementById('labelStoragePersistence')!;
const btnRequestPersist = document.getElementById('btnRequestPersist')!;
const textTtsReady = document.getElementById('textTtsReady')!;

function refreshIcons(): void {
  createIcons({ icons });
}

function applyTheme(): void {
  const { theme } = settingsStore.getSettings();
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  toggleTheme.checked = theme === 'dark';
}

function applyI18n(): void {
  const { locale } = settingsStore.getSettings();
  const dict = getDictionary(locale);

  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n') as keyof typeof dict;
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder') as keyof typeof dict;
    if (dict[key]) {
      el.placeholder = dict[key];
    }
  });

  selectUiLanguage.value = locale;
}

function populateLanguageSelectors(): void {
  selectSourceLang.innerHTML = '';
  selectTargetLang.innerHTML = '';

  LANGUAGES.forEach((lang) => {
    const opt1 = new Option(lang.nativeName, lang.code);
    const opt2 = new Option(lang.nativeName, lang.code);
    selectSourceLang.appendChild(opt1);
    selectTargetLang.appendChild(opt2);
  });

  selectSourceLang.value = 'en';
  selectTargetLang.value = 'zh-TW';
}

function renderRecentPills(): void {
  const { recentLanguages } = settingsStore.getSettings();
  recentLanguagePills.innerHTML = '';

  recentLanguages.forEach((code) => {
    const lang = getLanguageByCode(code);
    const pill = document.createElement('div');
    pill.className =
      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer shrink-0';

    const textSpan = document.createElement('span');
    textSpan.textContent = lang.nativeName;
    textSpan.addEventListener('click', () => {
      selectTargetLang.value = code;
      settingsStore.addRecentLanguage(code);
      renderRecentPills();
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'hover:text-red-500 transition text-[11px] font-bold px-0.5';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      settingsStore.removeRecentLanguage(code);
      renderRecentPills();
    });

    pill.appendChild(textSpan);
    pill.appendChild(removeBtn);
    recentLanguagePills.appendChild(pill);
  });
}

function switchTab(tab: 'translate' | 'history' | 'settings'): void {
  viewTranslate.classList.toggle('hidden', tab !== 'translate');
  viewHistory.classList.toggle('hidden', tab !== 'history');
  viewSettings.classList.toggle('hidden', tab !== 'settings');

  const tabs = [
    { btn: navTabTranslate, id: 'translate' },
    { btn: navTabHistory, id: 'history' },
    { btn: navTabSettings, id: 'settings' }
  ];

  tabs.forEach(({ btn, id }) => {
    const isActive = id === tab;
    btn.className = isActive
      ? 'flex flex-col items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold text-[11px] transition'
      : 'flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium text-[11px] transition';
  });

  if (tab === 'history') {
    renderHistory();
  } else if (tab === 'settings') {
    updateSettingsView();
  }
  refreshIcons();
}

btnSwapLanguages.addEventListener('click', () => {
  const currentSource = selectSourceLang.value;
  selectSourceLang.value = selectTargetLang.value;
  selectTargetLang.value = currentSource;
  settingsStore.addRecentLanguage(selectTargetLang.value);
  renderRecentPills();
});

selectSourceLang.addEventListener('change', () => {
  settingsStore.addRecentLanguage(selectSourceLang.value);
  renderRecentPills();
});

selectTargetLang.addEventListener('change', () => {
  settingsStore.addRecentLanguage(selectTargetLang.value);
  renderRecentPills();
});

// Camera / File Input
cameraFileInput.addEventListener('change', () => {
  const file = cameraFileInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    activeAttachment = {
      type: 'image',
      dataUrl: reader.result as string,
      name: file.name
    };
    mediaAttachmentContent.innerHTML = `
      <img src="${reader.result}" class="w-8 h-8 rounded-lg object-cover border border-slate-300 dark:border-slate-700">
      <span class="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[180px]">${file.name}</span>
    `;
    mediaAttachmentPreview.classList.remove('hidden');
    refreshIcons();
  };
  reader.readAsDataURL(file);
});

btnRemoveAttachment.addEventListener('click', () => {
  activeAttachment = null;
  cameraFileInput.value = '';
  mediaAttachmentPreview.classList.add('hidden');
  mediaAttachmentContent.innerHTML = '';
});

// Microphone Voice Recording
btnMicRecord.addEventListener('click', async () => {
  if (isRecording) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording = false;
    btnMicRecord.classList.remove('text-red-600', 'bg-red-50', 'animate-pulse');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);
      activeAttachment = {
        type: 'audio',
        dataUrl: audioUrl,
        name: 'Voice recording'
      };
      mediaAttachmentContent.innerHTML = `
        <i data-lucide="mic" class="w-4 h-4 text-red-500"></i>
        <audio src="${audioUrl}" controls class="h-7 max-w-[200px]"></audio>
      `;
      mediaAttachmentPreview.classList.remove('hidden');
      refreshIcons();
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start();
    isRecording = true;
    btnMicRecord.classList.add('text-red-600', 'bg-red-50', 'animate-pulse');
  } catch (err) {
    console.error('Microphone access denied:', err);
  }
});

btnPlaySourceTts.addEventListener('click', () => {
  const text = inputSourceText.value.trim();
  const sourceLang = getLanguageByCode(selectSourceLang.value);
  if (text) {
    ttsService.speak(text, sourceLang.bcp47);
  }
});

btnPlayTargetTts.addEventListener('click', () => {
  const text = outputTranslatedText.textContent?.trim();
  const targetLang = getLanguageByCode(selectTargetLang.value);
  if (text) {
    ttsService.speak(text, targetLang.bcp47);
  }
});

btnCopyTranslation.addEventListener('click', async () => {
  const text = outputTranslatedText.textContent?.trim();
  if (text) {
    await navigator.clipboard.writeText(text);
    const { locale } = settingsStore.getSettings();
    const toast = getDictionary(locale).copiedToast;
    const originalText = btnCopyTranslation.querySelector('span')?.textContent;
    if (btnCopyTranslation.querySelector('span')) {
      btnCopyTranslation.querySelector('span')!.textContent = toast;
      setTimeout(() => {
        if (btnCopyTranslation.querySelector('span')) {
          btnCopyTranslation.querySelector('span')!.textContent = originalText || 'Copy';
        }
      }, 1500);
    }
  }
});

async function runTranslation(): Promise<void> {
  const text = inputSourceText.value.trim();
  if (!text && !activeAttachment) return;

  const sourceLang = getLanguageByCode(selectSourceLang.value);
  const targetLang = getLanguageByCode(selectTargetLang.value);
  const { enableThinking, temperature, maxOutputTokens, locale } = settingsStore.getSettings();

  outputTranslatedText.textContent = '';
  btnTranslate.setAttribute('disabled', 'true');

  try {
    if (!modelStore.getIsReady()) {
      await modelStore.loadEngine({
        enableThinking,
        temperature,
        maxOutputTokens
      });
    }

    const prompt = buildTranslationPrompt({
      sourceLang: sourceLang.name,
      targetLang: targetLang.name,
      text: text || 'Translate attached media'
    });

    const translatedResult = await modelStore.translateStreaming(prompt, (chunk) => {
      outputTranslatedText.textContent += chunk;
    });

    const record: TranslationRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      sourceLang: sourceLang.nativeName,
      targetLang: targetLang.nativeName,
      sourceText: text || 'Media input',
      translatedText: translatedResult,
      mediaType: activeAttachment?.type ?? 'text',
      mediaData: activeAttachment?.dataUrl
    };

    await historyStore.addRecord(record);
  } catch (err: unknown) {
    const error = err as Error;
    outputTranslatedText.textContent = `${getDictionary(locale).errTranslation} (${error.message || error})`;
  } finally {
    btnTranslate.removeAttribute('disabled');
  }
}

btnTranslate.addEventListener('click', runTranslation);

inputSourceText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    runTranslation();
  }
});

async function renderHistory(): Promise<void> {
  const query = inputHistorySearch.value;
  const records = await historyStore.getAllRecords(query);
  const { locale } = settingsStore.getSettings();
  const dict = getDictionary(locale);

  historyListContainer.innerHTML = '';

  if (records.length === 0) {
    historyListContainer.innerHTML = `
      <div class="text-center py-12 text-slate-400 text-xs">${dict.emptyHistory}</div>
    `;
    return;
  }

  records.forEach((rec) => {
    const card = document.createElement('article');
    card.className =
      'bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-3.5 space-y-2 text-xs shadow-sm';

    const dateStr = new Date(rec.timestamp).toLocaleString(locale === 'zh-TW' ? 'zh-TW' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let mediaBadge = '';
    if (rec.mediaType === 'image' && rec.mediaData) {
      mediaBadge = `<img src="${rec.mediaData}" class="w-10 h-10 rounded-lg object-cover border border-slate-300 dark:border-slate-700">`;
    } else if (rec.mediaType === 'audio') {
      mediaBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">🔊 Audio</span>`;
    }

    card.innerHTML = `
      <div class="flex items-center justify-between text-slate-400 text-[11px]">
        <span>${dateStr}</span>
        <button data-delete-id="${rec.id}" class="hover:text-red-600 p-0.5 transition">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      <div class="font-semibold text-slate-800 dark:text-slate-200 text-xs">
        ${rec.sourceLang} → ${rec.targetLang}
      </div>
      ${mediaBadge ? `<div class="py-0.5">${mediaBadge}</div>` : ''}
      <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/50">
        <p class="text-sm font-medium text-slate-900 dark:text-slate-100 flex-1 leading-snug">${rec.translatedText}</p>
        <button data-speak-text="${encodeURIComponent(rec.translatedText)}" class="w-7 h-7 rounded-lg bg-teal-700 hover:bg-teal-600 text-white flex items-center justify-center shrink-0 transition">
          <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    card.querySelector('[data-delete-id]')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await historyStore.deleteRecord(rec.id);
      renderHistory();
    });

    card.querySelector('[data-speak-text]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetOption = LANGUAGES.find((l) => l.nativeName === rec.targetLang) ?? LANGUAGES[1]!;
      ttsService.speak(rec.translatedText, targetOption.bcp47);
    });

    historyListContainer.appendChild(card);
  });

  refreshIcons();
}

inputHistorySearch.addEventListener('input', renderHistory);

btnClearHistory.addEventListener('click', async () => {
  const { locale } = settingsStore.getSettings();
  if (confirm(getDictionary(locale).confirmClearHistory)) {
    await historyStore.clearAll();
    renderHistory();
  }
});

// Settings View & Model Management
async function updateSettingsView(): Promise<void> {
  const isInstalled = await modelStore.checkInstallation();
  const isReady = modelStore.getIsReady();
  const { locale, enableThinking } = settingsStore.getSettings();
  const dict = getDictionary(locale);

  toggleThinking.checked = enableThinking;

  if (isReady) {
    badgeE2B.className = 'w-2 h-2 rounded-full bg-emerald-500';
    labelE2BStatus.textContent = dict.modelStatusReady;
    btnDownloadE2B.textContent = dict.modelStatusReady;
    btnDownloadE2B.className = 'px-3.5 py-1.5 rounded-xl bg-teal-700 text-white text-xs font-semibold';
  } else if (isInstalled) {
    badgeE2B.className = 'w-2 h-2 rounded-full bg-blue-500';
    labelE2BStatus.textContent = 'Installed in Cache';
    btnDownloadE2B.textContent = 'Load';
    btnDownloadE2B.className = 'px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold';
  } else {
    badgeE2B.className = 'w-2 h-2 rounded-full bg-slate-400';
    labelE2BStatus.textContent = dict.modelStatusNotDownloaded;
    btnDownloadE2B.textContent = dict.btnDownload;
    btnDownloadE2B.className = 'px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold';
  }

  // Storage Persistence Check
  if (navigator.storage && navigator.storage.persisted) {
    const isPersisted = await navigator.storage.persisted();
    labelStoragePersistence.textContent = isPersisted ? dict.storagePersisted : dict.storageStandard;
    btnRequestPersist.classList.toggle('hidden', isPersisted);
  }

  // TTS status
  const tts = ttsService.getStatus('en-US');
  textTtsReady.textContent = tts.ready ? dict.ttsReadyBadge : dict.ttsUnavailableBadge;
}

btnDownloadE2B.addEventListener('click', async () => {
  const { enableThinking, temperature, maxOutputTokens } = settingsStore.getSettings();
  try {
    await modelStore.loadEngine({
      enableThinking,
      temperature,
      maxOutputTokens
    });
    updateSettingsView();
  } catch (err) {
    console.error('Failed to load engine:', err);
  }
});

btnDeleteE2B.addEventListener('click', async () => {
  if (confirm('Delete Gemma 4 E2B weights from local storage cache?')) {
    await modelStore.deleteModel();
    updateSettingsView();
  }
});

modelStore.onProgress((info) => {
  if (info.status === 'downloading') {
    e2bProgressBarContainer.classList.remove('hidden');
    e2bProgressBar.style.width = `${info.percent}%`;
    e2bProgressText.textContent = `${info.percent.toFixed(0)}%`;
    e2bSpeedText.textContent = `${(info.speed / (1024 * 1024)).toFixed(1)} MB/s`;
  } else if (info.status === 'ready' || info.status === 'idle') {
    e2bProgressBarContainer.classList.add('hidden');
    updateSettingsView();
  }
});

toggleThinking.addEventListener('change', () => {
  settingsStore.setEnableThinking(toggleThinking.checked);
});

toggleTheme.addEventListener('change', () => {
  const newTheme = toggleTheme.checked ? 'dark' : 'light';
  settingsStore.setTheme(newTheme);
  applyTheme();
});

selectUiLanguage.addEventListener('change', () => {
  const newLocale = selectUiLanguage.value as 'en' | 'zh-TW';
  settingsStore.setLocale(newLocale);
  applyI18n();
  updateSettingsView();
});

btnRequestPersist.addEventListener('click', async () => {
  if (navigator.storage && navigator.storage.persist) {
    await navigator.storage.persist();
    updateSettingsView();
  }
});

navTabTranslate.addEventListener('click', () => switchTab('translate'));
navTabHistory.addEventListener('click', () => switchTab('history'));
navTabSettings.addEventListener('click', () => switchTab('settings'));

// App Bootstrapping
window.addEventListener('DOMContentLoaded', async () => {
  applyTheme();
  applyI18n();
  populateLanguageSelectors();
  renderRecentPills();
  refreshIcons();
  await updateSettingsView();

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      console.warn('Service worker registration failed:', e);
    }
  }
});
