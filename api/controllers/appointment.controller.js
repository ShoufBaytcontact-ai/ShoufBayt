import prisma from "../lib/prisma.js";
import { sendVisitRequestedEmail, sendVisitStatusEmail } from "../lib/visitEmail.js";
import { isValidPhone as isValidStoredPhone } from "../lib/phone.js";

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);
  return res.status(500).json({
    message: fallbackMessage,
  });
};

const isValidObjectId = (id) =>
  typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

const cleanPhone = (value) => String(value || "").trim();

const isValidPhone = (value) => {
  const raw = cleanPhone(value);
  if (!raw) return true;
  return isValidStoredPhone(raw, { allowEmpty: true });
};

const ALLOWED_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
];

const ACTIVE_VISIT_STATUSES = ["PENDING", "CONFIRMED", "RESCHEDULED"];
const UPCOMING_STATUSES = ["PENDING", "CONFIRMED", "RESCHEDULED"];

const appointmentInclude = {
  property: {
    select: {
      id: true,
      title: true,
      city: true,
      images: true,
      slug: true,
    },
  },
  agent: {
    select: {
      id: true,
      username: true,
      avatar: true,
      agentProfile: {
        select: {
          name: true,
          agencyName: true,
        },
      },
    },
  },
  owner: {
    select: {
      id: true,
      username: true,
      avatar: true,
    },
  },
  buyer: {
    select: {
      id: true,
      username: true,
      avatar: true,
    },
  },
};

const formatAppointment = (item) => {
  if (!item) return null;

  const now = new Date();
  const when = item.scheduledAt ? new Date(item.scheduledAt) : null;
  let timeline = "upcoming";
  if (item.status === "COMPLETED") timeline = "completed";
  else if (item.status === "CANCELLED") timeline = "cancelled";
  else if (when && when < now && item.status !== "COMPLETED") timeline = "past";

  return {
    id: item.id,
    scheduledAt: item.scheduledAt,
    status: item.status,
    timeline,
    visitorName: item.visitorName || null,
    visitorPhone: item.visitorPhone || null,
    notes: item.notes || null,
    buyerId: item.buyerId || null,
    property: item.property
      ? {
          id: item.property.id,
          title: item.property.title,
          city: item.property.city,
          images: item.property.images || [],
          slug: item.property.slug,
        }
      : null,
    agent: item.agent
      ? {
          id: item.agent.id,
          username: item.agent.username,
          avatar: item.agent.avatar || null,
          name: item.agent.agentProfile?.name || item.agent.username,
          agencyName: item.agent.agentProfile?.agencyName || null,
        }
      : null,
    owner: item.owner
      ? {
          id: item.owner.id,
          username: item.owner.username,
          avatar: item.owner.avatar || null,
        }
      : null,
    buyer: item.buyer
      ? {
          id: item.buyer.id,
          username: item.buyer.username,
          avatar: item.buyer.avatar || null,
        }
      : null,
  };
};

const notifyUser = async ({
  userId,
  type,
  title,
  message,
  link,
  metadata,
}) => {
  if (!userId) return;

  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || "/agent",
        metadata: metadata || undefined,
      },
    });
  } catch (error) {
    console.error("Failed to send appointment notification", error);
  }
};

const notifyAppointmentParties = async ({
  ownerId,
  agentId,
  buyerId,
  actorId,
  type,
  title,
  message,
  linkForOwner = "/owner",
  linkForAgent = "/agent",
  linkForBuyer = "/notifications",
  metadata,
}) => {
  const targets = [
    { userId: ownerId, link: linkForOwner },
    { userId: agentId, link: linkForAgent },
    { userId: buyerId, link: linkForBuyer },
  ];

  const seen = new Set();

  for (const target of targets) {
    if (!target.userId || target.userId === actorId || seen.has(target.userId)) {
      continue;
    }
    seen.add(target.userId);
    await notifyUser({
      userId: target.userId,
      type,
      title,
      message,
      link: target.link,
      metadata,
    });
  }
};

