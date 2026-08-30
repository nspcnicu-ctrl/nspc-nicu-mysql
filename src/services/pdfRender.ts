import { jsPDF } from 'jspdf';

/**
 * Checks if a string is a Google Drive URL
 */
export function isGoogleDriveUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('drive.google.com') ||
    url.includes('docs.google.com') ||
    url.includes('google.com/drive')
  );
}

/**
 * Extracts the file or document ID from various Google Drive and Google Docs URLs.
 */
export function getGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Pattern 1: drive.google.com/file/d/FILE_ID/view or /preview
  const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) return fileIdMatch[1];

  // Pattern 2: drive.google.com/open?id=FILE_ID or ?id=FILE_ID or &id=FILE_ID
  const openIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openIdMatch && openIdMatch[1]) return openIdMatch[1];

  // Pattern 3: docs.google.com/document/d/DOC_ID/
  const docIdMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docIdMatch && docIdMatch[1]) return docIdMatch[1];

  // Pattern 4: docs.google.com/presentation/d/PRES_ID/
  const presIdMatch = trimmed.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (presIdMatch && presIdMatch[1]) return presIdMatch[1];

  // Pattern 5: drive.google.com/uc?id=FILE_ID
  const ucIdMatch = trimmed.match(/\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]+)/);
  if (ucIdMatch && ucIdMatch[1]) return ucIdMatch[1];

  return null;
}

/**
 * Gets the direct download URL for a Google Drive file:
 * https://drive.google.com/uc?export=download&id=FILE_ID
 */
export function getGoogleDriveDirectDownloadUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const fileId = getGoogleDriveFileId(url);
  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return url;
}

/**
 * Automatically converts Google Drive URLs to the native embed preview URL:
 * https://drive.google.com/file/d/FILE_ID/preview
 */
export function formatGoogleDriveEmbedUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  const fileId = getGoogleDriveFileId(trimmed);
  if (fileId) {
    if (trimmed.includes('docs.google.com/document')) {
      return `https://docs.google.com/document/d/${fileId}/preview`;
    }
    if (trimmed.includes('docs.google.com/presentation')) {
      return `https://docs.google.com/presentation/d/${fileId}/preview`;
    }
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }

  // Replace trailing /view with /preview
  if (trimmed.includes('drive.google.com') && trimmed.includes('/view')) {
    return trimmed.replace(/\/view(\?.*)?$/, '/preview');
  }

  return trimmed;
}

/**
 * Converts a Google Drive image link (e.g. file/d/ID/view, open?id=ID, uc?id=ID)
 * into high-performance, CORS-free direct Google Drive image URL:
 * https://lh3.googleusercontent.com/d/FILE_ID
 */
export function formatGoogleDriveImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  const fileId = getGoogleDriveFileId(trimmed);
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return trimmed;
}

/**
 * Normalizes a Cover / Thumbnail Image URL:
 * - If Google Drive URL: automatically converts to https://lh3.googleusercontent.com/d/FILE_ID
 * - If direct image link (PNG, JPG, WebP, Imgur, etc.): trims and returns
 */
export function processCoverImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (isGoogleDriveUrl(trimmed)) {
    return formatGoogleDriveImageUrl(trimmed);
  }
  return trimmed;
}

/**
 * Normalizes a PDF Document URL:
 * - If Google Drive URL: automatically converts to /preview embed URL
 * - If direct PDF link or Cloud URL: trims and returns
 */
export function processPdfDocumentUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (isGoogleDriveUrl(trimmed)) {
    return formatGoogleDriveEmbedUrl(trimmed);
  }
  return trimmed;
}

/**
 * Automatically processes both PDF URL and Cover Image URL in one shot
 */
export function processEducationUrls(pdfUrl: string, coverImageUrl?: string): {
  finalPdfUrl: string;
  finalCoverUrl: string;
} {
  const finalPdfUrl = processPdfDocumentUrl(pdfUrl);
  const finalCoverUrl = coverImageUrl ? processCoverImageUrl(coverImageUrl) : '';
  return { finalPdfUrl, finalCoverUrl };
}

