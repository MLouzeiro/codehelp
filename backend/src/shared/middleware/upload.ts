import multer from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';

const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];

const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.js', '.vbs', '.scr', '.ps1', '.sh', '.php', '.py'];

const MAX_SIZE = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../storage/uploads'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  const ext = path.extname(file.originalname).toLowerCase();

  if (BLOCKED_EXTENSIONS.includes(ext)) {
    cb(new Error(`Tipo de arquivo bloqueado: ${ext}`));
    return;
  }

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new Error(`Tipo de arquivo não permitido: ${ext}. Permitidos: ${ALLOWED_EXTENSIONS.join(', ')}`));
    return;
  }

  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    cb(new Error(`MIME type não permitido: ${file.mimetype}`));
    return;
  }

  cb(null, true);
}

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_SIZE,
  },
});

export function handleUploadError(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: `Arquivo excede o tamanho máximo de ${MAX_SIZE / 1024 / 1024}MB` });
      return;
    }
    res.status(400).json({ error: `Erro no upload: ${err.message}` });
    return;
  }
  if (err) {
    res.status(400).json({ error: err.message });
    return;
  }
  next();
}
