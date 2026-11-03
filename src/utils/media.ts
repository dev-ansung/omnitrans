const AUDIO_SAMPLE_RATE = 16000;
const MAX_IMAGE_DIMENSION = 1024;

/** Re-encodes or scales images to standard dimensions (max 1024px) in JPEG/PNG format. */
export async function toSupportedImage(blob: Blob, maxDimension = MAX_IMAGE_DIMENSION): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const origWidth = bitmap.width;
  const origHeight = bitmap.height;

  if (origWidth <= maxDimension && origHeight <= maxDimension && (blob.type === 'image/jpeg' || blob.type === 'image/png')) {
    bitmap.close();
    return blob;
  }

  let targetWidth = origWidth;
  let targetHeight = origHeight;
  if (targetWidth > maxDimension || targetHeight > maxDimension) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((origHeight * maxDimension) / origWidth);
      targetWidth = maxDimension;
    } else {
      targetWidth = Math.round((origWidth * maxDimension) / origHeight);
      targetHeight = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image conversion failed'))),
      'image/jpeg',
      0.88
    );
  });
}

/** Decodes recorded audio (webm/ogg/mp4/aac) and re-encodes it as 16 kHz mono 16-bit WAV. */
export async function toWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();

  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtxClass();

  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    if (audioCtx.state !== 'closed') {
      await audioCtx.close();
    }
  }

  const frames = Math.max(1, Math.ceil(decoded.duration * AUDIO_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, frames, AUDIO_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);

  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, AUDIO_SAMPLE_RATE, true);
  view.setUint32(28, AUDIO_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}
