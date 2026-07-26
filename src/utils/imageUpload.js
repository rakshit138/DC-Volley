/** True if value is a base64 data URL (not an https URL). */
export function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

/** Approximate byte length of a data URL string in Firestore. */
export function dataUrlByteSize(dataUrl) {
  return typeof dataUrl === 'string' ? new Blob([dataUrl]).size : 0;
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('Invalid image'));
    img.onload = () => resolve(img);
    img.src = dataUrl;
  });
}

function renderJPEG(img, maxDim, quality) {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Resize/compress an image file for logo use.
 * Returns a JPEG data URL suitable for preview.
 */
export function compressImageFile(file, maxDim = 96, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = async (e) => {
      try {
        const img = await loadImageFromDataUrl(e.target?.result);
        resolve(renderJPEG(img, maxDim, quality));
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}

/** Compress a data URL to target dimensions/quality. */
export async function compressDataUrl(dataUrl, maxDim = 96, quality = 0.72) {
  if (!isDataUrl(dataUrl)) return dataUrl;
  const img = await loadImageFromDataUrl(dataUrl);
  return renderJPEG(img, maxDim, quality);
}

/**
 * Compress until under maxBytes (default ~28KB — safe for Firestore gameAssets doc).
 * Works on Spark/free tier without Firebase Storage.
 */
export async function compressToMaxBytes(source, maxBytes = 28000) {
  if (!source) return '';
  if (!isDataUrl(source)) return source;

  let maxDim = 96;
  let quality = 0.72;
  let result = await compressDataUrl(source, maxDim, quality);

  for (let i = 0; i < 12 && dataUrlByteSize(result) > maxBytes; i++) {
    if (quality > 0.42) {
      quality -= 0.08;
    } else {
      maxDim = Math.max(40, maxDim - 12);
      quality = 0.65;
    }
    result = await compressDataUrl(source, maxDim, quality);
  }

  return result;
}
