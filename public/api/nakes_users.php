<?php
/**
 * File: api/nakes_users.php (GET, POST, OPTIONS)
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

try {
    $pdo = Database::getConnection();
} catch (Exception $e) {
    sendResponse('error', 'Gagal koneksi database: ' . $e->getMessage(), null, 200);
}

$method = $_SERVER['REQUEST_METHOD'];

// GET: Ambil data nakes
if ($method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM nakes_users ORDER BY created_at ASC");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($users as &$u) {
            $u['isSuperAdmin']    = (bool)($u['is_super_admin'] ?? false);
            $u['hasAccessRights'] = (bool)($u['has_access_rights'] ?? true);
            $u['roleTitle']       = $u['role_title'] ?? 'Tenaga Kesehatan';
            $u['accountType']     = $u['account_type'] ?? 'nakes';
        }
        sendResponse('success', 'Daftar nakes berhasil diambil', $users);
    } catch (Exception $e) {
        sendResponse('error', 'Gagal mengambil data: ' . $e->getMessage(), null, 200);
    }
}

// POST: Simpan atau hapus nakes
if ($method === 'POST') {
    $input  = getJsonInput();
    $action = strtolower(trim($input['action'] ?? 'save'));

    try {
        if ($action === 'delete') {
            $id = trim($input['id'] ?? '');
            if (!empty($id)) {
                $stmt = $pdo->prepare("DELETE FROM nakes_users WHERE id = :id");
                $stmt->execute([':id' => $id]);
                sendResponse('success', 'Nakes berhasil dihapus', ['id' => $id]);
            }
            sendResponse('error', 'ID tidak valid', null, 400);
        }

        $id              = !empty($input['id']) ? trim($input['id']) : ('nakes_' . time() . '_' . rand(10, 99));
        $name            = trim($input['name'] ?? 'Tenaga Kesehatan');
        $roleTitle       = trim($input['role_title'] ?? $input['roleTitle'] ?? $input['role'] ?? 'Tenaga Kesehatan');
        $accountType     = trim($input['account_type'] ?? $input['accountType'] ?? 'nakes');
        $username        = trim($input['username'] ?? strtolower(str_replace(' ', '', $name)));
        $pin             = trim($input['pin'] ?? '123456');
        $isSuperAdmin    = (!empty($input['is_super_admin']) || !empty($input['isSuperAdmin'])) ? 1 : 0;
        $hasAccessRights = (!empty($input['has_access_rights']) || !empty($input['hasAccessRights'])) ? 1 : 0;

        $sql = "INSERT INTO nakes_users (
                    id, name, role_title, account_type, username, pin, is_super_admin, has_access_rights, created_at, updated_at
                ) VALUES (
                    :id, :name, :role_title, :account_type, :username, :pin, :is_super_admin, :has_access_rights, NOW(), NOW()
                )
                ON DUPLICATE KEY UPDATE
                    name              = VALUES(name),
                    role_title        = VALUES(role_title),
                    account_type      = VALUES(account_type),
                    username          = VALUES(username),
                    pin               = VALUES(pin),
                    is_super_admin    = VALUES(is_super_admin),
                    has_access_rights = VALUES(has_access_rights),
                    updated_at        = NOW()";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id'                => $id,
            ':name'              => $name,
            ':role_title'        => $roleTitle,
            ':account_type'      => $accountType,
            ':username'          => $username,
            ':pin'               => $pin,
            ':is_super_admin'    => $isSuperAdmin,
            ':has_access_rights' => $hasAccessRights
        ]);

        sendResponse('success', 'Data nakes tersimpan di MySQL', ['id' => $id, 'name' => $name]);
    } catch (Exception $e) {
        sendResponse('error', 'MySQL Error Nakes: ' . $e->getMessage(), null, 200);
    }
}

sendResponse('error', 'Metode HTTP tidak didukung.', null, 405);
