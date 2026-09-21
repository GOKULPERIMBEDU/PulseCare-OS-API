import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyToken } from '../utils/token';
import { corsOrigin } from '../utils/corsOrigin';
import { hospitalQueueRoom, setSocketServer } from './emitter';
import { AppointmentService } from '../services/appointment.service';
import { todayDateString } from '../utils/helpers';
import { AuthUser } from '../types';

const appointmentService = new AppointmentService();

export function initializeSockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  setSocketServer(io);

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth as { token?: string })?.token ||
        (typeof socket.handshake.query.token === 'string' ? socket.handshake.query.token : undefined);
      if (!token) {
        next(new Error('Authentication required'));
        return;
      }
      const user = verifyToken(token);
      if (user.role !== 'SUPER_ADMIN' && !user.hospitalId) {
        next(new Error('Hospital context is required'));
        return;
      }
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Invalid session'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as AuthUser;
    void socket.join(`user:${user.id}`);
    if (user.hospitalId) {
      void socket.join(hospitalQueueRoom(user.hospitalId));
      void appointmentService.queue(user.hospitalId, todayDateString()).then((queue) => {
        socket.emit('queue:snapshot', { hospitalId: user.hospitalId, date: todayDateString(), queue });
      });
    }

    socket.on('queue:join', async (payload?: { date?: string; doctorId?: string }) => {
      if (!user.hospitalId) return;
      const date = payload?.date ?? todayDateString();
      const queue = await appointmentService.queue(user.hospitalId, date, payload?.doctorId);
      socket.emit('queue:snapshot', { hospitalId: user.hospitalId, date, queue });
    });
  });

  return io;
}
