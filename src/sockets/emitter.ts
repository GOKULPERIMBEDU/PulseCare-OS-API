let ioRef: import('socket.io').Server | null = null;

export function setSocketServer(io: import('socket.io').Server): void {
  ioRef = io;
}

export function hospitalQueueRoom(hospitalId: string): string {
  return `queue:hospital:${hospitalId}`;
}

export function emitQueueUpdate(payload: { hospitalId: string; date: string; queue: unknown }): void {
  ioRef?.to(hospitalQueueRoom(payload.hospitalId)).emit('queue:updated', payload);
}
