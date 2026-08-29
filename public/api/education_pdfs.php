<?php
/**
 * ============================================================================
 * ENDPOINT: /api/education_pdfs.php (GET, POST, OPTIONS)
 * ============================================================================
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

// GET EDUCATION PDFS
if ($method === 'GET') {
    try {
        $patientId = trim($_GET['patient_id'] ?? $_GET['patientId'] ?? '');
        $category  = trim($_GET['category'] ?? '');

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
        $items = $stmt->fetchAll();

        foreach ($items as &$item) {
            $item['is_active']   = (bool)$item['is_active'];
            $item['order_index'] = intval($item['order_index']);
            $item['page_count']  = intval($item['page_count']);
            
            // Format CamelCase Mapping
            $item['patientId']     = $item['patient_id'];
            $item['fileName']      = $item['file_name'];
            $item['fileSizeText']  = $item['file_size_text'];
            $item['fileDataUrl']   = $item['file_data_url'];
            $item['coverImageUrl'] = $item['cover_image_url'];
            $item['nakesNote']     = $item['nakes_note'];
            $item['publishedAt']   = $item['published_at'];
            $item['orderIndex']    = $item['order_index'];
            $item['isActive']      = (bool)$item['is_active'];
        }

        sendJsonResponse('success', 'Daftar modul edukasi berhasil diambil.', [
            'total' => count($items),
            'items' => $items,
            'pdfs'  => $items,
            'data'  => $items
        ]);
    } catch (PDOException $e) {
        sendJsonResponse('error', 'Gagal memuat modul edukasi: ' . $e->getMessage(), null, 200);
    }
}

// POST EDUCATION PDFS (Save / Delete / Reorder)
if ($method === 'POST') {
    $input = getJsonInputBody();
    if (empty($input)) $input = $_POST;

    $action = strtolower(trim($input['action'] ?? 'save'));

    if ($action === 'delete') {
        $pdfId = trim($input['id'] ?? $input['pdf_id'] ?? '');
        if (empty($pdfId)) sendJsonResponse('error', 'ID Modul Edukasi wajib diisi.', null, 400);
        try {
            $delStmt = $pdo->prepare("DELETE FROM education_pdfs WHERE id = :id");
            $delStmt->execute([':id' => $pdfId]);
            sendJsonResponse('success', 'Modul edukasi berhasil dihapus.', ['id' => $pdfId]);
        } catch (PDOException $e) {
            sendJsonResponse('error', 'Gagal menghapus modul edukasi: ' . $e->getMessage(), null, 200);
        }
    }

    if ($action === 'reorder') {
        $pdfs = $input['pdfs'] ?? [];
        if (!is_array($pdfs) || empty($pdfs)) sendJsonResponse('error', 'Daftar pdfs diperlukan.', null, 400);
        try {
            $stmt = $pdo->prepare("UPDATE education_pdfs SET order_index = :oindex, updated_at = NOW() WHERE id = :id");
            foreach ($pdfs as $idx => $item) {
                $id = trim($item['id'] ?? '');
                if (!empty($id)) {
                    $stmt->execute([':oindex' => intval($idx), ':id' => $id]);
                }
            }
            sendJsonResponse('success', 'Urutan modul edukasi berhasil diperbarui.', ['count' => count($pdfs)]);
        } catch (PDOException $e) {
            sendJsonResponse('error', 'Gagal memperbarui urutan modul: ' . $e->getMessage(), null, 200);
        }
    }

    // Save/Upload Modul
    $title        = trim($input['title'] ?? '');
    $category     = trim($input['category'] ?? 'EDUKASI');
    $nakesNote    = trim($input['nakes_note'] ?? $input['nakesNote'] ?? '');
    $patientId    = !empty($input['patient_id'] ?? $input['patientId']) ? trim($input['patient_id'] ?? $input['patientId']) : null;
    $pdfId        = !empty($input['id']) ? trim($input['id']) : ('pdf_' . time() . '_' . substr(md5(uniqid()), 0, 5));

    if (empty($title)) sendJsonResponse('error', 'Judul modul edukasi wajib diisi.', null, 400);

    $fileUrl      = $input['file_data_url'] ?? $input['fileDataUrl'] ?? null;
    $coverUrl     = $input['cover_image_url'] ?? $input['coverImageUrl'] ?? null;
    $fileName     = trim($input['file_name'] ?? $input['fileName'] ?? 'modul_edukasi.pdf');
    $fileSizeText = trim($input['file_size_text'] ?? $input['fileSizeText'] ?? '1.2 MB');
    $pageCount    = intval($input['page_count'] ?? $input['pageCount'] ?? 1);
    $publishedAt  = $input['published_at'] ?? $input['publishedAt'] ?? date('Y-m-d H:i');
    $orderIndex   = intval($input['order_index'] ?? $input['orderIndex'] ?? 0);
    $isActive     = isset($input['is_active']) ? ($input['is_active'] ? 1 : 0) : (isset($input['isActive']) ? ($input['isActive'] ? 1 : 0) : 1);

    try {
        $stmt = $pdo->prepare("
            INSERT INTO education_pdfs (
                id, patient_id, title, category, file_name, file_size_text,
                file_data_url, cover_image_url, page_count, nakes_note,
                published_at, is_active, order_index, created_at, updated_at
            ) VALUES (
                :id, :pid, :title, :category, :fname, :fsize,
                :furl, :curi, :pages, :note,
                :pub_at, :is_act, :oindex, NOW(), NOW()
            )
            ON DUPLICATE KEY UPDATE
                patient_id      = VALUES(patient_id),
                title           = VALUES(title),
                category        = VALUES(category),
                file_name       = VALUES(file_name),
                file_size_text  = VALUES(file_size_text),
                file_data_url   = COALESCE(VALUES(file_data_url), file_data_url),
                cover_image_url = COALESCE(VALUES(cover_image_url), cover_image_url),
                page_count      = VALUES(page_count),
                nakes_note      = VALUES(nakes_note),
                published_at    = VALUES(published_at),
                is_active       = VALUES(is_active),
                order_index     = VALUES(order_index),
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
            ':pages'    => $pageCount,
            ':note'     => $nakesNote,
            ':pub_at'   => $publishedAt,
            ':is_act'   => $isActive,
            ':oindex'   => $orderIndex
        ]);
        sendJsonResponse('success', "Modul edukasi '{$title}' berhasil disimpan.", ['id' => $pdfId]);
    } catch (PDOException $e) {
        sendJsonResponse('error', 'Gagal menyimpan modul edukasi: ' . $e->getMessage(), null, 200);
    }
}

sendJsonResponse('error', 'Metode HTTP tidak didukung.', null, 405);
