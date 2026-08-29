// Service for persisting and retrieving PDF binary data (base64 Data URLs & Blobs)
// Uses IndexedDB + SessionStorage + In-Memory Map so uploaded files are NEVER lost.

const MEMORY_PDF_STORE = new Map<string, string>();

const DB_NAME = 'NSPC_PDF_DB';
const STORE_NAME = 'pdf_files';

function openPdfDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Preloads all stored items from IndexedDB into memory cache
 */
export async function initPdfStore(): Promise<void> {
  try {
    const db = await openPdfDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (cursor.key && cursor.value) {
            MEMORY_PDF_STORE.set(String(cursor.key), String(cursor.value));
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => resolve();
    });
  } catch (e) {
    console.warn('[pdfStore] Preload from IndexedDB failed:', e);
  }
}

// Auto-initialize on module load if in browser
if (typeof window !== 'undefined') {
  initPdfStore().catch(() => {});
}

export async function savePdfDataUrl(pdfId: string, dataUrl: string): Promise<void> {
  if (!pdfId || !dataUrl) return;

  // 1. Memory Cache
  MEMORY_PDF_STORE.set(pdfId, dataUrl);

  // 2. SessionStorage Cache
  try {
    sessionStorage.setItem(`pdf_data_${pdfId}`, dataUrl);
  } catch (e) {
    // ignore sessionStorage quota limits
  }

  // 3. IndexedDB Persistent Store
  try {
    const db = await openPdfDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(dataUrl, pdfId);
  } catch (err) {
    console.warn('[pdfStore] IndexedDB save error:', err);
  }
}

export function getPdfDataUrlSync(pdfId: string): string | undefined {
  if (!pdfId) return undefined;

  // 1. Memory Cache
  if (MEMORY_PDF_STORE.has(pdfId)) {
    return MEMORY_PDF_STORE.get(pdfId);
  }

  // 2. SessionStorage
  try {
    const sessData = sessionStorage.getItem(`pdf_data_${pdfId}`);
    if (sessData) {
      MEMORY_PDF_STORE.set(pdfId, sessData);
      return sessData;
    }
  } catch (e) {}

  return undefined;
}

export async function getPdfDataUrl(pdfId: string): Promise<string | undefined> {
  if (!pdfId) return undefined;

  const syncVal = getPdfDataUrlSync(pdfId);
  if (syncVal) return syncVal;

  // Check IndexedDB asynchronously
  try {
    const db = await openPdfDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(pdfId);
      req.onsuccess = () => {
        const result = req.result as string | undefined;
        if (result) {
          MEMORY_PDF_STORE.set(pdfId, result);
        }
        resolve(result);
      };
      req.onerror = () => resolve(undefined);
    });
  } catch (e) {
    return undefined;
  }
}

// Convert Data URL (base64) to Blob
export function dataUrlToBlob(dataUrl: string): Blob {
  try {
    if (dataUrl.startsWith('data:')) {
      const parts = dataUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    }
  } catch (e) {
    console.error('[pdfStore] dataUrlToBlob failed:', e);
  }
  return new Blob([dataUrl], { type: 'application/pdf' });
}

// Helper to trigger file download of uploaded PDF
export function triggerPdfDownload(dataUrl: string, fileName: string): void {
  try {
    const blob = dataUrlToBlob(dataUrl);
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (err) {
    console.error('[pdfStore] triggerPdfDownload failed:', err);
  }
}
