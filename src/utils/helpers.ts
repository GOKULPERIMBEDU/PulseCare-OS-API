import { Request, Response } from 'express';

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

export function todayDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function fromMinutes(total: number): string {
  const hours = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (total % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function addMinutes(time: string, minutes: number): string {
  return fromMinutes(toMinutes(time) + minutes);
}

export function generateSlots(
  startTime: string,
  endTime: string,
  slotMinutes: number,
): string[] {
  const slots: string[] = [];
  let cursor = toMinutes(startTime);
  const end = toMinutes(endTime);

  while (cursor + slotMinutes <= end) {
    slots.push(fromMinutes(cursor));
    cursor += slotMinutes;
  }

  return slots;
}

export function dayOfWeekFromDate(date: string): number {
  return new Date(`${date}T00:00:00`).getDay();
}

export function generateMrn(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PC-${stamp}-${random}`;
}

export function generateInvoiceNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${stamp}-${random}`;
}

export function generateSaasInvoiceNumber(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SAAS-${stamp}-${random}`;
}
