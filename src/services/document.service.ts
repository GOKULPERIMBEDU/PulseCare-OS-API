import { AppError, AuthUser, DocumentCategory } from '../types';
import { DocumentRepository } from '../repositories/document.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { writeAuditLog } from '../utils/audit';
import path from 'path';
import { env } from '../config/env';
import { assertHospitalScope, tenantFilter } from '../utils/tenant';

const documentRepository = new DocumentRepository();
const patientRepository = new PatientRepository();

export class DocumentService {
  async list(authUser: AuthUser, patientId?: string) {
    const filter: Record<string, unknown> = { ...tenantFilter(authUser) };
    if (authUser.role === 'PATIENT') {
      const patient = await patientRepository.findByUserId(authUser.id);
      if (!patient) return [];
      filter.patientId = patient._id;
    } else if (patientId) {
      filter.patientId = patientId;
    }
    return documentRepository.list(filter);
  }

  async create(
    authUser: AuthUser,
    file: Express.Multer.File,
    input: { patientId?: string; appointmentId?: string; category: DocumentCategory },
    ipAddress?: string,
  ) {
    const patientId = await this.resolvePatientId(input.patientId, authUser);
    const record = await documentRepository.create({
      hospitalId: authUser.hospitalId as never,
      patientId: patientId as never,
      uploadedBy: authUser.id as never,
      appointmentId: input.appointmentId as never,
      category: input.category,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      storagePath: file.path,
    });

    await writeAuditLog({
      hospitalId: authUser.hospitalId,
      userId: authUser.id,
      role: authUser.role,
      actionType: 'DOCUMENT_UPLOAD',
      resource: 'MedicalDocument',
      resourceId: String(record._id),
      metadata: { category: input.category, originalName: file.originalname },
      ipAddress,
    });

    return record;
  }

  async getDownloadable(id: string, authUser: AuthUser) {
    const record = await documentRepository.findById(id);
    if (!record) {
      throw new AppError('Document not found', 404);
    }
    assertHospitalScope(record, authUser);
    if (authUser.role === 'PATIENT') {
      const patient = await patientRepository.findByUserId(authUser.id);
      if (!patient || String(patient._id) !== String(record.patientId)) {
        throw new AppError('You can only download your own documents', 403);
      }
    }
    const absolute = path.resolve(record.storagePath);
    if (!absolute.startsWith(env.uploadDir)) {
      throw new AppError('Invalid document path', 400);
    }
    return record;
  }

  private async resolvePatientId(patientId: string | undefined, authUser: AuthUser): Promise<string> {
    if (authUser.role === 'PATIENT') {
      const patient = await patientRepository.findByUserId(authUser.id);
      if (!patient) throw new AppError('Patient profile not found', 404);
      return String(patient._id);
    }
    if (!patientId) {
      throw new AppError('patientId is required', 400);
    }
    const patient = await patientRepository.findById(patientId);
    if (!patient) throw new AppError('Patient not found', 404);
    assertHospitalScope(patient, authUser);
    return String(patient._id);
  }
}
