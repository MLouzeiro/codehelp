import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../../shared/middleware/auth';
import { uploadAttachment, deleteAttachment } from './kanban.service';

const UPLOAD_DIR = path.resolve(__dirname, '../../../uploads/kanban');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const random = Math.random().toString(36).substring(2, 8);
    cb(null, `${req.params.taskId}_${Date.now()}_${random}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIMES.includes(file.mimetype) || !ALLOWED_EXTS.includes(ext)) {
    cb(new Error('Tipo de arquivo nao permitido. Envie apenas imagens (jpg, jpeg, png, gif, webp).'));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
});

const router = Router();
router.use(authenticate);

router.post('/tasks/:taskId/attachments', upload.array('files', MAX_FILES), async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const usuarioId = (req as any).user?.id;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const attachments = await uploadAttachment(taskId, files, usuarioId);
    return res.status(201).json(attachments);
  } catch (error: any) {
    console.error('Erro ao enviar anexo:', error);
    return res.status(500).json({ error: error.message || 'Erro ao enviar anexo' });
  }
});

router.delete('/attachments/:attachmentId', async (req: Request, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const usuarioId = (req as any).user?.id;
    await deleteAttachment(attachmentId, usuarioId);
    return res.status(204).send();
  } catch (error: any) {
    console.error('Erro ao deletar anexo:', error);
    return res.status(500).json({ error: error.message || 'Erro ao deletar anexo' });
  }
});

export default router;
