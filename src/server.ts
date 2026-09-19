import fs from 'fs';
import http from 'http';
import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';
import { initializeSockets } from './sockets';
import { UserModel } from './models/user.model';
import { HospitalModel } from './models/hospital.model';
import { seedDatabase } from './scripts/seed';

async function migrateLegacyRoles(): Promise<void> {
  await UserModel.updateMany({ role: 'admin' as never }, { $set: { role: 'HOSPITAL_ADMIN' } });
  await UserModel.updateMany({ role: 'doctor' as never }, { $set: { role: 'DOCTOR' } });
  await UserModel.updateMany({ role: 'patient' as never }, { $set: { role: 'PATIENT' } });
}

async function bootstrap(): Promise<void> {
  await connectDatabase();
  await migrateLegacyRoles();
  await seedDatabase(false);
  if (!fs.existsSync(env.uploadDir)) {
    fs.mkdirSync(env.uploadDir, { recursive: true });
  }

  const app = createApp();
  const httpServer = http.createServer(app);

  initializeSockets(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`PulseCare OS API listening on port ${env.port} (${env.nodeEnv})`);
  });
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start PulseCare OS API', error);
  process.exit(1);
});
