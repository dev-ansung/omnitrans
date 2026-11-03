import {
  Engine,
  SamplerType,
  resolveModel,
  Backend,
  type Conversation,
  type ContentPart
} from '@litert-lm/core';

export const DEFAULT_MODEL_PATH = 'hf://litert-community/gemma-4-E2B-it-litert-lm';
const CACHE_NAME = 'litertlm-models';
const HF_MODEL_URLS_KEY = 'litertlm-hf-model-urls';

export interface ModelProgressInfo {
  status: 'idle' | 'checking' | 'downloading' | 'caching' | 'loading' | 'ready' | 'error';
  percent: number;
  loadedBytes: number;
  totalBytes: number;
  speed: number;
  etaSeconds: number;
  message: string;
}

export interface MediaInput {
  type: 'image' | 'audio';
  data: Blob;
}

export type ProgressListener = (info: ModelProgressInfo) => void;

export class ModelStore {
  private engine: Engine | null = null;
  private conversation: Conversation | null = null;
  private isGenerating = false;
  private downloadAbortController: AbortController | null = null;
  private progressListeners: Set<ProgressListener> = new Set();
  private isInstalled = false;

  constructor() {
    this.checkInstallation();
  }

  onProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  private notifyProgress(info: ModelProgressInfo): void {
    for (const listener of this.progressListeners) {
      listener(info);
    }
  }

