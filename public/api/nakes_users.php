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

// Helper get JSON Input
function getNakesJsonInput() {
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $data = json_decode($raw, true);
        if (is_array($data)) return $data;
    }
    return !empty($_POST) ? $_POST : [];
}

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

        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        echo json_encode([
            'status'    => 'success',
            'success'   => true,
            'message'   => 'Daftar nakes berhasil diambil',
            'data'      => $users,
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
            'message'   => 'Gagal mengambil data nakes: ' . $e->getMessage(),
            'data'      => null,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }
}

// POST: Simpan atau hapus nakes
if ($method === 'POST') {
    $input  = getNakesJsonInput();
    $action = strtolower(trim((string)($input['action'] ?? 'save')));

    try {
        if ($action === 'delete') {
            $id = trim((string)($input['id'] ?? ''));
            if (!empty($id)) {
                $stmt = $pdo->prepare("DELETE FROM nakes_users WHERE id = :id");
                $stmt->execute([':id' => $id]);

                while (ob_get_level() > 0) {
                    ob_end_clean();
                }
                echo json_encode([
                    'status'    => 'success',
                    'success'   => true,
                    'message'   => 'Nakes berhasil dihapus',
                    'data'      => ['id' => $id],
                    'timestamp' => date('c')
                ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
                exit;
            }
            
            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            http_response_code(400);
            echo json_encode([
                'status'    => 'error',
                'success'   => false,
                'message'   => 'ID tidak valid',
                'data'      => null,
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            exit;
        }

        $id              = !empty($input['id']) ? trim((string)$input['id']) : ('nakes_' . time() . '_' . rand(10, 99));
        $name            = trim((string)($input['name'] ?? 'Tenaga Kesehatan'));
        $roleTitle       = trim((string)($input['role_title'] ?? $input['roleTitle'] ?? $input['role'] ?? 'Tenaga Kesehatan'));
        $accountType     = trim((string)($input['account_type'] ?? $input['accountType'] ?? 'nakes'));
        $username        = trim((string)($input['username'] ?? strtolower(str_replace(' ', '', $name))));
        $pin             = trim((string)($input['pin'] ?? '123456'));
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

        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        echo json_encode([
            'status'    => 'success',
            'success'   => true,
            'message'   => 'Data nakes tersimpan di MySQL',
            'data'      => ['id' => $id, 'name' => $name],
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
            'message'   => 'MySQL Error Nakes: ' . $e->getMessage(),
            'data'      => null,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }
}

while (ob_get_level() > 0) {
    ob_end_clean();
}
http_response_code(405);
echo json_encode([
    'status'    => 'error',
    'success'   => false,
    'message'   => 'Metode HTTP tidak didukung.',
    'data'      => null,
    'timestamp' => date('c')
], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
exit;
