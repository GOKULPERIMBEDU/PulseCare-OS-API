import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller';
import { authenticate } from '../middleware/auth';
import { uploadDocument } from '../middleware/upload';
import { asyncHandler } from '../utils/asyncHandler';

const controller = new DocumentController();
const documentRouter = Router();

documentRouter.use(authenticate);
documentRouter.get('/', asyncHandler(controller.list));
documentRouter.post('/', uploadDocument.single('file'), asyncHandler(controller.upload));
documentRouter.get('/:id/download', asyncHandler(controller.download));

export { documentRouter };
