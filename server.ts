import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  initDbPool,
  getDbStatus,
  getAllPatients,
  upsertPatient,
  deletePatientById,
  restorePatientById,
  addOrUpdateDailyLog,
  deleteDailyLogById,
  getAllNakesUsers,
  upsertNakesUser,
  deleteNakesUserById,
  recordNakesLoginLog,
  getNakesLoginLogs,
  getAllEducationPdfs,
  upsertEducationPdf,
  deleteEducationPdfById,
  reorderEducationPdfs,
} from './src/server/db';
import { addSseClient, broadcastRealtimeEvent } from './src/server/sse';

dotenv.config();

const PORT = 3000;

interface RegisterRequestBody {
  name?: string;
  roleTitle?: string;
  accountType?: 'Admin' | 'Anggota Biasa';
  username?: string;
  pin?: string;
  currentNakesUser?: {
    accountType?: string;
    roleTitle?: string;
  };
}

/**
 * Middleware Otorisasi Hak Akses (RBAC Guard)
 * Memverifikasi bahwa pendaftar memiliki Tipe Akun / Title 'Admin'
 */
const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
  const body = req.body as RegisterRequestBody;

  const headerRole = req.headers['x-user-role'] || req.headers['x-account-type'];
  const userAccountType = body?.currentNakesUser?.accountType || body?.currentNakesUser?.roleTitle;

  const roleValue = Array.isArray(headerRole)
    ? headerRole[0]
    : String(headerRole || userAccountType || '');

  const isAdmin =
    roleValue.toLowerCase() === 'admin' ||
    roleValue.toLowerCase().includes('admin') ||
    roleValue === 'Ketua' ||
    roleValue === 'Kepala Ruangan';

  if (!isAdmin) {
    return res.status(403).json({
      status: 403,
      error: 'Akses Ditolak: Hanya pengguna dengan Tipe Akun "Admin" yang memiliki hak akses untuk mendaftarkan anggota baru.',
      allowed: false,
    });
  }

  next();
};

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Initialize MySQL Connection Pool
  await initDbPool();

  // ---------------------------------------------------------------------------
  // 1. HEALTH & DATABASE STATUS ENDPOINTS
  // ---------------------------------------------------------------------------
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      server: 'NSPC RSUD Undata Express Backend (MySQL + Real-Time SSE)',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/db/status', (req: Request, res: Response) => {
    res.json(getDbStatus());
  });

  // ---------------------------------------------------------------------------
  // 2. REAL-TIME SERVER-SENT EVENTS (SSE) ENDPOINT
  // ---------------------------------------------------------------------------
  app.get('/api/events', (req: Request, res: Response) => {
    addSseClient(res);
  });

  // ---------------------------------------------------------------------------
  // 3. PATIENTS CRUD API
  // ---------------------------------------------------------------------------
  app.get('/api/patients', async (req: Request, res: Response) => {
    try {
      const patients = await getAllPatients();
      res.json({ success: true, data: patients });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/patients', async (req: Request, res: Response) => {
    try {
      const patient = req.body;
      if (!patient || !patient.id || !patient.nickname) {
        return res.status(400).json({ success: false, error: 'Format data pasien tidak valid.' });
      }

      const saved = await upsertPatient(patient);
      broadcastRealtimeEvent('patient_created', saved);
      broadcastRealtimeEvent('data_changed', { type: 'patient', id: saved.id });
      res.status(201).json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/patients/bulk', async (req: Request, res: Response) => {
    try {
      const { patients } = req.body;
      if (!Array.isArray(patients)) {
        return res.status(400).json({ success: false, error: 'Array patients diperlukan.' });
      }

      for (const p of patients) {
        await upsertPatient(p);
      }

      broadcastRealtimeEvent('data_changed', { type: 'patients_bulk' });
      res.json({ success: true, count: patients.length });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/patients/:id', async (req: Request, res: Response) => {
    try {
      const patient = req.body;
      const { id } = req.params;
      patient.id = id;

      const updated = await upsertPatient(patient);
      broadcastRealtimeEvent('patient_updated', updated);
      broadcastRealtimeEvent('data_changed', { type: 'patient', id: updated.id });
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/patients/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const hard = req.query.hard === 'true';
      await deletePatientById(id, hard);

      broadcastRealtimeEvent('patient_deleted', { id, hard });
      broadcastRealtimeEvent('data_changed', { type: 'patient', id });
      res.json({ success: true, message: 'Pasien berhasil dihapus.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/patients/:id/restore', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await restorePatientById(id);

      broadcastRealtimeEvent('patient_restored', { id });
      broadcastRealtimeEvent('data_changed', { type: 'patient', id });
      res.json({ success: true, message: 'Pasien berhasil dipulihkan.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 4. DAILY LOGS CRUD API
  // ---------------------------------------------------------------------------
  app.post('/api/patients/:id/daily-logs', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const log = req.body;
      if (!log || !log.id) {
        return res.status(400).json({ success: false, error: 'Data daily log tidak valid.' });
      }

      const saved = await addOrUpdateDailyLog(id, log);
      broadcastRealtimeEvent('daily_log_added', { patientId: id, log: saved });
      broadcastRealtimeEvent('data_changed', { type: 'daily_log', patientId: id });
      res.status(201).json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/patients/:id/daily-logs/:logId', async (req: Request, res: Response) => {
    try {
      const { id, logId } = req.params;
      const log = req.body;
      log.id = logId;

      const saved = await addOrUpdateDailyLog(id, log);
      broadcastRealtimeEvent('daily_log_updated', { patientId: id, log: saved });
      broadcastRealtimeEvent('data_changed', { type: 'daily_log', patientId: id });
      res.json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/patients/:id/daily-logs/:logId', async (req: Request, res: Response) => {
    try {
      const { id, logId } = req.params;
      await deleteDailyLogById(id, logId);

      broadcastRealtimeEvent('daily_log_deleted', { patientId: id, logId });
      broadcastRealtimeEvent('data_changed', { type: 'daily_log', patientId: id });
      res.json({ success: true, message: 'Log harian berhasil dihapus.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 5. NAKES USERS & LOGIN LOGS API
  // ---------------------------------------------------------------------------
  app.get('/api/nakes', async (req: Request, res: Response) => {
    try {
      const users = await getAllNakesUsers();
      res.json({ success: true, data: users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/nakes', async (req: Request, res: Response) => {
    try {
      const user = req.body;
      if (!user || !user.id || !user.username) {
        return res.status(400).json({ success: false, error: 'Data nakes tidak valid.' });
      }

      const saved = await upsertNakesUser(user);
      broadcastRealtimeEvent('nakes_updated', saved);
      broadcastRealtimeEvent('data_changed', { type: 'nakes', id: saved.id });
      res.status(201).json({ success: true, data: saved });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/nakes/:id', async (req: Request, res: Response) => {
    try {
      const user = req.body;
      user.id = req.params.id;

      const updated = await upsertNakesUser(user);
      broadcastRealtimeEvent('nakes_updated', updated);
      broadcastRealtimeEvent('data_changed', { type: 'nakes', id: updated.id });
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/nakes/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await deleteNakesUserById(id);

      broadcastRealtimeEvent('nakes_deleted', { id });
      broadcastRealtimeEvent('data_changed', { type: 'nakes', id });
      res.json({ success: true, message: 'Akun nakes berhasil dihapus.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Nakes Registration with Admin Guard
  app.post('/api/nakes/register', authorizeAdmin, async (req: Request, res: Response) => {
    try {
      const { name, roleTitle, accountType, username, pin } = req.body as RegisterRequestBody;

      if (!name || !username || !pin) {
        return res.status(400).json({
          status: 400,
          error: 'Data tidak lengkap. Mohon isi Nama, Username, dan PIN.',
        });
      }

      const newMember = {
        id: 'nakes_' + Date.now(),
        name: name.trim(),
        roleTitle: roleTitle || 'Anggota',
        accountType: accountType || 'Anggota Biasa',
        username: username.trim(),
        pin: pin.trim(),
        createdAt: new Date().toISOString(),
        hasAccessRights: accountType === 'Admin',
        isSuperAdmin: false,
      };

      const saved = await upsertNakesUser(newMember);
      broadcastRealtimeEvent('nakes_updated', saved);
      broadcastRealtimeEvent('data_changed', { type: 'nakes', id: saved.id });

      return res.status(201).json({
        status: 201,
        message: `Pendaftaran berhasil. Akun ${saved.name} (${saved.accountType}) telah aktif.`,
        user: saved,
      });
    } catch (err: any) {
      res.status(500).json({ status: 500, error: err.message });
    }
  });

  // Nakes Login Verification & Recording to `nakes_login_logs`
  app.post('/api/nakes/login', async (req: Request, res: Response) => {
    try {
      const { username, pin, user } = req.body;
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string;
      const userAgent = req.headers['user-agent'] || '';

      let targetUser = user;
      if (!targetUser && username && pin) {
        const all = await getAllNakesUsers();
        targetUser = all.find(
          (u) =>
            u.username.trim().toLowerCase() === String(username).trim().toLowerCase() &&
            u.pin.trim() === String(pin).trim()
        );
      }

      if (!targetUser) {
        return res.status(401).json({ success: false, error: 'Username atau PIN salah.' });
      }

      await recordNakesLoginLog(targetUser, String(ip), userAgent);
      broadcastRealtimeEvent('nakes_logged_in', { userId: targetUser.id, name: targetUser.name });

      res.json({
        success: true,
        message: 'Login berhasil.',
        user: targetUser,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/nakes/login-logs', async (req: Request, res: Response) => {
    try {
      const logs = await getNakesLoginLogs(50);
      res.json({ success: true, data: logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 6. EDUCATION PDFS API
  // ---------------------------------------------------------------------------
  app.get(['/api/education-pdfs', '/api/education_pdfs.php'], async (req: Request, res: Response) => {
    try {
      const pdfs = await getAllEducationPdfs();
      res.json({ success: true, status: 'success', data: pdfs, items: pdfs });
    } catch (err: any) {
      res.status(200).json({ success: false, status: 'error', error: err.message, data: [] });
    }
  });

  app.post(['/api/education-pdfs', '/api/education_pdfs.php'], async (req: Request, res: Response) => {
    try {
      const input = req.body;
      const action = (input.action || 'save').toLowerCase();

      if (action === 'delete') {
        const id = input.id || input.pdf_id;
        if (id) await deleteEducationPdfById(id);
        broadcastRealtimeEvent('pdf_deleted', { id });
        broadcastRealtimeEvent('data_changed', { type: 'pdf', id });
        return res.json({ success: true, status: 'success', message: 'PDF berhasil dihapus' });
      }

      if (action === 'reorder') {
        if (Array.isArray(input.pdfs)) {
          await reorderEducationPdfs(input.pdfs);
          broadcastRealtimeEvent('pdf_reordered', { count: input.pdfs.length });
          broadcastRealtimeEvent('data_changed', { type: 'pdf_reordered' });
        }
        return res.json({ success: true, status: 'success', message: 'Urutan diperbarui' });
      }

      if (!input || !input.title) {
        return res.status(400).json({ success: false, status: 'error', error: 'Data PDF tidak lengkap.' });
      }

      const saved = await upsertEducationPdf(input);
      broadcastRealtimeEvent('pdf_updated', saved);
      broadcastRealtimeEvent('data_changed', { type: 'pdf', id: saved.id });
      res.status(200).json({ success: true, status: 'success', data: saved, item: saved });
    } catch (err: any) {
      res.status(200).json({ success: false, status: 'error', error: err.message });
    }
  });

  app.get('/api/daily_logs.php', async (req: Request, res: Response) => {
    try {
      const patientId = (req.query.patient_id || req.query.id) as string;
      const patients = await getAllPatients();
      if (patientId) {
        const p = patients.find((item) => item.id === patientId);
        const logs = p?.dailyLogs || [];
        return res.json({ status: 'success', total: logs.length, items: logs, logs });
      }
      const allLogs = patients.flatMap((p) => p.dailyLogs || []);
      res.json({ status: 'success', total: allLogs.length, items: allLogs, logs: allLogs });
    } catch (err: any) {
      res.status(200).json({ status: 'error', message: err.message, logs: [] });
    }
  });

  app.get('/api/nakes_login_logs.php', async (req: Request, res: Response) => {
    try {
      const logs = await getNakesLoginLogs(50);
      res.json({ status: 'success', total: logs.length, items: logs, logs });
    } catch (err: any) {
      res.status(200).json({ status: 'error', message: err.message, logs: [] });
    }
  });

  app.delete('/api/education-pdfs/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await deleteEducationPdfById(id);

      broadcastRealtimeEvent('pdf_deleted', { id });
      broadcastRealtimeEvent('data_changed', { type: 'pdf', id });
      res.json({ success: true, message: 'PDF edukasi berhasil dihapus.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/education-pdfs/reorder', async (req: Request, res: Response) => {
    try {
      const { pdfs } = req.body;
      if (!Array.isArray(pdfs)) {
        return res.status(400).json({ success: false, error: 'Array pdfs diperlukan.' });
      }

      await reorderEducationPdfs(pdfs);
      broadcastRealtimeEvent('pdf_reordered', { count: pdfs.length });
      broadcastRealtimeEvent('data_changed', { type: 'pdf_reordered' });
      res.json({ success: true, message: 'Urutan PDF berhasil diperbarui.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------------------------------------------------------------------
  // 7. GLOBAL ERROR HANDLING & VITE MIDDLEWARE
  // ---------------------------------------------------------------------------
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({
        status: 413,
        error: 'Ukuran data yang dikirim terlalu besar. Batas maksimal adalah 50MB.',
      });
    }
    if (err) {
      console.error('Server error:', err);
      return res.status(500).json({ status: 500, error: err.message || 'Internal Server Error' });
    }
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NSPC Backend] Server running on http://0.0.0.0:${PORT} (MySQL + Real-Time Sync Ready)`);
  });
}

startServer();