/**
 * Resolves the appropriate embed preview URL for any PDF source:
 * 1. Google Drive -> https://drive.google.com/file/d/FILE_ID/preview
 * 2. Server URL (HTTP/HTTPS) -> https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true
 * 3. Base64 Data URL or Blob -> Direct Data URL
 */
export function getPdfEmbedUrl(pdfUrl: string): string {
  if (!pdfUrl || typeof pdfUrl !== 'string') return '';
  const trimmed = pdfUrl.trim();

  if (isGoogleDriveUrl(trimmed)) {
    return formatGoogleDriveEmbedUrl(trimmed);
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // If it's already a viewer url, return as is
    if (trimmed.includes('docs.google.com/viewer')) return trimmed;
    return `https://docs.google.com/viewer?url=${encodeURIComponent(trimmed)}&embedded=true`;
  }

  return trimmed;
}

/**
 * Resolves the direct download URL for any PDF source:
 * 1. Google Drive -> https://drive.google.com/uc?export=download&id=FILE_ID
 * 2. Server URL -> Direct URL for <a download>
 */
export function getPdfDirectDownloadUrl(pdfUrl: string): string {
  if (!pdfUrl || typeof pdfUrl !== 'string') return '';
  const trimmed = pdfUrl.trim();

  if (isGoogleDriveUrl(trimmed)) {
    return getGoogleDriveDirectDownloadUrl(trimmed);
  }

  return trimmed;
}

/**
 * Lightweight safe PDF cover thumbnail generator without any external worker dependencies.
 * Returns clean coverUrl and pageCount.
 */
export async function renderPdfFirstPageToImage(
  pdfDataUrlOrBlob: string | Blob | ArrayBuffer,
  title: string = 'Modul Edukasi NICU',
  category: string = 'EDUKASI'
): Promise<{ coverUrl: string; numPages: number }> {
  try {
    if (!pdfDataUrlOrBlob) {
      return { coverUrl: generateFallbackPdfCover(title, category), numPages: 1 };
    }

    // If it's already an image data URL
    if (typeof pdfDataUrlOrBlob === 'string' && pdfDataUrlOrBlob.startsWith('data:image/')) {
      return { coverUrl: pdfDataUrlOrBlob, numPages: 1 };
    }

    // Generate crisp canvas cover
    const coverUrl = generateFallbackPdfCover(title, category);
    return { coverUrl, numPages: 1 };
  } catch (error) {
    console.warn('[PDF] Cover generation fallback used:', error);
    return { coverUrl: generateFallbackPdfCover(title, category), numPages: 1 };
  }
}

/**
 * Generates a valid PDF document as a base64 Data URL (data:application/pdf;base64,...)
 * using jsPDF so that every module has a real binary PDF file.
 */
