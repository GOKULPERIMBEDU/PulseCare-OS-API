import { Request, Response } from 'express';
import { DocumentService } from '../services/document.service';
import { ok, getClientIp } from '../utils/helpers';
import { requireAuthUser } from '../middleware/auth';
import { AppError, DocumentCategory } from '../types';

const documentService = new DocumentService();

export class DocumentController {
  list = async (req: Request, res: Response): Promise<void> => {
    ok(
      res,
      await documentService.list(
        requireAuthUser(req),
        req.query.patientId ? String(req.query.patientId) : undefined,
      ),
    );
  };

  upload = async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new AppError('A file is required', 400);
    }
    const category = (req.body?.category as DocumentCategory) || 'other';
    ok(
      res,
      await documentService.create(
        requireAuthUser(req),
        req.file,
        {
          patientId: req.body?.patientId,
          appointmentId: req.body?.appointmentId,
          category,
        },
        getClientIp(req),
      ),
      201,
    );
  };

  download = async (req: Request, res: Response): Promise<void> => {
    const record = await documentService.getDownloadable(req.params.id, requireAuthUser(req));
    res.download(record.storagePath, record.originalName);
  };
}