const formatVisitWhen = (value) => {
  if (!value) return "the scheduled time";
  try {
    return new Date(value).toLocaleString("en-GB", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

const emailBuyerAboutVisit = async ({
  buyerId,
  propertyTitle,
  scheduledAt,
  status,
  kind,
}) => {
  if (!buyerId) return;

  try {
    const buyer = await prisma.user.findUnique({
      where: { id: buyerId },
      select: { email: true, username: true },
    });

    if (!buyer?.email) return;

    await sendVisitStatusEmail({
      to: buyer.email,
      username: buyer.username,
      propertyTitle,
      scheduledAt,
      status,
      kind,
    });
  } catch (error) {
    console.error("Failed to email buyer about visit", error);
  }
};

export const getMyAppointments = async (req, res) => {
  try {
    const userId = req.userId;

    const appointments = await prisma.appointment.findMany({
      where: {
        OR: [{ ownerId: userId }, { agentId: userId }, { buyerId: userId }],
      },
      orderBy: { scheduledAt: "asc" },
      include: appointmentInclude,
    });

    const formatted = appointments.map(formatAppointment);
    const now = new Date();

    return res.status(200).json({
      items: formatted,
      grouped: {
        pending: formatted.filter((item) => item.status === "PENDING"),
        confirmed: formatted.filter((item) => item.status === "CONFIRMED"),
        upcoming: formatted.filter(
          (item) =>
            UPCOMING_STATUSES.includes(item.status) &&
            item.scheduledAt &&
            new Date(item.scheduledAt) >= now
        ),
        completed: formatted.filter((item) => item.status === "COMPLETED"),
        cancelled: formatted.filter((item) => item.status === "CANCELLED"),
        rescheduled: formatted.filter((item) => item.status === "RESCHEDULED"),
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to load appointments");
  }
};

export const getMyPropertyAppointment = async (req, res) => {
  try {
    const userId = req.userId;
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({ message: "Valid propertyId is required" });
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        propertyId,
        buyerId: userId,
        status: {
          in: ["PENDING", "CONFIRMED", "RESCHEDULED"],
        },
      },
      orderBy: { scheduledAt: "asc" },
      include: appointmentInclude,
    });

    return res.status(200).json({
      appointment: formatAppointment(appointment),
    });
  } catch (error) {
    return handleError(res, error, "Failed to load property visit");
  }
};

export const createAppointment = async (req, res) => {
  try {
    const agentId = req.userId;
    const {
      propertyId,
      scheduledAt,
      visitorName,
      visitorPhone,
      notes,
      status,
    } = req.body || {};

    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({ message: "Valid propertyId is required" });
    }

    const when = scheduledAt ? new Date(scheduledAt) : null;
    if (!when || Number.isNaN(when.getTime())) {
      return res.status(400).json({ message: "Valid scheduledAt is required" });
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        title: true,
        userId: true,
        requestedByUserId: true,
        status: true,
      },
    });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (property.userId !== agentId) {
      return res.status(403).json({
        message: "Only the managing agent can schedule visits for this property",
      });
    }

    const ownerId = property.requestedByUserId || agentId;

    const nextStatus = String(status || "CONFIRMED").toUpperCase();
    if (!ALLOWED_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ message: "Invalid appointment status" });
    }

    const appointment = await prisma.appointment.create({
      data: {
        propertyId,
        ownerId,
        agentId,
        scheduledAt: when,
        status: nextStatus,
        visitorName: visitorName ? String(visitorName).trim() : null,
        visitorPhone: visitorPhone ? String(visitorPhone).trim() : null,
        notes: notes ? String(notes).trim() : null,
      },
      include: appointmentInclude,
    });

    await notifyAppointmentParties({
      ownerId,
      agentId,
      buyerId: null,
      actorId: agentId,
      type: "APPOINTMENT_SCHEDULED",
      title: "Visit scheduled",
      message: `A visit was scheduled for ${property.title}.`,
      metadata: {
        appointmentId: appointment.id,
        propertyId: property.id,
        status: appointment.status,
      },
    });

    return res.status(201).json(formatAppointment(appointment));
  } catch (error) {
    return handleError(res, error, "Failed to create appointment");
  }
};

export const requestAppointment = async (req, res) => {
  return res.status(410).json({
    message:
      "Visit requests from listings are no longer available. Message the agent to arrange a viewing.",
  });
};

