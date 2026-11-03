import { createIcons, icons } from 'lucide';
import { LANGUAGES, getLanguageByCode } from './constants/languages.js';
import { getDictionary } from './i18n/index.js';
import { HistoryStore } from './stores/history_store.js';
import { ModelStore, type MediaInput } from './stores/model_store.js';
import { SettingsStore } from './stores/settings_store.js';
import { toSupportedImage, toWav } from './utils/media.js';
import { TtsService } from './services/tts_service.js';
import { buildTranslationPrompt } from './utils/prompt_builder.js';
import type { TranslationRecord } from './types/index.js';

const settingsStore = new SettingsStore();
const historyStore = new HistoryStore();
const modelStore = new ModelStore();
const ttsService = new TtsService();

const toastContainer = document.getElementById('toastContainer')!;
let activeAttachment: { type: 'image' | 'audio'; dataUrl: string; name: string; blob: Blob } | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let isRecording = false;
let currentAudioStream: MediaStream | null = null;
let recordingTimerInterval: number | null = null;
let recordingSeconds = 0;

let cameraStream: MediaStream | null = null;
let facingMode: 'user' | 'environment' = 'environment';

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
const btnOpenCamera = document.getElementById('btnOpenCamera')!;
const cameraFileInput = document.getElementById('cameraFileInput') as HTMLInputElement;
const cameraModal = document.getElementById('cameraModal')!;
const cameraVideo = document.getElementById('cameraVideo') as HTMLVideoElement;
const cameraCanvas = document.getElementById('cameraCanvas') as HTMLCanvasElement;
const btnCloseCamera = document.getElementById('btnCloseCamera')!;
const btnCaptureFrame = document.getElementById('btnCaptureFrame')!;
const btnFlipCamera = document.getElementById('btnFlipCamera')!;
const cameraGalleryInput = document.getElementById('cameraGalleryInput') as HTMLInputElement;

const btnMicRecord = document.getElementById('btnMicRecord')!;
const recordingBar = document.getElementById('recordingBar')!;
const recordingTimer = document.getElementById('recordingTimer')!;
const btnStopRecording = document.getElementById('btnStopRecording')!;
const btnCancelRecording = document.getElementById('btnCancelRecording')!;
const btnPlaySourceTts = document.getElementById('btnPlaySourceTts')!;
const btnTranslate = document.getElementById('btnTranslate')!;
const mediaAttachmentPreview = document.getElementById('mediaAttachmentPreview')!;
const mediaAttachmentContent = document.getElementById('mediaAttachmentContent')!;
const btnRemoveAttachment = document.getElementById('btnRemoveAttachment')!;

const outputTranslatedText = document.getElementById('outputTranslatedText')!;
const inferenceIndicator = document.getElementById('inferenceIndicator')!;
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
const inputSystemPrompt = document.getElementById('inputSystemPrompt') as HTMLTextAreaElement;
const btnSaveSystemPrompt = document.getElementById('btnSaveSystemPrompt')!;
const textTtsReady = document.getElementById('textTtsReady')!;
const labelAppVersion = document.getElementById('labelAppVersion')!;

export function showToast(message: string, durationMs = 2800): void {
  const toast = document.createElement('div');
  toast.className =
    'bg-slate-900/90 text-white dark:bg-white/95 dark:text-slate-900 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg backdrop-blur flex items-center gap-2 transform transition-all duration-200 -translate-y-2 opacity-0 select-none';
  toast.innerHTML = `<span>${message}</span>`;
  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('-translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('-translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 250);
  }, durationMs);
}

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

// Camera & Image Attachment
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header!.match(/:(.*?);/)![1]!;
  const bytes = Uint8Array.from(atob(b64!), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

function handleImageFile(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    activeAttachment = {
      type: 'image',
      dataUrl: reader.result as string,
      name: file.name,
      blob: file
    };
    mediaAttachmentContent.innerHTML = `
      <img src="${reader.result}" class="w-8 h-8 rounded-lg object-cover border border-slate-300 dark:border-slate-700">
      <span class="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[180px]">${file.name}</span>
    `;
    mediaAttachmentPreview.classList.remove('hidden');
    stopCamera();
    refreshIcons();
    showToast('Image attached');
  };
  reader.readAsDataURL(file);
}

async function startCamera(): Promise<void> {
  stopCamera();
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia not supported');
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode } },
      audio: false
    });
    cameraVideo.srcObject = cameraStream;
    cameraModal.classList.remove('hidden');
    refreshIcons();
  } catch (err) {
    console.warn('Camera stream error, falling back to file picker:', err);
    const { locale } = settingsStore.getSettings();
    showToast(getDictionary(locale).toastCameraUnavailable);
    cameraFileInput.click();
  }
}

