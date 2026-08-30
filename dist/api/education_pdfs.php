<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: {$origin}");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, X-Auth-Token');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(200);
    exit(0);
}

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config/database.php';

try {
    $pdo = Database::getConnection();
} catch (Throwable $e) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(200);
    echo json_encode([
        'status'    => 'error',
        'success'   => false,
        'message'   => 'Gagal koneksi database: ' . $e->getMessage(),
        'data'      => null,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

function getPdfJsonInput() {
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $data = json_decode($raw, true);
        if (is_array($data)) return $data;
    }
    return !empty($_POST) ? $_POST : [];
}

// -----------------------------------------------------------------------------
// 1. GET METHOD (Ambil Semua Modul Edukasi Aktif)
// -----------------------------------------------------------------------------
if ($method === 'GET') {
    try {
        $patientId = trim((string)($_GET['patient_id'] ?? $_GET['patientId'] ?? ''));
        $category  = trim((string)($_GET['category'] ?? ''));

        $sql = "SELECT id, patient_id, title, category, file_name, file_size_text,
                       file_data_url, cover_image_url, page_count, nakes_note,
                       published_at, is_active, order_index, created_at, updated_at
                FROM education_pdfs 
                WHERE is_active = 1 ";
        $params = [];
        if (!empty($patientId)) {
            $sql .= " AND (patient_id = :pid OR patient_id IS NULL OR patient_id = '') ";
            $params[':pid'] = $patientId;
        }
        if (!empty($category) && $category !== 'Semua') {
            $sql .= " AND category = :cat ";
            $params[':cat'] = $category;
        }
        $sql .= " ORDER BY order_index ASC, created_at DESC ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as &$item) {
            $item['is_active']   = (bool)($item['is_active'] ?? true);
            $item['order_index'] = intval($item['order_index'] ?? 0);
            $item['page_count']  = intval($item['page_count'] ?? 1);
            
            // Format CamelCase Mapping
            $item['patientId']     = $item['patient_id'] ?? null;
            $item['fileName']      = $item['file_name'] ?? '';
            $item['fileSizeText']  = $item['file_size_text'] ?? '1 MB';
            $item['fileDataUrl']   = $item['file_data_url'] ?? '';
            $item['coverImageUrl'] = $item['cover_image_url'] ?? null;
            $item['nakesNote']     = $item['nakes_note'] ?? '';
            $item['publishedAt']   = $item['published_at'] ?? ($item['created_at'] ?? date('Y-m-d'));
            $item['orderIndex']    = $item['order_index'];
            $item['isActive']      = (bool)$item['is_active'];
        }

        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        echo json_encode([
            'status'    => 'success',
            'success'   => true,
            'message'   => 'Daftar modul edukasi berhasil diambil.',
            'data'      => [
                'total' => count($items),
                'items' => $items,
                'pdfs'  => $items,
                'data'  => $items
            ],
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    } catch (Throwable $e) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        echo json_encode([
            'status'    => 'error',
            'success'   => false,
            'message'   => 'Gagal memuat modul edukasi: ' . $e->getMessage(),
            'data'      => null,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }
}

// -----------------------------------------------------------------------------
// 2. POST METHOD (Tambah Data Baru / Fallback Delete & Reorder)
// -----------------------------------------------------------------------------
if ($method === 'POST') {
    $input = getPdfJsonInput();
    $action = strtolower(trim((string)($input['action'] ?? 'save')));

    // Fallback: POST Delete Action
    if ($action === 'delete') {
        $pdfId = trim((string)($input['id'] ?? $input['pdf_id'] ?? $_GET['id'] ?? ''));
        if (empty($pdfId)) {
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            http_response_code(400);
            echo json_encode([
                'status'    => 'error',
                'success'   => false,
                'message'   => 'ID Modul Edukasi wajib diisi.',
                'data'      => null,
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            exit;
        }

        try {
            // Soft delete or delete
            $stmt = $pdo->prepare("UPDATE education_pdfs SET is_active = 0, updated_at = NOW() WHERE id = :id");
            $stmt->execute([':id' => $pdfId]);

            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            echo json_encode([
                'status'    => 'success',
                'success'   => true,
                'message'   => 'Modul edukasi berhasil dihapus.',
                'data'      => ['id' => $pdfId],
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            exit;
        } catch (Throwable $e) {
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            echo json_encode([
                'status'    => 'error',
                'success'   => false,
                'message'   => 'Gagal menghapus modul edukasi: ' . $e->getMessage(),
                'data'      => null,
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            exit;
        }
    }

    // Fallback: POST Reorder Action
    if ($action === 'reorder') {
        $pdfs = $input['pdfs'] ?? [];
        if (!is_array($pdfs) || empty($pdfs)) {
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            http_response_code(400);
            echo json_encode([
                'status'    => 'error',
                'success'   => false,
                'message'   => 'Daftar pdfs diperlukan.',
                'data'      => null,
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            exit;
        }

        try {
            $stmt = $pdo->prepare("UPDATE education_pdfs SET order_index = :oindex, updated_at = NOW() WHERE id = :id");
            foreach ($pdfs as $idx => $item) {
                $id = trim((string)($item['id'] ?? ''));
                if (!empty($id)) {
                    $stmt->execute([':oindex' => intval($idx), ':id' => $id]);
                }
            }
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            echo json_encode([
                'status'    => 'success',
                'success'   => true,
                'message'   => 'Urutan modul edukasi berhasil diperbarui.',
                'data'      => ['count' => count($pdfs)],
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            exit;
        } catch (Throwable $e) {
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            echo json_encode([
                'status'    => 'error',
                'success'   => false,
                'message'   => 'Gagal memperbarui urutan modul: ' . $e->getMessage(),
                'data'      => null,
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            exit;
        }
    }

    // Tambah Data Baru (INSERT INTO education_pdfs)
    $id = trim((string)($input['id'] ?? $input['pdf_id'] ?? ('pdf_' . time() . '_' . rand(100, 999))));
    $title = trim((string)($input['title'] ?? ''));
    $category = trim((string)($input['category'] ?? 'Bayi BBLR & Prematur'));
    $patientId = trim((string)($input['patient_id'] ?? $input['patientId'] ?? ''));
    $fileName = trim((string)($input['file_name'] ?? $input['fileName'] ?? ''));
    $fileSizeText = trim((string)($input['file_size_text'] ?? $input['fileSizeText'] ?? 'Direct Link'));
    $fileDataUrl = trim((string)($input['file_data_url'] ?? $input['fileDataUrl'] ?? $input['file_url'] ?? $input['fileUrl'] ?? ''));
    $coverImageUrl = trim((string)($input['cover_image_url'] ?? $input['coverImageUrl'] ?? $input['thumbnail_url'] ?? $input['thumbnailUrl'] ?? ''));
    if (empty($coverImageUrl)) {
        $coverImageUrl = null;
    }
    if (empty($fileName)) {
        $fileName = !empty($title) ? ($title . '.pdf') : 'dokumen.pdf';
    }
    $pageCount = intval($input['page_count'] ?? $input['pageCount'] ?? 1);
    $nakesNote = trim((string)($input['nakes_note'] ?? $input['nakesNote'] ?? ''));
    $publishedAt = trim((string)($input['published_at'] ?? $input['publishedAt'] ?? date('Y-m-d')));
    $isActive = (isset($input['is_active']) && ($input['is_active'] === 0 || $input['is_active'] === '0' || $input['is_active'] === false)) ? 0 : 1;

    if (empty($title) || empty($fileDataUrl)) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        http_response_code(400);
        echo json_encode([
            'status'    => 'error',
            'success'   => false,
            'message'   => 'Judul dan URL Berkas PDF wajib diisi.',
            'data'      => null,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    try {
        // Hitung order_index otomatis (posisi paling akhir/paling bawah) jika tidak disediakan
        if (isset($input['order_index']) || isset($input['orderIndex'])) {
            $orderIndex = intval($input['order_index'] ?? $input['orderIndex']);
        } else {
            $orderStmt = $pdo->query("SELECT COALESCE(MAX(order_index), -1) + 1 AS next_order FROM education_pdfs WHERE is_active = 1");
            $orderRow = $orderStmt->fetch(PDO::FETCH_ASSOC);
            $orderIndex = intval($orderRow['next_order'] ?? 0);
        }

        $sql = "INSERT INTO education_pdfs (
                    id, patient_id, title, category, file_name, file_size_text,
                    file_data_url, cover_image_url, page_count, nakes_note,
                    published_at, is_active, order_index, created_at, updated_at
                ) VALUES (
                    :id, :pid, :title, :category, :fname, :fsize,
                    :fdata, :cover, :pcount, :note,
                    :pubdate, :active, :oindex, NOW(), NOW()
                )
                ON DUPLICATE KEY UPDATE
                    patient_id      = VALUES(patient_id),
                    title           = VALUES(title),
                    category        = VALUES(category),
                    file_name       = VALUES(file_name),
                    file_size_text  = VALUES(file_size_text),
                    file_data_url   = VALUES(file_data_url),
                    cover_image_url = VALUES(cover_image_url),
                    page_count      = VALUES(page_count),
                    nakes_note      = VALUES(nakes_note),
                    published_at    = VALUES(published_at),
                    is_active       = VALUES(is_active),
                    order_index     = VALUES(order_index),
                    updated_at      = NOW()";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id'       => $id,
            ':pid'      => !empty($patientId) ? $patientId : null,
            ':title'    => $title,
            ':category' => $category,
            ':fname'    => $fileName,
            ':fsize'    => $fileSizeText,
            ':fdata'    => $fileDataUrl,
            ':cover'    => $coverImageUrl,
            ':pcount'   => $pageCount,
            ':note'     => $nakesNote,
            ':pubdate'  => $publishedAt,
            ':active'   => $isActive,
            ':oindex'   => $orderIndex
        ]);

        $createdItem = [
            'id'            => $id,
            'patient_id'    => !empty($patientId) ? $patientId : null,
            'patientId'     => !empty($patientId) ? $patientId : null,
            'title'         => $title,
            'category'      => $category,
            'file_name'     => $fileName,
            'fileName'      => $fileName,
            'file_size_text'=> $fileSizeText,
            'fileSizeText'  => $fileSizeText,
            'file_data_url' => $fileDataUrl,
            'fileDataUrl'   => $fileDataUrl,
            'cover_image_url' => $coverImageUrl,
            'coverImageUrl' => $coverImageUrl,
            'page_count'    => $pageCount,
            'pageCount'     => $pageCount,
            'nakes_note'    => $nakesNote,
            'nakesNote'     => $nakesNote,
            'published_at'  => $publishedAt,
            'publishedAt'   => $publishedAt,
            'is_active'     => (bool)$isActive,
            'isActive'      => (bool)$isActive,
            'order_index'   => $orderIndex,
            'orderIndex'    => $orderIndex,
        ];

        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        echo json_encode([
            'status'    => 'success',
            'success'   => true,
            'message'   => 'Modul edukasi berhasil disimpan ke database.',
            'data'      => $createdItem,
            'item'      => $createdItem,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    } catch (Throwable $e) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        echo json_encode([
            'status'    => 'error',
            'success'   => false,
            'message'   => 'Gagal menyimpan modul edukasi: ' . $e->getMessage(),
            'data'      => null,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }
}

// -----------------------------------------------------------------------------
// 3. PUT METHOD (Edit Konten / Update Posisi & Urutan)
// -----------------------------------------------------------------------------
if ($method === 'PUT') {
    $input = getPdfJsonInput();
    $id = trim((string)($input['id'] ?? $input['pdf_id'] ?? $_GET['id'] ?? ''));

    if (empty($id)) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        http_response_code(400);
        echo json_encode([
            'status'    => 'error',
            'success'   => false,
            'message'   => 'ID Modul Edukasi wajib disertakan untuk pembaruan (PUT).',
            'data'      => null,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    try {
        // Cek apakah request khusus untuk update order_index
        if (isset($input['order_index']) || isset($input['orderIndex']) || ($input['action'] ?? '') === 'reorder_single') {
            $newOrder = intval($input['order_index'] ?? $input['orderIndex'] ?? 0);
            $stmt = $pdo->prepare("UPDATE education_pdfs SET order_index = :oindex, updated_at = NOW() WHERE id = :id");
            $stmt->execute([':oindex' => $newOrder, ':id' => $id]);

            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            echo json_encode([
                'status'    => 'success',
                'success'   => true,
                'message'   => 'Posisi urutan modul edukasi berhasil diperbarui.',
                'data'      => ['id' => $id, 'order_index' => $newOrder, 'orderIndex' => $newOrder],
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            exit;
        }

        // Ambil data eksisting
        $checkStmt = $pdo->prepare("SELECT * FROM education_pdfs WHERE id = :id");
        $checkStmt->execute([':id' => $id]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            http_response_code(404);
            echo json_encode([
                'status'    => 'error',
                'success'   => false,
                'message'   => "Modul edukasi dengan ID '{$id}' tidak ditemukan.",
                'data'      => null,
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            exit;
        }

        // Ambil field baru atau gunakan nilai lama
        $title = isset($input['title']) ? trim((string)$input['title']) : $existing['title'];
        $category = isset($input['category']) ? trim((string)$input['category']) : $existing['category'];
        $fileDataUrl = isset($input['file_data_url']) || isset($input['fileDataUrl']) || isset($input['file_url'])
            ? trim((string)($input['file_data_url'] ?? $input['fileDataUrl'] ?? $input['file_url']))
            : $existing['file_data_url'];
        
        $coverImageUrl = isset($input['cover_image_url']) || isset($input['coverImageUrl']) || isset($input['thumbnail_url'])
            ? trim((string)($input['cover_image_url'] ?? $input['coverImageUrl'] ?? $input['thumbnail_url']))
            : $existing['cover_image_url'];
        
        $nakesNote = isset($input['nakes_note']) || isset($input['nakesNote'])
            ? trim((string)($input['nakes_note'] ?? $input['nakesNote']))
            : $existing['nakes_note'];

        $fileName = isset($input['file_name']) || isset($input['fileName'])
            ? trim((string)($input['file_name'] ?? $input['fileName']))
            : ($title ? ($title . '.pdf') : $existing['file_name']);

        $fileSizeText = isset($input['file_size_text']) || isset($input['fileSizeText'])
            ? trim((string)($input['file_size_text'] ?? $input['fileSizeText']))
            : $existing['file_size_text'];

        $sql = "UPDATE education_pdfs 
                SET title = :title,
                    category = :cat,
                    file_name = :fname,
                    file_size_text = :fsize,
                    file_data_url = :fdata,
                    cover_image_url = :cover,
                    nakes_note = :note,
                    updated_at = NOW()
                WHERE id = :id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':title' => $title,
            ':cat'   => $category,
            ':fname' => $fileName,
            ':fsize' => $fileSizeText,
            ':fdata' => $fileDataUrl,
            ':cover' => !empty($coverImageUrl) ? $coverImageUrl : null,
            ':note'  => $nakesNote,
            ':id'    => $id
        ]);

        $updatedItem = [
            'id'            => $id,
            'patient_id'    => $existing['patient_id'],
            'patientId'     => $existing['patient_id'],
            'title'         => $title,
            'category'      => $category,
            'file_name'     => $fileName,
            'fileName'      => $fileName,
            'file_size_text'=> $fileSizeText,
            'fileSizeText'  => $fileSizeText,
            'file_data_url' => $fileDataUrl,
            'fileDataUrl'   => $fileDataUrl,
            'cover_image_url' => !empty($coverImageUrl) ? $coverImageUrl : null,
            'coverImageUrl' => !empty($coverImageUrl) ? $coverImageUrl : null,
            'page_count'    => intval($existing['page_count'] ?? 1),
            'pageCount'     => intval($existing['page_count'] ?? 1),
            'nakes_note'    => $nakesNote,
            'nakesNote'     => $nakesNote,
            'published_at'  => $existing['published_at'],
            'publishedAt'   => $existing['published_at'],
            'is_active'     => (bool)$existing['is_active'],
            'isActive'      => (bool)$existing['is_active'],
            'order_index'   => intval($existing['order_index'] ?? 0),
            'orderIndex'    => intval($existing['order_index'] ?? 0),
        ];

        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        echo json_encode([
            'status'    => 'success',
            'success'   => true,
            'message'   => 'Data modul edukasi berhasil diperbarui.',
            'data'      => $updatedItem,
            'item'      => $updatedItem,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    } catch (Throwable $e) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        echo json_encode([
            'status'    => 'error',
            'success'   => false,
            'message'   => 'Gagal memperbarui modul edukasi: ' . $e->getMessage(),
            'data'      => null,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }
}

// -----------------------------------------------------------------------------
// 4. DELETE METHOD (Hapus Data / Soft Delete)
// -----------------------------------------------------------------------------
if ($method === 'DELETE') {
    $input = getPdfJsonInput();
    $id = trim((string)($_GET['id'] ?? $input['id'] ?? $input['pdf_id'] ?? ''));

    if (empty($id)) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        http_response_code(400);
        echo json_encode([
            'status'    => 'error',
            'success'   => false,
            'message'   => 'Parameter ID wajib disertakan untuk penghapusan (DELETE).',
            'data'      => null,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    try {
        // Soft delete dengan is_active = 0
        $stmt = $pdo->prepare("UPDATE education_pdfs SET is_active = 0, updated_at = NOW() WHERE id = :id");
        $stmt->execute([':id' => $id]);

        // Juga support penghapusan permanen jika hard=1 disertakan
        if (isset($_GET['hard']) && ($_GET['hard'] === '1' || $_GET['hard'] === 'true')) {
            $delStmt = $pdo->prepare("DELETE FROM education_pdfs WHERE id = :id");
            $delStmt->execute([':id' => $id]);
        }

        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        echo json_encode([
            'status'    => 'success',
            'success'   => true,
            'message'   => 'Modul edukasi berhasil dihapus.',
            'data'      => ['id' => $id],
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    } catch (Throwable $e) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        echo json_encode([
            'status'    => 'error',
            'success'   => false,
            'message'   => 'Gagal menghapus modul edukasi: ' . $e->getMessage(),
            'data'      => null,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }
}

// -----------------------------------------------------------------------------
// Method Not Allowed
// -----------------------------------------------------------------------------
while (ob_get_level() > 0) {
    ob_end_clean();
}
http_response_code(405);
echo json_encode([
    'status'    => 'error',
    'success'   => false,
    'message'   => 'Metode HTTP tidak didukung. Gunakan GET, POST, PUT, atau DELETE.',
    'data'      => null,
    'timestamp' => date('c')
], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
exit;