export const updateAppointment = async (req, res) => {
  try {
    const agentId = req.userId;
    const { id } = req.params;
    const { scheduledAt, status, visitorName, visitorPhone, notes } =
      req.body || {};

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid appointment id" });
    }

    const existing = await prisma.appointment.findUnique({
      where: { id },
      include: {
        property: {
          select: { id: true, title: true, userId: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (existing.agentId !== agentId && existing.property.userId !== agentId) {
      return res.status(403).json({
        message: "Only the managing agent can update this appointment",
      });
    }

    const data = {};

    if (scheduledAt !== undefined) {
      const when = new Date(scheduledAt);
      if (Number.isNaN(when.getTime())) {
        return res.status(400).json({ message: "Invalid scheduledAt" });
      }
      data.scheduledAt = when;
      data.reminderSentAt = null;
      if (status === undefined) {
        data.status = "RESCHEDULED";
      }
    }

    if (status !== undefined) {
      const nextStatus = String(status).toUpperCase();
      if (!ALLOWED_STATUSES.includes(nextStatus)) {
        return res.status(400).json({ message: "Invalid appointment status" });
      }
      data.status = nextStatus;
    }

    if (visitorName !== undefined) {
      data.visitorName = visitorName ? String(visitorName).trim() : null;
    }
    if (visitorPhone !== undefined) {
      data.visitorPhone = visitorPhone ? String(visitorPhone).trim() : null;
    }
    if (notes !== undefined) {
      data.notes = notes ? String(notes).trim() : null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No updates provided" });
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data,
      include: appointmentInclude,
    });

    const nextStatus = appointment.status;
    const whenLabel = formatVisitWhen(appointment.scheduledAt);
    const propertyTitle = existing.property.title;

    let buyerTitle = "Visit updated";
    let buyerMessage = `Your visit for ${propertyTitle} was updated (${String(
      nextStatus
    ).toLowerCase()}).`;
    let partyTitle = "Visit updated";
    let partyMessage = `A visit for ${propertyTitle} was updated (${String(
      nextStatus
    ).toLowerCase()}).`;
    let emailKind = "updated";

    if (nextStatus === "CONFIRMED") {
      buyerTitle = "Visit confirmed";
      buyerMessage = `Your visit for ${propertyTitle} is confirmed for ${whenLabel}.`;
      partyTitle = "Visit confirmed";
      partyMessage = `A visit for ${propertyTitle} was confirmed for ${whenLabel}.`;
      emailKind = "confirmed";
    } else if (nextStatus === "RESCHEDULED") {
      buyerTitle = "Visit rescheduled";
      buyerMessage = `Your visit for ${propertyTitle} was rescheduled to ${whenLabel}.`;
      partyTitle = "Visit rescheduled";
      partyMessage = `A visit for ${propertyTitle} was rescheduled to ${whenLabel}.`;
      emailKind = "rescheduled";
    } else if (nextStatus === "CANCELLED") {
      buyerTitle = "Visit cancelled";
      buyerMessage = `Your visit for ${propertyTitle} was cancelled.`;
      partyTitle = "Visit cancelled";
      partyMessage = `A visit for ${propertyTitle} was cancelled.`;
      emailKind = "cancelled";
    } else if (nextStatus === "COMPLETED") {
      buyerTitle = "Visit completed";
      buyerMessage = `Your visit for ${propertyTitle} was marked as completed.`;
      partyTitle = "Visit completed";
      partyMessage = `A visit for ${propertyTitle} was marked as completed.`;
      emailKind = "updated";
    }

    await notifyAppointmentParties({
      ownerId: existing.ownerId,
      agentId: existing.agentId,
      buyerId: null,
      actorId: agentId,
      type: "APPOINTMENT_UPDATED",
      title: partyTitle,
      message: partyMessage,
      linkForOwner: "/owner",
      linkForAgent: "/agent",
      metadata: {
        appointmentId: appointment.id,
        propertyId: existing.property.id,
        status: appointment.status,
      },
    });

    if (existing.buyerId && existing.buyerId !== agentId) {
      await notifyUser({
        userId: existing.buyerId,
        type: "APPOINTMENT_UPDATED",
        title: buyerTitle,
        message: buyerMessage,
        link: "/notifications",
        metadata: {
          appointmentId: appointment.id,
          propertyId: existing.property.id,
          status: appointment.status,
        },
      });
    }

    if (
      existing.buyerId &&
      ["CONFIRMED", "RESCHEDULED", "CANCELLED"].includes(nextStatus)
    ) {
      await emailBuyerAboutVisit({
        buyerId: existing.buyerId,
        propertyTitle,
        scheduledAt: appointment.scheduledAt,
        status: nextStatus,
        kind: emailKind,
      });
    }

    return res.status(200).json(formatAppointment(appointment));
  } catch (error) {
    return handleError(res, error, "Failed to update appointment");
  }
};

export { ACTIVE_VISIT_STATUSES, UPCOMING_STATUSES };
