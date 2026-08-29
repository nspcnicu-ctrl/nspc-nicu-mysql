<?php
/**
 * ============================================================================
 * ENDPOINT: POST /api/login.php
 * ============================================================================
 * Menangani Otentikasi Login untuk Tenaga Kesehatan (Nakes) dan Orang Tua Pasien.
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse('error', 'Metode HTTP tidak diizinkan. Gunakan POST.', null, 405);
}

$input = getJsonInput();
$pdo = Database::getConnection();

$role     = trim($input['role'] ?? $input['user_type'] ?? '');
$username = trim($input['username'] ?? $input['nickname'] ?? '');
$password = trim($input['password'] ?? $input['pin'] ?? '');

if (empty($username) && empty($password)) {
    sendResponse('error', 'Username/Nama Panggilan dan Password/PIN wajib diisi.', null, 400);
}

// ----------------------------------------------------------------------------
// 1. OTENTIKASI NAKES / ADMIN
// ----------------------------------------------------------------------------
if ($role === 'nakes' || (!empty($input['username']) && !empty($input['pin'])) || empty($input['nickname'])) {
    $searchKey = !empty($input['username']) ? $input['username'] : $username;
    $pinInput  = !empty($input['pin']) ? $input['pin'] : $password;

    // Cari akun nakes berdasarkan username (case-insensitive)
    $stmt = $pdo->prepare("SELECT * FROM nakes_users WHERE LOWER(username) = LOWER(:username) LIMIT 1");
    $stmt->execute([':username' => $searchKey]);
    $nakes = $stmt->fetch();

    if ($nakes) {
        $storedPin = (string)$nakes['pin'];
        if (verifyPassword($pinInput, $storedPin) || $storedPin === $pinInput) {
            // Update last_login_at
            $updateStmt = $pdo->prepare("UPDATE nakes_users SET last_login_at = NOW() WHERE id = :id");
            $updateStmt->execute([':id' => $nakes['id']]);

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
                    ':rtitle'  => $nakes['role_title'],
                    ':atype'   => $nakes['account_type'],
                    ':ip'      => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
                    ':ua'      => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'
                ]);
            } catch (Exception $e) {
                // Jangan gagalkan login jika log error
            }

            // Sanitasi output nakes (sembunyikan PIN)
            unset($nakes['pin']);
            
            // Format boolean flags
            $nakes['has_access_rights'] = (bool)$nakes['has_access_rights'];
            $nakes['is_super_admin']    = (bool)$nakes['is_super_admin'];

            sendResponse('success', 'Login Tenaga Kesehatan berhasil!', [
                'user_type' => 'nakes',
                'user'      => $nakes,
                'token'     => base64_encode(json_encode(['id' => $nakes['id'], 'time' => time()]))
            ]);
        }
    }
}

// ----------------------------------------------------------------------------
// 2. OTENTIKASI ORANG TUA PASIEN (Berdasarkan Nickname & Password Bayi)
// ----------------------------------------------------------------------------
$nicknameInput = !empty($input['nickname']) ? $input['nickname'] : $username;
$passwordInput = !empty($input['password']) ? $input['password'] : $password;

$stmt = $pdo->prepare("
    SELECT * FROM patients 
    WHERE LOWER(nickname) = LOWER(:nickname) 
      AND is_deleted = 0 
    LIMIT 1
");
$stmt->execute([':nickname' => $nicknameInput]);
$patient = $stmt->fetch();

if ($patient) {
    $storedPass = (string)$patient['access_password'];
    
    if (verifyPassword($passwordInput, $storedPass) || $storedPass === $passwordInput) {
        // Decode JSON fields untuk format rapi di frontend
        $jsonFields = [
            'initial_anthropometry', 'current_equipment', 'registered_equipment',
            'milestones', 'immunization_discharge', 'discharge_summary'
        ];
        foreach ($jsonFields as $field) {
            if (!empty($patient[$field]) && is_string($patient[$field])) {
                $patient[$field] = json_decode($patient[$field], true);
            }
        }

        // Ambil riwayat log harian pasien
        $logStmt = $pdo->prepare("
            SELECT * FROM daily_logs 
            WHERE patient_id = :pid 
            ORDER BY log_date ASC, created_at ASC
        ");
        $logStmt->execute([':pid' => $patient['id']]);
        $dailyLogs = $logStmt->fetchAll();

        foreach ($dailyLogs as &$dlog) {
            foreach (['vital_signs', 'drinking_ability', 'active_equipment', 'milestones_list'] as $jf) {
                if (!empty($dlog[$jf]) && is_string($dlog[$jf])) {
                    $dlog[$jf] = json_decode($dlog[$jf], true);
                }
            }
        }
        $patient['daily_logs'] = $dailyLogs;

        sendResponse('success', 'Selamat datang! Login Orang Tua berhasil.', [
            'user_type' => 'parent',
            'patient'   => $patient,
            'token'     => base64_encode(json_encode(['patient_id' => $patient['id'], 'time' => time()]))
        ]);
    }
}

// Jika kredensial tidak cocok
sendResponse('error', 'Kredensial login tidak valid. Periksa kembali username/nama panggilan dan kata sandi/PIN Anda.', null, 401);
