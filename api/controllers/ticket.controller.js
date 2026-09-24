import prisma from "../lib/prisma.js";
import { createNotification } from "../lib/notify.js";
import { getStoredFileUrl } from "../lib/cloudStorage.js";
import { isValidPhone, normalizePhone } from "../lib/phone.js";
import {
  sendTicketAssignedEmail,
  sendTicketAssignedLawyerEmail,
  sendTicketOpenedEmail,
  sendTicketReplyEmail,
  sendTicketStatusEmail,
} from "../lib/ticketEmail.js";

const CATEGORIES = [
  "REAL_ESTATE_DOCUMENTS",
  "CONSTRUCTION",
  "LAND_REGISTRY_CADASTRE",
  "LAWYER_DEFENSE",
  "PAYMENT",
  "OTHER",
];

const STATUSES = [
  "OPEN",
  "IN_REVIEW",
  "WAITING_USER",
  "WAITING_OTHER",
  "RESOLVED",
  "CLOSED",
];

const ACTIVE_STATUSES = ["OPEN", "IN_REVIEW", "WAITING_USER", "WAITING_OTHER"];

const TICKET_PEOPLE = {
  select: { id: true, username: true, avatar: true, role: true, email: true },
};

const clean = (value) => String(value || "").trim();

const roleOf = (role) => String(role || "").toUpperCase();

const isAdmin = (role) => roleOf(role) === "ADMIN";

const isLawyer = (role) => roleOf(role) === "LAWYER";

const isStaff = (role) => isAdmin(role) || isLawyer(role);

const sameId = (a, b) => String(a || "") === String(b || "");

function normalizeTicketKey(value) {
  let key = clean(value);
  try {
    key = decodeURIComponent(key);
  } catch {
    // keep original
  }
  return key.replace(/^#/, "").replace(/\s+/g, "").toUpperCase();
}

const ticketInclude = {
  author: TICKET_PEOPLE,
  lawyer: TICKET_PEOPLE,
};

async function nextTicketNumber() {
  const year = new Date().getFullYear();
  const row = await prisma.ticketSequence.upsert({
    where: { year },
    create: { year, nextNumber: 1 },
    update: {},
  });
  const updated = await prisma.ticketSequence.update({
    where: { id: row.id },
    data: { nextNumber: { increment: 1 } },
  });
  const seq = updated.nextNumber - 1;
  return {
    year,
    seq,
    number: `SB-${year}-${String(seq).padStart(5, "0")}`,
  };
}

function formatTicket(ticket) {
  if (!ticket) return null;

  return {
    id: ticket.id,
    number: ticket.number,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    status: ticket.status,
    phone: ticket.phone || "",
    images: Array.isArray(ticket.images) ? ticket.images.filter(Boolean) : [],
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    author: ticket.author
      ? {
          id: ticket.author.id,
          username: ticket.author.username,
          avatar: ticket.author.avatar || null,
          role: ticket.author.role || null,
        }
      : null,
    lawyer: ticket.lawyer
      ? {
          id: ticket.lawyer.id,
          username: ticket.lawyer.username,
          avatar: ticket.lawyer.avatar || null,
          role: ticket.lawyer.role || null,
        }
      : null,
    messages: Array.isArray(ticket.messages)
      ? ticket.messages.map((item) => ({
          id: item.id,
          body: item.body,
          createdAt: item.createdAt,
          author: item.author
            ? {
                id: item.author.id,
                username: item.author.username,
                role: item.author.role,
                avatar: item.author.avatar || null,
              }
            : null,
        }))
      : undefined,
  };
}

function ticketWhere(key) {
  const normalized = normalizeTicketKey(key);
  if (/^SB-\d{4}-\d+$/i.test(normalized)) {
    return { number: normalized };
  }
  if (/^[a-f0-9]{24}$/i.test(normalized)) {
    return { id: normalized.toLowerCase() };
  }
  return { number: normalized };
}

function canReadTicket(ticket, userId, role) {
  if (!ticket) return false;
  if (isAdmin(role) || isLawyer(role)) return true;
  return sameId(ticket.authorId, userId);
}

async function notifyUsers(userIds, payload) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  await Promise.all(
    ids.map((userId) =>
      createNotification({
        userId,
        ...payload,
      })
    )
  );
}

async function adminIds(skipUserId) {
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      status: "ACTIVE",
      ...(skipUserId ? { id: { not: skipUserId } } : {}),
    },
    select: { id: true },
  });
  return admins.map((user) => user.id);
}