function stopCamera(): void {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
  cameraModal.classList.add('hidden');
}

btnOpenCamera.addEventListener('click', () => {
  startCamera();
});

btnCloseCamera.addEventListener('click', () => {
  stopCamera();
});

btnFlipCamera.addEventListener('click', async () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  await startCamera();
});

btnCaptureFrame.addEventListener('click', () => {
  if (!cameraVideo.videoWidth || !cameraVideo.videoHeight) return;
  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;
  const ctx = cameraCanvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
    const dataUrl = cameraCanvas.toDataURL('image/jpeg', 0.85);
    const fileName = `Snapshot_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.jpg`;
    activeAttachment = {
      type: 'image',
      dataUrl,
      name: fileName,
      blob: dataUrlToBlob(dataUrl)
    };
    mediaAttachmentContent.innerHTML = `
      <img src="${dataUrl}" class="w-8 h-8 rounded-lg object-cover border border-slate-300 dark:border-slate-700">
      <span class="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[180px]">${fileName}</span>
    `;
    mediaAttachmentPreview.classList.remove('hidden');
    stopCamera();
    refreshIcons();
    showToast('Photo captured');
  }
});

document.addEventListener('paste', (e) => {
  if (viewTranslate.classList.contains('hidden')) return;
  const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  handleImageFile(file);
});

cameraGalleryInput.addEventListener('change', () => {
  const file = cameraGalleryInput.files?.[0];
  if (file) handleImageFile(file);
});

cameraFileInput.addEventListener('change', () => {
  const file = cameraFileInput.files?.[0];
  if (file) handleImageFile(file);
});

btnRemoveAttachment.addEventListener('click', () => {
  activeAttachment = null;
  cameraFileInput.value = '';
  cameraGalleryInput.value = '';
  mediaAttachmentPreview.classList.add('hidden');
  mediaAttachmentContent.innerHTML = '';
});

// Microphone Voice Recording
function formatRecordingTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function startVoiceRecording(): Promise<void> {
  if (isRecording) return;
  const { locale } = settingsStore.getSettings();

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(getDictionary(locale).toastMicDenied);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    currentAudioStream = stream;
    audioChunks = [];

    let mimeType = '';
    if (typeof MediaRecorder !== 'undefined') {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
    }

    mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    recordingSeconds = 0;
    recordingTimer.textContent = '00:00';
    if (recordingTimerInterval) clearInterval(recordingTimerInterval);
    recordingTimerInterval = window.setInterval(() => {
      recordingSeconds += 1;
      recordingTimer.textContent = formatRecordingTime(recordingSeconds);
    }, 1000);

    recordingBar.classList.remove('hidden');
    btnMicRecord.classList.add('text-red-600', 'bg-red-50');
    isRecording = true;
    mediaRecorder.start(250);
  } catch (err) {
    console.error('Microphone access denied:', err);
    showToast(getDictionary(locale).toastMicDenied);
  }
}

