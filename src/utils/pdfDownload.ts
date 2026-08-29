import { EducationPdfItem } from '../types';
import { getPdfDataUrlSync, getPdfDataUrl, triggerPdfDownload } from '../services/pdfStore';
import { generateSamplePdfDataUrl } from '../services/pdfRender';

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

  // Handle HTTP / HTTPS cross-origin storage URLs (e.g., Supabase)
  if (fileUrl && fileUrl.startsWith('http')) {
    try {
      const response = await fetch(fileUrl);
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
      console.warn('Direct fetch download failed, opening link in new tab:', e);
      window.open(fileUrl, '_blank');
      return;
    }
  }

  // If no PDF data URL is found or if it's an image, generate a clean PDF document
  if (!fileUrl || fileUrl === '#' || fileUrl.startsWith('data:image/')) {
    fileUrl = generateSamplePdfDataUrl(
      pdf.title || 'Dokumen Edukasi NICU',
      pdf.category || 'EDUKASI',
      pdf.nakesNote || (pdf as any).nakesNotes
    );
  }

  // Trigger download via Blob Object URL
  triggerPdfDownload(fileUrl, fileName);
}


