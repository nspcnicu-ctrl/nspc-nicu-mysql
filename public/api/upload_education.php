<?php
/**
 * ============================================================================
 * ENDPOINT: POST /api/upload_education.php
 * ============================================================================
 * Nakes mengunggah materi modul edukasi PDF digital baru untuk Orang Tua.
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse('error', 'Metode HTTP tidak diizinkan. Gunakan POST.', null, 405);
}

$input = getJsonInput();
$pdo = Database::getConnection();
$config = require __DIR__ . '/config/db_config.php';

$title     = sanitizeString($input['title'] ?? '');
$category  = sanitizeString($input['category'] ?? 'EDUKASI');
$nakesNote = trim($input['nakes_note'] ?? $input['nakesNote'] ?? '');
$patientId = !empty($input['patient_id']) ? sanitizeString($input['patient_id']) : null;
$pdfId     = $input['id'] ?? ('pdf_' . time() . '_' . substr(md5(uniqid()), 0, 4));

if (empty($title)) {
    sendResponse('error', 'Judul modul edukasi wajib diisi.', null, 400);
}

// Direktori penyimpanan file
$pdfDir = dirname(__DIR__) . '/uploads/pdfs/';
$coverDir = dirname(__DIR__) . '/uploads/covers/';
if (!is_dir($pdfDir)) mkdir($pdfDir, 0755, true);
if (!is_dir($coverDir)) mkdir($coverDir, 0755, true);

$fileUrl      = $input['file_data_url'] ?? $input['fileDataUrl'] ?? null;
$coverUrl     = $input['cover_image_url'] ?? $input['coverImageUrl'] ?? null;
$fileName     = sanitizeString($input['file_name'] ?? $input['fileName'] ?? 'modul_edukasi.pdf');
$fileSizeText = sanitizeString($input['file_size_text'] ?? $input['fileSizeText'] ?? '1.2 MB');

// 1. PROSES UPLOAD FILE PDF MULTIPART (JIKA ADA)
if (isset($_FILES['pdf_file']) && $_FILES['pdf_file']['error'] === UPLOAD_ERR_OK) {
    $uploadedFile = $_FILES['pdf_file'];
    $ext = strtolower(pathinfo($uploadedFile['name'], PATHINFO_EXTENSION));
    
    if ($ext !== 'pdf') {
        sendResponse('error', 'Berkas harus berupa format PDF.', null, 400);
    }
    
    $cleanName = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($uploadedFile['name'], PATHINFO_FILENAME));
    $savedFileName = time() . '_' . $cleanName . '.pdf';
    $dest = $pdfDir . $savedFileName;
    
    if (move_uploaded_file($uploadedFile['tmp_name'], $dest)) {
        $fileUrl = rtrim($config['base_url'], '/') . '/uploads/pdfs/' . $savedFileName;
        $fileName = $uploadedFile['name'];
        $bytes = filesize($dest);
        $fileSizeText = $bytes > 1048576 
            ? round($bytes / 1048576, 1) . ' MB' 
            : round($bytes / 1024, 0) . ' KB';
    }
}

// 2. PROSES UPLOAD COVER IMAGE MULTIPART (JIKA ADA)
if (isset($_FILES['cover_file']) && $_FILES['cover_file']['error'] === UPLOAD_ERR_OK) {
    $coverFile = $_FILES['cover_file'];
    $ext = strtolower(pathinfo($coverFile['name'], PATHINFO_EXTENSION));
    
    if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp'])) {
        $savedCoverName = 'cover_' . time() . '_' . substr(md5(uniqid()), 0, 6) . '.' . $ext;
        $destCover = $coverDir . $savedCoverName;
        if (move_uploaded_file($coverFile['tmp_name'], $destCover)) {
            $coverUrl = rtrim($config['base_url'], '/') . '/uploads/covers/' . $savedCoverName;
        }
    }
}

$publishedAt = $input['published_at'] ?? $input['publishedAt'] ?? date('c');

try {
    $stmt = $pdo->prepare("
        INSERT INTO education_pdfs (
            id, patient_id, title, category, file_name, file_size_text,
            file_data_url, cover_image_url, page_count, nakes_note,
            published_at, is_active, order_index, created_at, updated_at
        ) VALUES (
            :id, :pid, :title, :category, :fname, :fsize,
            :furl, :curi, :pages, :note,
            :pub_at, 1, :oindex, NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE
            title           = VALUES(title),
            category        = VALUES(category),
            file_name       = VALUES(file_name),
            file_size_text  = VALUES(file_size_text),
            file_data_url   = COALESCE(VALUES(file_data_url), file_data_url),
            cover_image_url = COALESCE(VALUES(cover_image_url), cover_image_url),
            nakes_note      = VALUES(nakes_note),
            updated_at      = NOW()
    ");

    $stmt->execute([
        ':id'       => $pdfId,
        ':pid'      => $patientId,
        ':title'    => $title,
        ':category' => $category,
        ':fname'    => $fileName,
        ':fsize'    => $fileSizeText,
        ':furl'     => $fileUrl,
        ':curi'     => $coverUrl,
        ':pages'    => intval($input['page_count'] ?? 1),
        ':note'     => $nakesNote,
        ':pub_at'   => $publishedAt,
        ':oindex'   => intval($input['order_index'] ?? $input['orderIndex'] ?? 0)
    ]);

    // Rekam event untuk real-time stream
    recordSystemEvent($pdo, 'EDUCATION_PDF_UPLOADED', $pdfId, [
        'title'    => $title,
        'category' => $category
    ]);

    sendResponse('success', "Modul edukasi '{$title}' berhasil disimpan!", [
        'id'             => $pdfId,
        'title'          => $title,
        'category'       => $category,
        'fileName'       => $fileName,
        'fileSizeText'   => $fileSizeText,
        'fileDataUrl'    => $fileUrl,
        'coverImageUrl'  => $coverUrl,
        'nakesNote'      => $nakesNote,
        'publishedAt'    => $publishedAt
    ], 201);

} catch (PDOException $e) {
    sendResponse('error', 'Gagal menyimpan modul edukasi ke database: ' . $e->getMessage(), null, 500);
}