function stopVoiceRecording(save = true): void {
  if (recordingTimerInterval) {
    clearInterval(recordingTimerInterval);
    recordingTimerInterval = null;
  }

  isRecording = false;
  recordingBar.classList.add('hidden');
  btnMicRecord.classList.remove('text-red-600', 'bg-red-50');

  if (!mediaRecorder) return;

  if (save) {
    mediaRecorder.onstop = () => {
      const recordedType = mediaRecorder?.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunks, { type: recordedType });
      const audioUrl = URL.createObjectURL(audioBlob);
      activeAttachment = {
        type: 'audio',
        dataUrl: audioUrl,
        name: `Voice_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}`,
        blob: audioBlob
      };
      mediaAttachmentContent.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-semibold text-xs">
          <i data-lucide="mic" class="w-3.5 h-3.5"></i> Audio
        </span>
        <audio src="${audioUrl}" controls class="h-7 max-w-[200px]"></audio>
      `;
      mediaAttachmentPreview.classList.remove('hidden');
      refreshIcons();
      const { locale } = settingsStore.getSettings();
      showToast(getDictionary(locale).toastAudioAttached);
    };
  } else {
    mediaRecorder.onstop = null;
    audioChunks = [];
  }

  if (mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }

  if (currentAudioStream) {
    currentAudioStream.getTracks().forEach((track) => track.stop());
    currentAudioStream = null;
  }
}

btnMicRecord.addEventListener('click', () => {
  if (isRecording) {
    stopVoiceRecording(true);
  } else {
    startVoiceRecording();
  }
});

btnStopRecording.addEventListener('click', () => {
  stopVoiceRecording(true);
});

btnCancelRecording.addEventListener('click', () => {
  stopVoiceRecording(false);
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
    showToast(toast);
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

function setInferenceBusy(busy: boolean): void {
  inferenceIndicator.classList.toggle('hidden', !busy);
  const icon = btnTranslate.querySelector('svg, i');
  icon?.classList.toggle('infer-spin', busy);
}

async function runTranslation(): Promise<void> {
  const text = inputSourceText.value.trim();
  if (!text && !activeAttachment) return;

  const sourceLang = getLanguageByCode(selectSourceLang.value);
  const targetLang = getLanguageByCode(selectTargetLang.value);
  const { enableThinking, temperature, maxOutputTokens, systemPrompt, locale } = settingsStore.getSettings();
  const dict = getDictionary(locale);

  outputTranslatedText.textContent = '';
  btnTranslate.setAttribute('disabled', 'true');
  setInferenceBusy(true);

  try {
    if (!modelStore.getIsReady()) {
      showToast(dict.toastModelLoading);
      await modelStore.loadEngine({
        enableThinking,
        temperature,
        maxOutputTokens
      });
    }

    const prompt = buildTranslationPrompt({
      sourceLang: sourceLang.name,
      targetLang: targetLang.name,
      text: text || (activeAttachment?.type === 'audio'
        ? '(Transcribe and translate the attached audio.)'
        : activeAttachment?.type === 'image'
          ? '(Translate all text visible in the attached image.)'
          : ''),
      systemPrompt
    });

    let media: MediaInput | undefined;
    if (activeAttachment) {
      media = {
        type: activeAttachment.type,
        data:
          activeAttachment.type === 'audio'
            ? await toWav(activeAttachment.blob)
            : await toSupportedImage(activeAttachment.blob)
      };
    }

    if (media) console.info(`Sending ${media.type}: ${media.data.type}, ${media.data.size} bytes`);
    const translatedResult = await modelStore.translateStreaming(
      prompt,
      (chunk) => {
        inferenceIndicator.classList.add('hidden');
        outputTranslatedText.textContent += chunk;
      },
      media
    );

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
    showToast(dict.toastTranslationSaved);
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Translation failed:', err);
    outputTranslatedText.textContent = `${getDictionary(locale).errTranslation} (${error.message || error})`;
  } finally {
    btnTranslate.removeAttribute('disabled');
    setInferenceBusy(false);
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
  const { locale, enableThinking, systemPrompt } = settingsStore.getSettings();
  const dict = getDictionary(locale);

  toggleThinking.checked = enableThinking;
  inputSystemPrompt.value = systemPrompt;

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

btnSaveSystemPrompt.addEventListener('click', () => {
  settingsStore.setSystemPrompt(inputSystemPrompt.value);
  const { locale } = settingsStore.getSettings();
  showToast(getDictionary(locale).toastPromptSaved);
});

btnDownloadE2B.addEventListener('click', async () => {
  const { enableThinking, temperature, maxOutputTokens, locale } = settingsStore.getSettings();
  showToast(getDictionary(locale).toastModelLoading);
  try {
    await modelStore.loadEngine({
      enableThinking,
      temperature,
      maxOutputTokens
    });
    updateSettingsView();
    showToast(getDictionary(locale).toastModelReady);
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

let hasShownDownloadingToast = false;
modelStore.onProgress((info) => {
  if (info.status === 'downloading') {
    if (!hasShownDownloadingToast) {
      hasShownDownloadingToast = true;
      const { locale } = settingsStore.getSettings();
      showToast(getDictionary(locale).toastModelDownloading);
    }
    e2bProgressBarContainer.classList.remove('hidden');
    e2bProgressBar.style.width = `${info.percent}%`;
    e2bProgressText.textContent = `${info.percent.toFixed(0)}%`;
    e2bSpeedText.textContent = `${(info.speed / (1024 * 1024)).toFixed(1)} MB/s`;
  } else if (info.status === 'ready' || info.status === 'idle') {
    hasShownDownloadingToast = false;
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
    const granted = await navigator.storage.persist();
    const { locale } = settingsStore.getSettings();
    if (granted) {
      showToast(getDictionary(locale).toastStoragePersistSuccess);
    }
    updateSettingsView();
  }
});

navTabTranslate.addEventListener('click', () => switchTab('translate'));
navTabHistory.addEventListener('click', () => switchTab('history'));
navTabSettings.addEventListener('click', () => switchTab('settings'));

// App Bootstrapping
window.addEventListener('DOMContentLoaded', async () => {
  labelAppVersion.textContent = `Omnitrans ${__APP_VERSION__}`;
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
