import prisma from "./prisma.js";
import { sendVisitStatusEmail } from "./visitEmail.js";

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
const POLL_MS = 15 * 60 * 1000;

const notifyBuyer = async ({ userId, title, message, metadata }) => {
  if (!userId) return;
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: "APPOINTMENT_REMINDER",
        title,
        message,
        link: "/notifications",
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    console.error("Failed to create visit reminder notification", error);
  }
};

export const processVisitReminders = async () => {
  const now = new Date();
  const until = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const appointments = await prisma.appointment.findMany({
    where: {
      reminderSentAt: null,
      scheduledAt: {
        gte: now,
        lte: until,
      },
      status: {
        in: ["CONFIRMED", "RESCHEDULED"],
      },
      buyerId: {
        not: null,
      },
    },
    take: 50,
    include: {
      property: {
        select: { id: true, title: true },
      },
      buyer: {
        select: { id: true, email: true, username: true },
      },
    },
  });

  for (const appointment of appointments) {
    const propertyTitle = appointment.property?.title || "a property";
    const whenLabel = new Date(appointment.scheduledAt).toLocaleString("en-GB", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    await notifyBuyer({
      userId: appointment.buyerId,
      title: "Visit reminder",
      message: `Reminder: your visit for ${propertyTitle} is scheduled for ${whenLabel}.`,
      metadata: {
        appointmentId: appointment.id,
        propertyId: appointment.propertyId,
        status: appointment.status,
      },
    });

    await sendVisitStatusEmail({
      to: appointment.buyer?.email,
      username: appointment.buyer?.username,
      propertyTitle,
      scheduledAt: appointment.scheduledAt,
      status: appointment.status,
      kind: "reminder",
    });

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { reminderSentAt: new Date() },
    });
  }

  if (appointments.length) {
    console.log(`Visit reminders sent: ${appointments.length}`);
  }

  return appointments.length;
};

export const startVisitReminderJob = () => {
  const run = () => {
    processVisitReminders().catch((error) => {
      console.error("Visit reminder job failed", error);
    });
  };

  // First pass shortly after boot, then every 15 minutes
  setTimeout(run, 20_000);
  setInterval(run, POLL_MS);
  console.log("Visit reminder job started (every 15 minutes)");
};
