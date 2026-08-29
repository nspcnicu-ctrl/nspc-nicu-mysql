<?php
/**
 * ============================================================================
 * ENDPOINT: GET /api/stream_updates.php
 * ============================================================================
 * Server-Sent Events (SSE) & Polling Feed untuk Sinkronisasi Real-Time Dua Arah.
 */

require_once __DIR__ . '/config/cors.php';
require_once __DIR__ . '/config/database.php';

$mode = $_GET['mode'] ?? 'stream';

// ----------------------------------------------------------------------------
// MODE 1: SIMPLE JSON POLLING CHECK (Jika browser/client tidak mendukung SSE)
// ----------------------------------------------------------------------------
if ($mode === 'poll') {
    $pdo = Database::getConnection();
    
    $stmtP = $pdo->query("SELECT MAX(updated_at) as last_patient_update, COUNT(*) as active_count FROM patients WHERE is_deleted = 0");
    $pInfo = $stmtP->fetch();

    $stmtL = $pdo->query("SELECT MAX(updated_at) as last_log_update FROM daily_logs");
    $lInfo = $stmtL->fetch();

    $stmtE = $pdo->query("SELECT MAX(updated_at) as last_edu_update FROM education_pdfs WHERE is_active = 1");
    $eInfo = $stmtE->fetch();

    $latestTimestamp = max(
        strtotime($pInfo['last_patient_update'] ?? '2020-01-01'),
        strtotime($lInfo['last_log_update'] ?? '2020-01-01'),
        strtotime($eInfo['last_edu_update'] ?? '2020-01-01')
    );

    sendResponse('success', 'Status sinkronisasi real-time.', [
        'latest_timestamp'   => $latestTimestamp,
        'latest_datetime'    => date('c', $latestTimestamp),
        'active_patients'    => intval($pInfo['active_count'] ?? 0),
        'server_time'        => time()
    ]);
}

// ----------------------------------------------------------------------------
// MODE 2: SERVER-SENT EVENTS (SSE) STREAM
// ----------------------------------------------------------------------------
// Matikan output buffering PHP agar data terkirim instan
if (ob_get_level()) ob_end_clean();

header("Content-Type: text/event-stream");
header("Cache-Control: no-cache, no-transform");
header("Connection: keep-alive");
header("X-Accel-Buffering: no"); // Nonaktifkan buffer Nginx/LiteSpeed

$pdo = Database::getConnection();
$lastCheckTime = time();

// Kirim event connected awal
echo "event: connected\n";
echo "data: " . json_encode(['status' => 'connected', 'server_time' => time(), 'message' => 'Terhubung ke Real-Time SSE NSPC RSUD Undata']) . "\n\n";
flush();

// Loop SSE selama maksimal 25 detik (menghindari timeout gateway hosting cPanel)
$startTime = time();
$maxExecution = 25;

while ((time() - $startTime) < $maxExecution) {
    if (connection_aborted()) {
        break;
    }

    try {
        // Cek apakah ada event sistem terbaru sejak pemeriksaan terakhir
        $stmtEvents = $pdo->prepare("
            SELECT id, event_type, reference_id, payload, created_at 
            FROM system_events 
            WHERE UNIX_TIMESTAMP(created_at) >= :last_time 
            ORDER BY created_at ASC
        ");
        $stmtEvents->execute([':last_time' => $lastCheckTime - 1]);
        $events = $stmtEvents->fetchAll();

        if (!empty($events)) {
            foreach ($events as $ev) {
                echo "event: {$ev['event_type']}\n";
                echo "data: " . json_encode([
                    'type'         => $ev['event_type'],
                    'reference_id' => $ev['reference_id'],
                    'payload'      => json_decode($ev['payload'] ?? 'null', true),
                    'timestamp'    => $ev['created_at']
                ]) . "\n\n";
                flush();
            }
            $lastCheckTime = time();
        } else {
            // Kirim heartbeat (ping) agar koneksi tetap hidup
            echo ": ping - " . time() . "\n\n";
            flush();
        }
    } catch (Exception $e) {
        // Abaikan error pada loop
    }

    // Tunggu 2 detik sebelum iterasi berikutnya
    sleep(2);
}

// Tutup stream secara halus agar client otomatis reconnect
echo "event: reconnect\n";
echo "data: " . json_encode(['status' => 'reconnect_requested']) . "\n\n";
flush();