async function getLawyerWorkload() {
  const lawyers = await prisma.user.findMany({
    where: { role: "LAWYER", status: "ACTIVE" },
    select: { id: true, username: true, avatar: true },
    orderBy: { username: "asc" },
  });

  if (!lawyers.length) return [];

  const rows = await prisma.ticket.findMany({
    where: {
      lawyerId: { in: lawyers.map((item) => item.id) },
      status: { in: ACTIVE_STATUSES },
    },
    select: { lawyerId: true },
  });

  const counts = rows.reduce((acc, row) => {
    acc[row.lawyerId] = (acc[row.lawyerId] || 0) + 1;
    return acc;
  }, {});

  return lawyers.map((lawyer) => ({
    id: lawyer.id,
    username: lawyer.username,
    avatar: lawyer.avatar || null,
    activeCount: counts[lawyer.id] || 0,
  }));
}

export const listTickets = async (req, res) => {
  try {
    const role = roleOf(req.userRole);
    const status = clean(req.query.status).toUpperCase();
    const where = isAdmin(role)
      ? {}
      : isLawyer(role)
        ? { lawyerId: req.userId }
        : { authorId: req.userId };

    if (status && STATUSES.includes(status)) {
      where.status = status;
    }

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: ticketInclude,
    });

    return res.json({
      tickets: tickets.map(formatTicket),
      desk: isStaff(role),
      lawyers: isAdmin(role) ? await getLawyerWorkload() : [],
    });
  } catch (error) {
    console.error("listTickets", error);
    return res.status(500).json({ message: "Could not load tickets." });
  }
};

export const listTicketBoard = async (req, res) => {
  try {
    const rows = await prisma.ticket.findMany({
      where: {
        status: { in: ["IN_REVIEW", "WAITING_USER", "WAITING_OTHER"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true,
        number: true,
        status: true,
        authorId: true,
        lawyerId: true,
        lawyer: { select: { username: true } },
      },
    });

    return res.json({
      tickets: rows.map((item) => ({
        id: item.id,
        number: item.number,
        status: item.status,
        mine: item.authorId === req.userId,
        assigned: item.lawyerId === req.userId,
        lawyer: item.lawyer?.username || "",
      })),
    });
  } catch (error) {
    console.error("listTicketBoard", error);
    return res.status(500).json({ message: "Could not load tickets." });
  }
};

export const createTicket = async (req, res) => {
  try {
    const title = clean(req.body?.title);
    const description = clean(req.body?.description);
    const category = clean(req.body?.category).toUpperCase() || "OTHER";

    if (title.length < 4) {
      return res.status(400).json({ message: "Give the ticket a short title." });
    }
    if (description.length < 12) {
      return res.status(400).json({ message: "Describe the problem in more detail." });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ message: "Choose a valid category." });
    }

    const phone = normalizePhone(req.body?.phone);
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: "Enter a valid phone number." });
    }

    const images = (req.files || [])
      .map((file) => getStoredFileUrl(req, file))
      .filter(Boolean);

    const { year, seq, number } = await nextTicketNumber();

    const ticket = await prisma.ticket.create({
      data: {
        number,
        year,
        seq,
        title,
        description,
        category,
        phone,
        images,
        authorId: req.userId,
      },
      include: ticketInclude,
    });

    await notifyUsers(await adminIds(req.userId), {
      type: "TICKET_NEW",
      title: "New ticket to assign",
      message: `${number}: ${title}`,
      link: `/tickets/${number}`,
    });

    sendTicketOpenedEmail({
      to: ticket.author?.email,
      username: ticket.author?.username,
      number,
      title,
      category,
    }).catch((error) => console.error("ticket opened email", error));

    return res.status(201).json({ ticket: formatTicket(ticket) });
  } catch (error) {
    console.error("createTicket", error);
    return res.status(500).json({ message: "Could not create the ticket." });
  }
};

export const getTicket = async (req, res) => {
  try {
    const key = normalizeTicketKey(req.params.id);
    if (!key) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    const ticket = await prisma.ticket.findFirst({
      where: ticketWhere(key),
      include: {
        ...ticketInclude,
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            author: TICKET_PEOPLE,
          },
        },
      },
    });

    if (!canReadTicket(ticket, req.userId, req.userRole)) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    return res.json({
      ticket: formatTicket(ticket),
      lawyers: isAdmin(req.userRole) ? await getLawyerWorkload() : [],
    });
  } catch (error) {
    console.error("getTicket", error);
    if (error?.code === "P2023" || /malformed|invalid/i.test(error?.message || "")) {
      return res.status(404).json({ message: "Ticket not found." });
    }
    return res.status(500).json({ message: "Could not load the ticket." });
  }
};

