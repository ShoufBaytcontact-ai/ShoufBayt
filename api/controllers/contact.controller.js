import prisma from "../lib/prisma.js";

const CONTACT_TYPES = ["MESSAGE", "REPORT"];
const EDIT_WINDOW_MS = 60 * 60 * 1000;

const isValidObjectId = (id) => {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
};

const cleanText = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const hasAdminReply = (contactMessage) => {
  return Boolean(cleanText(contactMessage?.adminReply));
};

const getEditExpiresAt = (createdAt) => {
  const created = new Date(createdAt || Date.now()).getTime();
  return new Date(created + EDIT_WINDOW_MS);
};

const canUserEdit = (contactMessage) => {
  if (!contactMessage || hasAdminReply(contactMessage)) {
    return false;
  }

  return Date.now() < getEditExpiresAt(contactMessage.createdAt).getTime();
};

const canUserDelete = (contactMessage) => {
  return hasAdminReply(contactMessage);
};

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage.toUpperCase(), error);

  if (error?.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    });
  }

  return res.status(500).json({
    message: fallbackMessage,
  });
};

const formatContactMessage = (contactMessage) => {
  if (!contactMessage) {
    return null;
  }

  return {
    ...contactMessage,
    name: contactMessage.senderName || "",
    email: contactMessage.senderEmail || "",
    canEdit: canUserEdit(contactMessage),
    canDelete: canUserDelete(contactMessage),
    wasEdited:
      Boolean(contactMessage.updatedAt) &&
      Boolean(contactMessage.createdAt) &&
      !hasAdminReply(contactMessage) &&
      new Date(contactMessage.updatedAt).getTime() -
        new Date(contactMessage.createdAt).getTime() >
        8000,
    editExpiresAt: getEditExpiresAt(contactMessage.createdAt).toISOString(),
  };
};

/* =========================================================
   CREATE CONTACT MESSAGE
========================================================= */

export const createContactMessage = async (req, res) => {
  const requestedUserId = cleanText(req.userId);

  const senderName = cleanText(req.body.name || req.body.senderName);
  const senderEmail = cleanText(
    req.body.email || req.body.senderEmail
  ).toLowerCase();
  const subject = cleanText(req.body.subject);
  const message = cleanText(req.body.message);
  const requestedType = cleanText(req.body.type).toUpperCase();

  try {
    if (!senderName || !senderEmail || !subject || !message) {
      return res.status(400).json({
        message: "Name, email, subject, and message are required",
      });
    }

    if (senderName.length < 2) {
      return res.status(400).json({
        message: "Name must be at least 2 characters",
      });
    }

    if (senderName.length > 100) {
      return res.status(400).json({
        message: "Name cannot exceed 100 characters",
      });
    }

    if (!isValidEmail(senderEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    if (subject.length < 3) {
      return res.status(400).json({
        message: "Subject must be at least 3 characters",
      });
    }

    if (subject.length > 200) {
      return res.status(400).json({
        message: "Subject cannot exceed 200 characters",
      });
    }

    if (message.length < 10) {
      return res.status(400).json({
        message: "Message must be at least 10 characters",
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        message: "Message cannot exceed 5000 characters",
      });
    }

    const type = CONTACT_TYPES.includes(requestedType)
      ? requestedType
      : "MESSAGE";

    let userId = null;

    if (requestedUserId) {
      if (!isValidObjectId(requestedUserId)) {
        return res.status(400).json({
          message: "Invalid authenticated user ID",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          id: requestedUserId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          message: "Authenticated user not found",
        });
      }

      if (user.status === "BANNED" || user.status === "SUSPENDED") {
        return res.status(403).json({
          message: `${user.status === "BANNED" ? "Banned" : "Suspended"} accounts cannot send messages`,
        });
      }

      userId = user.id;
    }

    const contactMessage = await prisma.contactMessage.create({
      data: {
        userId,
        senderName,
        senderEmail,
        subject,
        message,
        type,
        status: "OPEN",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            role: true,
            status: true,
          },
        },
      },
    });

    return res.status(201).json({
      message:
        type === "REPORT"
          ? "Report submitted successfully"
          : "Message sent successfully",
      contactMessage: formatContactMessage(contactMessage),
    });
  } catch (error) {
    return handleError(res, error, "Failed to send message");
  }
};

/* =========================================================
   GET CURRENT USER CONTACT MESSAGES
========================================================= */

