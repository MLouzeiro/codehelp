import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware/auth';
import multer from 'multer';
import {
  listLayouts, getLayout, createLayout, updateLayout, deleteLayout,
  setDefaultLayout, duplicateLayout, uploadTimbrado, deleteTimbrado, getDefaultLayoutHandler,
  uploadLogo, deleteLogo,
} from './os-layout.controller';

const router = Router();

// memoryStorage: arquivo fica em memória (req.file.buffer), sem escrever em disco.
// Resolve o problema de filesystem efêmero (Vercel) e arquivos órfãos.
const uploadTimbradoFile = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Apenas arquivos PDF são permitidos'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadLogoFile = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Apenas imagens PNG, JPEG ou WebP são permitidas'));
      return;
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.get('/default', authenticate, getDefaultLayoutHandler);
router.get('/', authenticate, listLayouts);
router.get('/:id', authenticate, getLayout);
router.post('/', authenticate, authorize('admin', 'gerente'), createLayout);
router.put('/:id', authenticate, authorize('admin', 'gerente'), updateLayout);
router.delete('/:id', authenticate, authorize('admin'), deleteLayout);
router.post('/:id/set-default', authenticate, authorize('admin', 'gerente'), setDefaultLayout);
router.post('/:id/duplicate', authenticate, authorize('admin', 'gerente'), duplicateLayout);
router.post('/:id/timbrado', authenticate, authorize('admin', 'gerente'), uploadTimbradoFile.single('file'), uploadTimbrado);
router.delete('/:id/timbrado', authenticate, authorize('admin', 'gerente'), deleteTimbrado);
router.post('/:id/logo', authenticate, authorize('admin', 'gerente'), uploadLogoFile.single('file'), uploadLogo);
router.delete('/:id/logo', authenticate, authorize('admin', 'gerente'), deleteLogo);

export default router;