export const addTicketMessage = async (req, res) => {
  try {
    const key = clean(req.params.id);
    const body = clean(req.body?.body);
    if (body.length < 1) {
      return res.status(400).json({ message: "Write a reply." });
    }

    const ticket = await prisma.ticket.findFirst({
      where: ticketWhere(key),
    });

    if (!canReadTicket(ticket, req.userId, req.userRole)) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    if (ticket.status === "CLOSED") {
      return res.status(400).json({ message: "This ticket is closed." });
    }

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: req.userId,
        body,
      },
      include: {
        author: {
          select: { id: true, username: true, avatar: true, role: true },
        },
      },
    });

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date() },
    });

    const recipients =
      ticket.authorId === req.userId
        ? ticket.lawyerId
          ? [ticket.lawyerId]
          : await adminIds(req.userId)
        : [ticket.authorId];

    await notifyUsers(recipients, {
      type: "TICKET_REPLY",
      title: `Reply on ${ticket.number}`,
      message: body.slice(0, 140),
      link: `/tickets/${ticket.number}`,
    });

    if (ticket.authorId !== req.userId) {
      const author = await prisma.user.findUnique({
        where: { id: ticket.authorId },
        select: { email: true, username: true },
      });
      sendTicketReplyEmail({
        to: author?.email,
        username: author?.username,
        number: ticket.number,
        title: ticket.title,
        preview: body.slice(0, 180),
        fromName: message.author?.username,
      }).catch((error) => console.error("ticket reply email", error));
    }

    return res.status(201).json({
      message: {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt,
        author: message.author,
      },
    });
  } catch (error) {
    console.error("addTicketMessage", error);
    return res.status(500).json({ message: "Could not send the reply." });
  }
};

export const assignTicket = async (req, res) => {
  try {
    if (!isAdmin(req.userRole)) {
      return res.status(403).json({ message: "Only an admin can assign a lawyer." });
    }

    const lawyerId = clean(req.body?.lawyerId);
    const lawyer = await prisma.user.findFirst({
      where: { id: lawyerId, role: "LAWYER", status: "ACTIVE" },
      select: { id: true, username: true, email: true },
    });

    if (!lawyer) {
      return res.status(400).json({ message: "Choose an active lawyer." });
    }

    const key = clean(req.params.id);
    const ticket = await prisma.ticket.findFirst({
      where: ticketWhere(key),
    });

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        lawyerId: lawyer.id,
        status: ticket.status === "OPEN" ? "IN_REVIEW" : ticket.status,
      },
      include: ticketInclude,
    });

    await notifyUsers(
      [ticket.authorId, lawyer.id].filter((id) => id !== req.userId),
      {
        type: "TICKET_STATUS",
        title: `${ticket.number} assigned`,
        message: `${lawyer.username} is now handling this ticket.`,
        link: `/tickets/${ticket.number}`,
      }
    );

    sendTicketAssignedEmail({
      to: updated.author?.email,
      username: updated.author?.username,
      number: ticket.number,
      title: ticket.title,
      lawyerName: lawyer.username,
    }).catch((error) => console.error("ticket assigned email", error));

    sendTicketAssignedLawyerEmail({
      to: lawyer.email,
      username: lawyer.username,
      number: ticket.number,
      title: ticket.title,
      clientName: updated.author?.username,
      phone: updated.phone,
    }).catch((error) => console.error("ticket assigned lawyer email", error));

    return res.json({
      ticket: formatTicket(updated),
      lawyers: await getLawyerWorkload(),
    });
  } catch (error) {
    console.error("assignTicket", error);
    return res.status(500).json({ message: "Could not assign the ticket." });
  }
};

export const updateTicketStatus = async (req, res) => {
  try {
    if (!isLawyer(req.userRole)) {
      return res.status(403).json({ message: "Only the assigned lawyer can update status." });
    }

    const status = clean(req.body?.status).toUpperCase();
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: "Choose a valid status." });
    }

    const key = clean(req.params.id);
    const ticket = await prisma.ticket.findFirst({
      where: ticketWhere(key),
    });

    if (!ticket || !sameId(ticket.lawyerId, req.userId)) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status },
      include: ticketInclude,
    });

    await createNotification({
      userId: ticket.authorId,
      type: "TICKET_STATUS",
      title: `${ticket.number} updated`,
      message: `Status is now ${status.replace(/_/g, " ").toLowerCase()}.`,
      link: `/tickets/${ticket.number}`,
    });

    sendTicketStatusEmail({
      to: updated.author?.email,
      username: updated.author?.username,
      number: ticket.number,
      title: ticket.title,
      status,
      lawyerName: updated.lawyer?.username,
    }).catch((error) => console.error("ticket status email", error));

    return res.json({ ticket: formatTicket(updated) });
  } catch (error) {
    console.error("updateTicketStatus", error);
    return res.status(500).json({ message: "Could not update the ticket." });
  }
};

export const listTicketLawyers = async (req, res) => {
  try {
    if (!isAdmin(req.userRole)) {
      return res.status(403).json({ message: "Only an admin can view lawyer workload." });
    }

    return res.json({ lawyers: await getLawyerWorkload() });
  } catch (error) {
    console.error("listTicketLawyers", error);
    return res.status(500).json({ message: "Could not load lawyers." });
  }
};
