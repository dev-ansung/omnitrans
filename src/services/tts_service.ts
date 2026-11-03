export interface TtsStatus {
  supported: boolean;
  ready: boolean;
  offlineReady: boolean;
  voiceName?: string;
}

export class TtsService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices(): void {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  getStatus(bcp47 = 'en-US'): TtsStatus {
    if (!this.synth) {
      return { supported: false, ready: false, offlineReady: false };
    }
    const voice = this.findVoiceForLanguage(bcp47);
    return {
      supported: true,
      ready: this.voices.length > 0,
      offlineReady: voice?.localService ?? false,
      voiceName: voice?.name
    };
  }

  findVoiceForLanguage(bcp47: string): SpeechSynthesisVoice | undefined {
    const langCode = bcp47.toLowerCase();
    const prefix = langCode.split('-')[0]!;

    return (
      this.voices.find((v) => v.lang.toLowerCase() === langCode && v.localService) ??
      this.voices.find((v) => v.lang.toLowerCase() === langCode) ??
      this.voices.find((v) => v.lang.toLowerCase().startsWith(prefix) && v.localService) ??
      this.voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
    );
  }

  speak(text: string, bcp47: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth || !text.trim()) {
        resolve();
        return;
      }

      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = bcp47;

      const voice = this.findVoiceForLanguage(bcp47);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => resolve();
      utterance.onerror = (e) => reject(e);

      this.synth.speak(utterance);
    });
  }

  stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}
