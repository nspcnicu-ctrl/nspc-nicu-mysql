import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/**
 * Renders Page 1 of a PDF file to a base64 PNG data URL using PDF.js canvas rendering.
 */
export async function renderPdfFirstPageToImage(pdfDataUrlOrBlob: string | Blob | ArrayBuffer): Promise<{ coverUrl: string; numPages: number }> {
  try {
    let uint8Data: Uint8Array | null = null;
    let urlStr: string | null = null;

    if (pdfDataUrlOrBlob instanceof Blob) {
      const buffer = await pdfDataUrlOrBlob.arrayBuffer();
      uint8Data = new Uint8Array(buffer);
    } else if (pdfDataUrlOrBlob instanceof ArrayBuffer) {
      uint8Data = new Uint8Array(pdfDataUrlOrBlob);
    } else if (typeof pdfDataUrlOrBlob === 'string') {
      if (pdfDataUrlOrBlob.startsWith('data:')) {
        const parts = pdfDataUrlOrBlob.split(',');
        const base64 = parts[1] || '';
        const binaryStr = atob(base64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        uint8Data = bytes;
      } else {
        urlStr = pdfDataUrlOrBlob;
      }
    }

    let loadingTask;
    if (uint8Data) {
      loadingTask = pdfjsLib.getDocument({ data: uint8Data });
    } else if (urlStr) {
      loadingTask = pdfjsLib.getDocument({ url: urlStr });
    } else {
      throw new Error('Invalid PDF data source');
    }

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const page = await pdfDoc.getPage(1);
    const scale = 2.0; // High resolution for crisp thumbnail
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      } as any).promise;

      const coverUrl = canvas.toDataURL('image/png');
      return { coverUrl, numPages };
    }
  } catch (error) {
    console.warn('Could not render PDF first page with pdfjs:', error);
  }

  return { coverUrl: '', numPages: 1 };
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