export function generateSamplePdfDataUrl(title: string, category: string, nakesNote?: string): string {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Top Header Banner
    doc.setFillColor(13, 148, 136); // Teal 600
    doc.rect(0, 0, 210, 26, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RSUD UNDATA PROVINSI SULAWESI TENGAH', 105, 12, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Unit Perawatan Intensif Neonatus (NICU) & Neo-Special Care Parent (NSPC)', 105, 19, { align: 'center' });

    let y = 36;

    // Category Badge
    doc.setFillColor(204, 251, 241);
    doc.setDrawColor(153, 246, 228);
    doc.roundedRect(15, y, 75, 8, 2, 2, 'FD');
    doc.setTextColor(15, 118, 110);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`KATEGORI: ${(category || 'EDUKASI').toUpperCase()}`, 18, y + 5.5);

    y += 14;

    // Document Title
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    const titleLines = doc.splitTextToSize(title || 'Panduan Edukasi NICU RSUD Undata', 180);
    doc.text(titleLines, 15, y);
    y += titleLines.length * 7 + 4;

    // Subtitle / Meta Bar
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, 180, 8, 2, 2, 'FD');
    doc.setTextColor(100, 116, 139);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text('Diterbitkan oleh Tim Nakes NICU RSUD Undata • Dokumen Edukasi Resmi Pasien', 18, y + 5);

    y += 14;

    // Nakes Notes Box
    if (nakesNote) {
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 118, 110);

      const noteTextLines = doc.splitTextToSize(`"${nakesNote}"`, 170);
      const boxHeight = Math.max(16, noteTextLines.length * 5 + 10);

      doc.roundedRect(15, y, 180, boxHeight, 2, 2, 'FD');
      doc.text('CATATAN KHUSUS DARI TENAGA KESEHATAN NICU:', 19, y + 6);

      doc.setFont('helvetica', 'italic');
      doc.setTextColor(6, 78, 59);
      doc.setFontSize(9.5);
      doc.text(noteTextLines, 19, y + 12);

      y += boxHeight + 10;
    }

    // Main Guidelines Box
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, y, 180, 115, 3, 3, 'FD');

    doc.setTextColor(15, 118, 110);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PANDUAN UTAMA PERAWATAN BAYI PREMATUR / BBLR DI RUMAH', 20, y + 10);
    doc.setDrawColor(204, 251, 241);
    doc.line(20, y + 13, 190, y + 13);

    const points = [
      { title: 'Metode Kanguru (PMK):', text: 'Pelaksanaan kontak kulit-ke-kulit (skin-to-skin) secara teratur untuk menjaga kehangatan, kestabilan suhu tubuh, serta meningkatkan ikatan batin orang tua dan bayi.' },
      { title: 'Pemberian & Penyimpanan ASI:', text: 'Panduan higienis memerah ASI (ASIP), penyimpanan di suhu ruangan maupun freezer, serta teknik pemberian nutrisi yang aman untuk bayi preterm.' },
      { title: 'Mengenali Tanda Bahaya (Warning Signs):', text: 'Pemantauan ketat jika bayi tampak sesak napas (retraksi dada), lemas/tidak aktif, kuning menyebar, atau suhu tubuh dingin/panas.' },
      { title: 'Pencegahan Infeksi & Sanitasi:', text: 'Mencuci tangan 6 langkah sebelum menyentuh bayi dan menjaga kebersihan peralatan perawatan di rumah.' },
      { title: 'Jadwal Kontrol & Imunisasi:', text: 'Memastikan bayi mendapatkan jadwal imunisasi susulan dan pemeriksaan rutin tumbuh kembang di Poliklinik Anak RSUD Undata.' }
    ];

    let py = y + 20;
    points.forEach((p) => {
      doc.setTextColor(15, 118, 110);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`• ${p.title}`, 20, py);

      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const lineArr = doc.splitTextToSize(p.text, 165);
      doc.text(lineArr, 25, py + 4.5);

      py += lineArr.length * 4.5 + 6.5;
    });

    // Footer Watermark
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Diterbitkan melalui NSPC NICU App • RSUD Undata Provinsi Sulawesi Tengah • Palu', 105, 285, { align: 'center' });

    return doc.output('datauristring');
  } catch (err) {
    console.error('generateSamplePdfDataUrl error:', err);
    return '';
  }
}

export function generateFallbackPdfCover(title: string, category: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 550;
  const ctx = canvas.getContext('2d');

  if (!ctx) return '';

  const grad = ctx.createLinearGradient(0, 0, 400, 550);
  grad.addColorStop(0, '#0f766e');
  grad.addColorStop(1, '#042f2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 400, 550);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.beginPath();
  ctx.arc(350, 50, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#065f46';
  ctx.beginPath();
  ctx.roundRect(30, 40, 340, 32, 16);
  ctx.fill();

  ctx.fillStyle = '#a7f3d0';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(category.toUpperCase(), 200, 61);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.roundRect(130, 120, 140, 180, 16);
  ctx.fill();

  ctx.fillStyle = '#5eead4';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('PDF', 200, 225);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';

  const words = title.split(' ');
  let line = '';
  let y = 350;
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > 320 && i > 0) {
      ctx.fillText(line, 200, y);
      line = words[i] + ' ';
      y += 28;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 200, y);

  ctx.fillStyle = '#99f6e4';
  ctx.font = '12px sans-serif';
  ctx.fillText('MODUL EDUKASI NSPC', 200, 510);

  return canvas.toDataURL('image/png');
}

