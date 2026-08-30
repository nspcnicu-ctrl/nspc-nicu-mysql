import { EducationPdfItem } from '../types';
import { getPdfDataUrlSync, getPdfDataUrl, triggerPdfDownload } from '../services/pdfStore';
import { generateSamplePdfDataUrl, isGoogleDriveUrl, getGoogleDriveDirectDownloadUrl } from '../services/pdfRender';

export async function downloadEducationPdf(pdf: EducationPdfItem) {
  let fileUrl = pdf.fileDataUrl || (pdf as any).fileUrl || getPdfDataUrlSync(pdf.id);

  if (!fileUrl || fileUrl === '#') {
    fileUrl = await getPdfDataUrl(pdf.id);
  }

  const cleanTitle = (pdf.title || 'Dokumen_Edukasi').replace(/\s+/g, '_');
  let fileName = pdf.fileName || `${cleanTitle}.pdf`;
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    fileName = `${fileName}.pdf`;
  }

  // 1. Google Drive direct download link
  if (fileUrl && isGoogleDriveUrl(fileUrl)) {
    const directDownloadUrl = getGoogleDriveDirectDownloadUrl(fileUrl);
    const link = document.createElement('a');
    link.href = directDownloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // 2. Handle HTTP / HTTPS cross-origin or local cPanel storage URLs
  if (fileUrl && fileUrl.startsWith('http')) {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return;
    } catch (e) {
      console.warn('Direct fetch download fallback to anchor click:', e);
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
  }

  // 3. If no PDF data URL is found or if it's an image, generate a clean PDF document
  if (!fileUrl || fileUrl === '#' || fileUrl.startsWith('data:image/')) {
    fileUrl = generateSamplePdfDataUrl(
      pdf.title || 'Dokumen Edukasi NICU',
      pdf.category || 'EDUKASI',
      pdf.nakesNote || (pdf as any).nakesNotes
    );
  }

  // 4. Trigger download via Blob Object URL
  triggerPdfDownload(fileUrl, fileName);
}


