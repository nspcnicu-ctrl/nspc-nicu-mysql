<?php
ob_start();
error_reporting(0);
ini_set('display_errors', '0');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: {$origin}");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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

function verifyPasswordHelper($input, $stored) {
    if ($input === $stored) return true;
    if (password_verify($input, $stored)) return true;
    if (md5($input) === $stored) return true;
    return false;
}

function getLoginInput() {
    $raw = file_get_contents('php://input');
    if (!empty($raw)) {
        $data = json_decode($raw, true);
        if (is_array($data)) return $data;
    }
    return !empty($_POST) ? $_POST : [];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(405);
    echo json_encode([
        'status'    => 'error',
        'success'   => false,
        'message'   => 'Metode HTTP tidak diizinkan. Gunakan POST.',
        'data'      => null,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

$input = getLoginInput();

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

$role     = trim((string)($input['role'] ?? $input['user_type'] ?? ''));
$username = trim((string)($input['username'] ?? $input['nickname'] ?? ''));
$password = trim((string)($input['password'] ?? $input['pin'] ?? ''));

if (empty($username) && empty($password)) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    http_response_code(400);
    echo json_encode([
        'status'    => 'error',
        'success'   => false,
        'message'   => 'Username/Nama Panggilan dan Password/PIN wajib diisi.',
        'data'      => null,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

// ----------------------------------------------------------------------------
// 1. OTENTIKASI NAKES / ADMIN
// ----------------------------------------------------------------------------
if ($role === 'nakes' || (!empty($input['username']) && !empty($input['pin'])) || empty($input['nickname'])) {
    $searchKey = !empty($input['username']) ? $input['username'] : $username;
    $pinInput  = !empty($input['pin']) ? $input['pin'] : $password;

    try {
        $stmt = $pdo->prepare("SELECT * FROM nakes_users WHERE LOWER(username) = LOWER(:username) LIMIT 1");
        $stmt->execute([':username' => $searchKey]);
        $nakes = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($nakes) {
            $storedPin = (string)$nakes['pin'];
            if (verifyPasswordHelper($pinInput, $storedPin)) {
                // Update last_login_at
                try {
                    $updateStmt = $pdo->prepare("UPDATE nakes_users SET last_login_at = NOW() WHERE id = :id");
                    $updateStmt->execute([':id' => $nakes['id']]);
                } catch (Throwable $e) {}

                // Catat log audit login nakes
                try {
                    $logStmt = $pdo->prepare("
                        INSERT INTO nakes_login_logs (id, user_id, user_name, role_title, account_type, ip_address, user_agent, login_time)
                        VALUES (:id, :uid, :uname, :rtitle, :atype, :ip, :ua, NOW())
                    ");
                    $logStmt->execute([
                        ':id'      => 'log_' . uniqid(),
                        ':uid'     => $nakes['id'],
                        ':uname'   => $nakes['name'],
                        ':rtitle'  => $nakes['role_title'] ?? 'Tenaga Kesehatan',
                        ':atype'   => $nakes['account_type'] ?? 'nakes',
                        ':ip'      => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                        ':ua'      => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
                    ]);
                } catch (Throwable $e) {}

                unset($nakes['pin']);
                $nakes['has_access_rights'] = (bool)($nakes['has_access_rights'] ?? true);
                $nakes['is_super_admin']    = (bool)($nakes['is_super_admin'] ?? false);
                $nakes['roleTitle']         = $nakes['role_title'] ?? 'Tenaga Kesehatan';
                $nakes['accountType']       = $nakes['account_type'] ?? 'nakes';

                while (ob_get_level() > 0) {
                    ob_end_clean();
                }
                echo json_encode([
                    'status'    => 'success',
                    'success'   => true,
                    'message'   => 'Login Tenaga Kesehatan berhasil!',
                    'data'      => [
                        'user_type' => 'nakes',
                        'user'      => $nakes,
                        'token'     => base64_encode(json_encode(['id' => $nakes['id'], 'time' => time()]))
                    ],
                    'timestamp' => date('c')
                ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
                exit;
            }
        }
    } catch (Throwable $e) {}
}

// ----------------------------------------------------------------------------
// 2. OTENTIKASI ORANG TUA PASIEN (Berdasarkan Nickname & Password Bayi)
// ----------------------------------------------------------------------------
$nicknameInput = !empty($input['nickname']) ? $input['nickname'] : $username;
$passwordInput = !empty($input['password']) ? $input['password'] : $password;

try {
    $stmt = $pdo->prepare("
        SELECT * FROM patients 
        WHERE LOWER(nickname) = LOWER(:nickname) 
          AND (is_deleted = 0 OR is_deleted IS NULL)
        LIMIT 1
    ");
    $stmt->execute([':nickname' => $nicknameInput]);
    $patient = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($patient) {
        $storedPass = (string)$patient['access_password'];
        
        if (verifyPasswordHelper($passwordInput, $storedPass)) {
            // Decode JSON fields
            $jsonFields = ['initial_anthropometry', 'current_equipment', 'registered_equipment', 'milestones', 'immunization_discharge', 'discharge_summary', 'progress_logs', 'daily_logs'];
            foreach ($jsonFields as $field) {
                if (!empty($patient[$field]) && is_string($patient[$field])) {
                    $decoded = json_decode($patient[$field], true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        $patient[$field] = $decoded;
                    }
                }
            }

            unset($patient['access_password']);
            $patient['is_deleted'] = (bool)($patient['is_deleted'] ?? false);
            $patient['is_active']  = (bool)($patient['is_active'] ?? true);

            // CamelCase format
            $patient['babyName']    = $patient['baby_name'] ?? '';
            $patient['parentName']  = $patient['parent_name'] ?? '';
            $patient['parentPhone'] = $patient['parent_phone'] ?? '';

            while (ob_get_level() > 0) {
                ob_end_clean();
            }
            echo json_encode([
                'status'    => 'success',
                'success'   => true,
                'message'   => "Selamat datang orang tua dari {$patient['babyName']}!",
                'data'      => [
                    'user_type' => 'parent',
                    'patient'   => $patient,
                    'token'     => base64_encode(json_encode(['patient_id' => $patient['id'], 'time' => time()]))
                ],
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            exit;
        }
    }
} catch (Throwable $e) {}

while (ob_get_level() > 0) {
    ob_end_clean();
}
http_response_code(401);
echo json_encode([
    'status'    => 'error',
    'success'   => false,
    'message'   => 'Nama Panggilan/Username atau Password/PIN salah. Silakan periksa kembali.',
    'data'      => null,
    'timestamp' => date('c')
], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
exit;