export const getMyContactMessages = async (req, res) => {
  const userId = cleanText(req.userId);

  try {
    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid authenticated user ID",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const messages = await prisma.contactMessage.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        senderName: true,
        senderEmail: true,
        type: true,
        status: true,
        subject: true,
        message: true,
        adminReply: true,
        adminRepliedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(messages.map(formatContactMessage));
  } catch (error) {
    return handleError(res, error, "Failed to get your contact messages");
  }
};

/* =========================================================
   GET SINGLE USER CONTACT MESSAGE
========================================================= */

export const getMyContactMessage = async (req, res) => {
  const userId = cleanText(req.userId);
  const messageId = cleanText(req.params.id);

  try {
    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid authenticated user ID",
      });
    }

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({
        message: "Invalid contact message ID",
      });
    }

    const contactMessage = await prisma.contactMessage.findFirst({
      where: {
        id: messageId,
        userId,
      },
    });

    if (!contactMessage) {
      return res.status(404).json({
        message: "Contact message not found",
      });
    }

    return res.status(200).json(formatContactMessage(contactMessage));
  } catch (error) {
    return handleError(res, error, "Failed to get contact message");
  }
};

/* =========================================================
   UPDATE OWN CONTACT MESSAGE
========================================================= */

export const updateMyContactMessage = async (req, res) => {
  const userId = cleanText(req.userId);
  const messageId = cleanText(req.params.id);
  const subject = cleanText(req.body.subject);
  const message = cleanText(req.body.message);

  try {
    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    if (!isValidObjectId(userId) || !isValidObjectId(messageId)) {
      return res.status(400).json({
        message: "Invalid contact message ID",
      });
    }

    if (!subject || !message) {
      return res.status(400).json({
        message: "Subject and message are required",
      });
    }

    if (subject.length < 3 || subject.length > 200) {
      return res.status(400).json({
        message: "Subject must be between 3 and 200 characters",
      });
    }

    if (message.length < 10 || message.length > 5000) {
      return res.status(400).json({
        message: "Message must be between 10 and 5000 characters",
      });
    }

    const contactMessage = await prisma.contactMessage.findFirst({
      where: {
        id: messageId,
        userId,
      },
    });

    if (!contactMessage) {
      return res.status(404).json({
        message: "Contact message not found",
      });
    }

    if (hasAdminReply(contactMessage)) {
      return res.status(403).json({
        message: "This request can no longer be edited after the team has replied.",
      });
    }

    if (!canUserEdit(contactMessage)) {
      return res.status(403).json({
        message: "The 1-hour edit window has closed. Your original message is now locked.",
      });
    }

    const updated = await prisma.contactMessage.update({
      where: {
        id: messageId,
      },
      data: {
        subject,
        message,
      },
    });

    return res.status(200).json(formatContactMessage(updated));
  } catch (error) {
    return handleError(res, error, "Failed to update contact message");
  }
};

/* =========================================================
   DELETE OWN CONTACT MESSAGE
========================================================= */

export const deleteMyContactMessage = async (req, res) => {
  const userId = cleanText(req.userId);
  const messageId = cleanText(req.params.id);

  try {
    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid authenticated user ID",
      });
    }

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({
        message: "Invalid contact message ID",
      });
    }

    const contactMessage = await prisma.contactMessage.findFirst({
      where: {
        id: messageId,
        userId,
      },
    });

    if (!contactMessage) {
      return res.status(404).json({
        message: "Contact message not found",
      });
    }

    if (!canUserDelete(contactMessage)) {
      return res.status(403).json({
        message:
          "This request stays in tracking until the ShoufBayt team replies. After that, you can remove it.",
      });
    }

    await prisma.contactMessage.delete({
      where: {
        id: messageId,
      },
    });

    return res.status(200).json({
      message: "Contact message removed from tracking",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete contact message");
  }
};

/* =========================================================
   CLEAR ANSWERED TRACKING
========================================================= */

export const clearMyAnsweredContactMessages = async (req, res) => {
  const userId = cleanText(req.userId);

  try {
    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    if (!isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid authenticated user ID",
      });
    }

    const existing = await prisma.contactMessage.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        adminReply: true,
      },
    });

    const answeredIds = existing
      .filter((item) => hasAdminReply(item))
      .map((item) => item.id);

    if (answeredIds.length) {
      await prisma.contactMessage.deleteMany({
        where: {
          id: {
            in: answeredIds,
          },
        },
      });
    }

    const remaining = await prisma.contactMessage.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      message:
        answeredIds.length > 0
          ? "Answered requests were removed from tracking."
          : "Nothing to clear yet. Requests can be removed after the team replies.",
      count: answeredIds.length,
      messages: remaining.map(formatContactMessage),
    });
  } catch (error) {
    return handleError(res, error, "Failed to clear contact tracking");
  }
};
