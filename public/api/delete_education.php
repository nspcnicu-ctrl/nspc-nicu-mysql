<?php
/**
 * ============================================================================
 * ENDPOINT: POST /api/delete_education.php
 * ============================================================================
 * Nakes menghapus materi modul edukasi PDF dari sistem dan database MySQL.
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse('error', 'Metode HTTP tidak diizinkan. Gunakan POST.', null, 405);
}

$input = getJsonInput();
$pdo = Database::getConnection();

$pdfId = sanitizeString($input['id'] ?? $input['pdf_id'] ?? '');

if (empty($pdfId)) {
    sendResponse('error', 'ID Modul Edukasi (id) wajib disertakan.', null, 400);
}

$stmt = $pdo->prepare("SELECT * FROM education_pdfs WHERE id = :id LIMIT 1");
$stmt->execute([':id' => $pdfId]);
$pdf = $stmt->fetch();

if (!$pdf) {
    sendResponse('error', 'Modul edukasi tidak ditemukan.', null, 404);
}

// 1. HAPUS FILE FISIK DI SERVER JIKA ADA
if (!empty($pdf['file_data_url']) && strpos($pdf['file_data_url'], '/uploads/pdfs/') !== false) {
    $fileName = basename($pdf['file_data_url']);
    $filePath = dirname(__DIR__) . '/uploads/pdfs/' . $fileName;
    if (file_exists($filePath)) {
        @unlink($filePath);
    }
}

if (!empty($pdf['cover_image_url']) && strpos($pdf['cover_image_url'], '/uploads/covers/') !== false) {
    $coverName = basename($pdf['cover_image_url']);
    $coverPath = dirname(__DIR__) . '/uploads/covers/' . $coverName;
    if (file_exists($coverPath)) {
        @unlink($coverPath);
    }
}

// 2. HAPUS RECORD DI DATABASE
$delStmt = $pdo->prepare("DELETE FROM education_pdfs WHERE id = :id");
$delStmt->execute([':id' => $pdfId]);

recordSystemEvent($pdo, 'EDUCATION_PDF_DELETED', $pdfId, ['title' => $pdf['title']]);

sendResponse('success', "Modul edukasi '{$pdf['title']}' berhasil dihapus secara permanen.", [
    'id'    => $pdfId,
    'title' => $pdf['title']
]);
