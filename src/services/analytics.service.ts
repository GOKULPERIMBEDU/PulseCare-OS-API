import { AuthUser } from '../types';
import { AuditLogRepository } from '../repositories/auditLog.repository';
import { PatientRepository } from '../repositories/patient.repository';
import { DoctorRepository } from '../repositories/doctor.repository';
import { AppointmentRepository } from '../repositories/appointment.repository';
import { BillingRepository } from '../repositories/billing.repository';
import { todayDateString } from '../utils/helpers';
import { AppError } from '../types';
import { requireHospitalId } from '../utils/tenant';

const auditLogRepository = new AuditLogRepository();
const patientRepository = new PatientRepository();
const doctorRepository = new DoctorRepository();
const appointmentRepository = new AppointmentRepository();
const billingRepository = new BillingRepository();

export class AnalyticsService {
  async overview(authUser: AuthUser) {
    const hospitalId = requireHospitalId(authUser);
    const today = todayDateString();
    const [patients, doctors, todayAppointments, statusCounts, paid, pending] = await Promise.all([
      patientRepository.count(hospitalId),
      doctorRepository.count(hospitalId),
      appointmentRepository.count({ hospitalId, date: today }),
      appointmentRepository.countByStatus(hospitalId, today),
      billingRepository.revenueSummary(hospitalId),
      billingRepository.pendingTotal(hospitalId),
    ]);

    const queue = statusCounts.reduce<Record<string, number>>((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    return {
      patients,
      doctors,
      todayAppointments,
      queue,
      revenue: {
        collected: paid[0]?.total ?? 0,
        paidInvoices: paid[0]?.count ?? 0,
        outstanding: pending[0]?.total ?? 0,
        pendingInvoices: pending[0]?.count ?? 0,
      },
      hospital: {
        id: authUser.hospitalId,
        name: authUser.hospitalName,
        baseCurrency: authUser.baseCurrency,
      },
    };
  }

  async auditLogs(authUser: AuthUser, limit = 200) {
    if (authUser.role !== 'HOSPITAL_ADMIN') {
      throw new AppError('Audit logs are restricted to administrators', 403);
    }
    return auditLogRepository.list({ hospitalId: requireHospitalId(authUser) }, limit);
  }
}
