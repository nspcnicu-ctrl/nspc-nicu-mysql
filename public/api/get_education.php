<?php
/**
 * ============================================================================
 * ENDPOINT: GET /api/get_education.php
 * ============================================================================
 * Mengambil Daftar Materi Modul & File PDF Edukasi untuk Orang Tua dan Nakes.
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendResponse('error', 'Metode HTTP tidak diizinkan. Gunakan GET.', null, 405);
}

$pdo = Database::getConnection();

$patientId = sanitizeString($_GET['patient_id'] ?? '');
$category  = sanitizeString($_GET['category'] ?? '');

$sql = "SELECT id, patient_id, title, category, file_name, file_size_text,
               file_data_url, cover_image_url, page_count, nakes_note,
               published_at, is_active, order_index, created_at, updated_at
        FROM education_pdfs 
        WHERE is_active = 1 ";
$params = [];

if (!empty($patientId)) {
    $sql .= " AND (patient_id = :pid OR patient_id IS NULL) ";
    $params[':pid'] = $patientId;
}

if (!empty($category)) {
    $sql .= " AND category = :cat ";
    $params[':cat'] = $category;
}

$sql .= " ORDER BY order_index ASC, created_at DESC ";

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$items = $stmt->fetchAll();

foreach ($items as &$item) {
    $item['is_active']   = (bool)$item['is_active'];
    $item['order_index'] = intval($item['order_index']);
    $item['page_count']  = intval($item['page_count']);
    
    // Alias field camelCase untuk kemudahan integrasi dengan frontend React
    $item['fileName']      = $item['file_name'];
    $item['fileSizeText']  = $item['file_size_text'];
    $item['fileDataUrl']   = $item['file_data_url'];
    $item['coverImageUrl'] = $item['cover_image_url'];
    $item['nakesNote']     = $item['nakes_note'];
    $item['publishedAt']   = $item['published_at'];
    $item['orderIndex']    = $item['order_index'];
}

sendResponse('success', 'Daftar modul edukasi berhasil diambil.', [
    'total' => count($items),
    'items' => $items
]);
