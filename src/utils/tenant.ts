import { AppError, AuthUser, isSuperAdmin } from '../types';

export function requireHospitalId(user: AuthUser): string {
  if (isSuperAdmin(user.role)) {
    if (user.hospitalId) return user.hospitalId;
    throw new AppError('Select a hospital context for this action', 400);
  }
  if (!user.hospitalId) {
    throw new AppError('Hospital context is required', 403);
  }
  return user.hospitalId;
}

export function hospitalRef(id: unknown): string {
  if (id && typeof id === 'object' && '_id' in (id as object)) {
    return String((id as { _id: unknown })._id);
  }
  return String(id ?? '');
}

export function assertHospitalScope(record: { hospitalId?: unknown } | null, authUser: AuthUser): void {
  if (isSuperAdmin(authUser.role)) {
    return;
  }
  if (!record || hospitalRef(record.hospitalId) !== authUser.hospitalId) {
    throw new AppError('Resource not found', 404);
  }
}

export function tenantFilter(authUser: AuthUser, requestedHospitalId?: string): Record<string, unknown> {
  if (isSuperAdmin(authUser.role)) {
    return requestedHospitalId ? { hospitalId: requestedHospitalId } : {};
  }
  return { hospitalId: requireHospitalId(authUser) };
}

export function slugifyHospitalName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'hospital';
}