  private getHfModelUrls(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(HF_MODEL_URLS_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  private setHfModelUrl(modelPath: string, url: string): void {
    const urls = this.getHfModelUrls();
    urls[modelPath] = url;
    localStorage.setItem(HF_MODEL_URLS_KEY, JSON.stringify(urls));
  }

  private async resolveModelUrl(modelPath: string): Promise<string> {
    if (!modelPath.startsWith('hf://')) return modelPath;
    const resolved = await resolveModel(modelPath, { backend: Backend.GPU });
    if (resolved.huggingFace?.source?.url) {
      return resolved.huggingFace.source.url;
    }
    if (typeof resolved.model === 'string') {
      return resolved.model;
    }
    if (typeof resolved.model === 'object' && resolved.model !== null && 'url' in resolved.model) {
      return (resolved.model as { url: string }).url;
    }
    const lastUrl = this.getHfModelUrls()[modelPath];
    if (lastUrl) return lastUrl;
    throw new Error(`Unable to resolve Hugging Face model URL: ${modelPath}`);
  }

  async checkInstallation(): Promise<boolean> {
    try {
      const cache = await caches.open(CACHE_NAME);
      let modelUrl = this.getHfModelUrls()[DEFAULT_MODEL_PATH];

      let match = modelUrl ? await cache.match(modelUrl) : null;
      if (!match) {
        try {
          modelUrl = await this.resolveModelUrl(DEFAULT_MODEL_PATH);
          match = await cache.match(modelUrl);
          if (match) {
            this.setHfModelUrl(DEFAULT_MODEL_PATH, modelUrl);
          }
        } catch {
          // Offline or unresolved
        }
      }

      this.isInstalled = !!match;
      return this.isInstalled;
    } catch {
      this.isInstalled = false;
      return false;
    }
  }

  getIsInstalled(): boolean {
    return this.isInstalled;
  }

  getIsReady(): boolean {
    return this.engine !== null;
  }

  private makeProgressStream(
    source: ReadableStream<Uint8Array>,
    onProgress: (chunkLength: number) => void
  ): ReadableStream<Uint8Array> {
    const reader = source.getReader();
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          onProgress(value.length);
          controller.enqueue(value);
        } catch (e) {
          controller.error(e);
        }
      },
      cancel(reason) {
        reader.cancel(reason);
      }
    });
  }

  async installModel(): Promise<void> {
    this.notifyProgress({
      status: 'checking',
      percent: 0,
      loadedBytes: 0,
      totalBytes: 2008432640,
      speed: 0,
      etaSeconds: 0,
      message: 'Resolving model URL...'
    });

    this.downloadAbortController = new AbortController();
    const signal = this.downloadAbortController.signal;

    try {
      const modelUrl = await this.resolveModelUrl(DEFAULT_MODEL_PATH);
      const response = await fetch(modelUrl, { signal });
      if (!response.ok) {
        throw new Error(`Download failed: HTTP ${response.status} ${response.statusText}`);
      }

      const contentLength = Number(response.headers.get('content-length')) || 2008432640;
      let loaded = 0;
      let lastTime = performance.now();
      let lastLoaded = 0;
      let currentSpeed = 0;

      const progressStream = this.makeProgressStream(response.body!, (chunkLength) => {
        loaded += chunkLength;
        const now = performance.now();
        if (now - lastTime >= 200) {
          currentSpeed = (loaded - lastLoaded) / ((now - lastTime) / 1000);
          lastTime = now;
          lastLoaded = loaded;
          const remaining = currentSpeed > 0 ? (contentLength - loaded) / currentSpeed : 0;
          this.notifyProgress({
            status: 'downloading',
            percent: Math.min(100, (loaded / contentLength) * 100),
            loadedBytes: loaded,
            totalBytes: contentLength,
            speed: currentSpeed,
            etaSeconds: remaining,
            message: 'Downloading model weights...'
          });
        }
      });

      const cacheResponse = new Response(progressStream, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': contentLength.toString()
        }
      });

      this.notifyProgress({
        status: 'caching',
        percent: 99,
        loadedBytes: contentLength,
        totalBytes: contentLength,
        speed: 0,
        etaSeconds: 0,
        message: 'Writing model to persistent storage...'
      });

      const cache = await caches.open(CACHE_NAME);
      await cache.put(modelUrl, cacheResponse);
      this.setHfModelUrl(DEFAULT_MODEL_PATH, modelUrl);
      this.isInstalled = true;

      this.notifyProgress({
        status: 'idle',
        percent: 100,
        loadedBytes: contentLength,
        totalBytes: contentLength,
        speed: 0,
        etaSeconds: 0,
        message: 'Installation complete.'
      });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError') {
        this.notifyProgress({
          status: 'idle',
          percent: 0,
          loadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          etaSeconds: 0,
          message: 'Download cancelled.'
        });
      } else {
        this.notifyProgress({
          status: 'error',
          percent: 0,
          loadedBytes: 0,
          totalBytes: 0,
          speed: 0,
          etaSeconds: 0,
          message: error.message || 'Installation error'
        });
        throw error;
      }
    } finally {
      this.downloadAbortController = null;
    }
  }

  cancelDownload(): void {
    if (this.downloadAbortController) {
      this.downloadAbortController.abort();
      this.downloadAbortController = null;
    }
  }

  async deleteModel(): Promise<void> {
    try {
      const cache = await caches.open(CACHE_NAME);
      const modelUrl = this.getHfModelUrls()[DEFAULT_MODEL_PATH];
      if (modelUrl) {
        await cache.delete(modelUrl);
      }
      if (this.engine) {
        await this.unload();
      }
      this.isInstalled = false;
      this.notifyProgress({
        status: 'idle',
        percent: 0,
        loadedBytes: 0,
        totalBytes: 0,
        speed: 0,
        etaSeconds: 0,
        message: 'Model removed from cache.'
      });
    } catch (err) {
      console.error('Failed to delete model:', err);
    }
  }

  async loadEngine(options: {
    enableThinking: boolean;
    temperature: number;
    maxOutputTokens: number;
    customFile?: File;
  }): Promise<void> {
    this.notifyProgress({
      status: 'loading',
      percent: 0,
      loadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      etaSeconds: 0,
      message: 'Loading model weights into WebGPU...'
    });

    let modelSource: ReadableStream<Uint8Array> | File;

    if (options.customFile) {
      modelSource = options.customFile;
    } else {
      const cache = await caches.open(CACHE_NAME);
      let modelUrl = this.getHfModelUrls()[DEFAULT_MODEL_PATH];
      let cachedResponse = modelUrl ? await cache.match(modelUrl) : null;

      if (!cachedResponse) {
        await this.installModel();
        modelUrl = this.getHfModelUrls()[DEFAULT_MODEL_PATH];
        cachedResponse = modelUrl ? await cache.match(modelUrl) : null;
      }

      if (!cachedResponse || !cachedResponse.body) {
        throw new Error('Model weights not found in storage.');
      }

      modelSource = cachedResponse.body;
    }

    if (this.engine) {
      await this.engine.delete();
      this.engine = null;
      this.conversation = null;
    }

    this.engine = await Engine.create({
      model: modelSource,
      visionBackend: Backend.GPU,
      audioBackend: Backend.CPU,
      mainExecutorSettings: {
        maxNumTokens: 4096,
        maxNumImages: 1
      },
      benchmarkEnabled: true
    });

    this.conversation = await this.engine.createConversation({
      preface: {
        messages: [
          {
            role: 'system',
            content:
              'You are a high-speed accurate translator. Translate the given text directly into the requested language without commentary.'
          }
        ],
        extra_context: {
          enable_thinking: options.enableThinking
        }
      },
      sessionConfig: {
        maxOutputTokens: options.maxOutputTokens,
        samplerParams: {
          type: SamplerType.TOP_P,
          temperature: options.temperature,
          p: 0.95,
          k: 64
        }
      },
      enableConstrainedDecoding: true
    });

    this.notifyProgress({
      status: 'ready',
      percent: 100,
      loadedBytes: 0,
      totalBytes: 0,
      speed: 0,
      etaSeconds: 0,
      message: 'Inference engine ready.'
    });
  }

  async translateStreaming(
    prompt: string,
    onChunk: (textChunk: string) => void,
    media?: MediaInput
  ): Promise<string> {
    if (!this.conversation) {
      throw new Error('Inference engine is not initialized.');
    }
    if (this.isGenerating) {
      this.conversation.cancel();
    }

    this.isGenerating = true;
    let fullText = '';

    try {
      const message = media
        ? {
            role: 'user' as const,
            content: [
              { type: media.type, data: media.data },
              { type: 'text', text: prompt }
            ] as ContentPart[]
          }
        : prompt;
      const stream = this.conversation.sendMessageStreaming(message);
      for await (const chunk of stream) {
        let textDelta = '';
        if (Array.isArray(chunk.content)) {
          for (const part of chunk.content) {
            if (part.type === 'text') textDelta += part.text;
          }
        } else if (typeof chunk.content === 'string') {
          textDelta += chunk.content;
        }

        if (textDelta) {
          fullText += textDelta;
          onChunk(textDelta);
        }
      }
      return fullText;
    } finally {
      this.isGenerating = false;
    }
  }

  cancelGeneration(): void {
    if (this.conversation && this.isGenerating) {
      this.conversation.cancel();
      this.isGenerating = false;
    }
  }

  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.delete();
      this.engine = null;
      this.conversation = null;
    }
  }
}
