import prisma from "../lib/prisma.js";
import { emitToUser, emitToUsers } from "../lib/realtime.js";
import { previewForLastMessage } from "../lib/chatSecurity.js";
import {
  allowSupportAdmin,
  isSupportChat,
} from "../lib/supportChatAccess.js";

/* =========================================================
   CONSTANTS
========================================================= */

const safeUserSelect = {
  id: true,
  username: true,
  email: true,
  avatar: true,
  role: true,
  status: true,
  agentProfile: {
    select: {
      name: true,
      agencyName: true,
      image: true,
    },
  },
};

const chatInclude = {
  participants: {
    include: {
      user: {
        select: safeUserSelect,
      },
    },
  },

  messages: {
    orderBy: {
      createdAt: "asc",
    },

    include: {
      sender: {
        select: safeUserSelect,
      },
    },
  },
};

/* =========================================================
   HELPERS
========================================================= */

const isValidObjectId = (id) => {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
};

const normalizeId = (id) => {
  return String(id || "").trim();
};

const cleanText = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage.toUpperCase(), error);

  if (error?.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    });
  }

  if (error?.code === "P2002") {
    return res.status(409).json({
      message: "A record with the same value already exists",
    });
  }

  return res.status(500).json({
    message: fallbackMessage,
  });
};

const getChatUserIds = (chat) => {
  if (Array.isArray(chat?.participants)) {
    return chat.participants
      .map((participant) => normalizeId(participant.userId || participant.user?.id))
      .filter(Boolean);
  }

  // Compatibility if a plain userIDs array is already attached
  if (Array.isArray(chat?.userIDs)) {
    return chat.userIDs.map((id) => normalizeId(id)).filter(Boolean);
  }

  return [];
};

const getOtherUserId = (chat, currentUserId) => {
  const cleanCurrentUserId = normalizeId(currentUserId);

  return (
    getChatUserIds(chat).find((id) => id && id !== cleanCurrentUserId) || ""
  );
};

const uniqueIds = (ids = []) => {
  return [...new Set((ids || []).map((id) => normalizeId(id)).filter(Boolean))];
};

const sameParticipantSet = (chat, participantIds) => {
  const currentIds = getChatUserIds(chat);
  const expectedIds = uniqueIds(participantIds);

  return (
    currentIds.length === expectedIds.length &&
    expectedIds.every((id) => currentIds.includes(id))
  );
};

const isChatMember = (chat, userId) => {
  const cleanUserId = normalizeId(userId);
  return getChatUserIds(chat).includes(cleanUserId);
};

const isMessageHiddenFor = (message, userId) => {
  const hidden = Array.isArray(message?.hiddenForIds)
    ? message.hiddenForIds.map((id) => normalizeId(id)).filter(Boolean)
    : [];

  return hidden.includes(normalizeId(userId));
};

const formatMessage = (message, chat = null) => {
  if (!message) {
    return null;
  }

  const senderId = normalizeId(message.senderId);
  const receiverId = chat ? getOtherUserId(chat, senderId) : "";
  const deletedForEveryone = Boolean(message.deletedForEveryone);
  const mediaUrl = deletedForEveryone
    ? null
    : message.mediaUrl || message.image || null;
  const mediaKind = deletedForEveryone
    ? "deleted"
    : message.mediaKind ||
      (message.image || message.mediaUrl ? "image" : null);

  return {
    id: message.id,
    _id: message.id,

    chatId: message.chatId,

    senderId,
    userId: senderId,
    receiverId,

    text: deletedForEveryone ? "" : message.text || "",
    image: !deletedForEveryone && mediaKind === "image" ? mediaUrl : null,

    mediaUrl,
    mediaKind,
    mediaName: deletedForEveryone ? null : message.mediaName || null,
    mediaMime: deletedForEveryone ? null : message.mediaMime || null,

    isRead: message.isRead ?? false,
    readAt: message.readAt || null,

    deletedForEveryone,
    hiddenForIds: Array.isArray(message.hiddenForIds)
      ? message.hiddenForIds.map((id) => normalizeId(id)).filter(Boolean)
      : [],

    createdAt: message.createdAt,

    sender: message.sender || null,
    user: message.sender || null,
    receiver: null,
  };
};

const enrichChats = (chats, currentUserId) => {
  const cleanCurrentUserId = normalizeId(currentUserId);

  const enrichedChats = chats.map((chat) => {
    const cleanUserIDs = getChatUserIds(chat);

    const chatUsers = Array.isArray(chat.participants)
      ? chat.participants.map((participant) => participant.user).filter(Boolean)
      : [];

    const usersMap = new Map(
      chatUsers.map((user) => [normalizeId(user.id), user])
    );

    const normalizedChat = {
      ...chat,
      userIDs: cleanUserIDs,
    };

    const otherUsers = chatUsers.filter(
      (user) => normalizeId(user.id) !== cleanCurrentUserId
    );
    const receiverId = getOtherUserId(normalizedChat, cleanCurrentUserId);
    const receiver = receiverId
      ? usersMap.get(receiverId) || otherUsers[0] || null
      : otherUsers[0] || null;

    const formattedMessages = Array.isArray(chat.messages)
      ? chat.messages
          .filter((message) => !isMessageHiddenFor(message, cleanCurrentUserId))
          .map((message) => formatMessage(message, normalizedChat))
          .filter(Boolean)
      : [];

    const latestMessage =
      formattedMessages.length > 0
        ? [...formattedMessages].sort(
            (a, b) =>
              new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
          )[0]
        : null;

    const unreadCount = formattedMessages.filter(
      (message) =>
        !message.isRead &&
        !message.deletedForEveryone &&
        message.senderId !== cleanCurrentUserId
    ).length;

    return {
      id: chat.id,
      _id: chat.id,

      // Keep userIDs in response for frontend compatibility
      userIDs: cleanUserIDs,
      users: chatUsers,

      propertyId: chat.propertyId || null,
      kind: chat.kind || "DIRECT",

      receiverId,
      receiver,
      receivers: otherUsers,

      messages: formattedMessages,

      lastMessage: latestMessage?.deletedForEveryone
        ? ""
        : latestMessage?.text ||
          previewForLastMessage(latestMessage || {}) ||
          "",
      lastMessageAt: latestMessage?.createdAt || null,

      unreadCount,

      createdAt: chat.createdAt,
      updatedAt:
        chat.lastMessageAt ||
        chat.updatedAt ||
        latestMessage?.createdAt ||
        chat.createdAt,
    };
  });

  return enrichedChats.sort((a, b) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0);
    const dateB = new Date(b.updatedAt || b.createdAt || 0);
    return dateB - dateA;
  });
};

const findChatWithParticipants = async (chatId) => {
  return prisma.chat.findUnique({
    where: {
      id: chatId,
    },
    include: {
      participants: {
        select: {
          userId: true,
        },
      },
    },
  });
};

/* =========================================================
   GET CURRENT USER CHATS
========================================================= */

export const getChats = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);

  try {
    if (!tokenUserId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if (!isValidObjectId(tokenUserId)) {
      return res.status(400).json({
        message: "Invalid authenticated user ID",
      });
    }

    const chats = await prisma.chat.findMany({
      where: {
        participants: {
          some: {
            userId: tokenUserId,
          },
        },
        NOT: {
          kind: "SUPPORT",
        },
      },

      include: {
        ...chatInclude,
        messages: {
          ...chatInclude.messages,
          orderBy: {
            createdAt: "desc",
          },
        },
      },

      orderBy: [
        {
          lastMessageAt: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });

    return res.status(200).json(enrichChats(chats, tokenUserId));
  } catch (error) {
    return handleError(res, error, "Failed to get chats");
  }
};

/* =========================================================
   GET SINGLE CHAT
========================================================= */

export const getChat = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);
  const chatId = normalizeId(req.params.id);

  try {
    if (!tokenUserId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if (!isValidObjectId(chatId)) {
      return res.status(400).json({
        message: "Invalid chat ID",
      });
    }

    const chat = await prisma.chat.findUnique({
      where: {
        id: chatId,
      },
      include: chatInclude,
    });

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    if (!isChatMember(chat, tokenUserId)) {
      const allowed = await allowSupportAdmin(chat, tokenUserId);
      if (!allowed) {
        return res.status(403).json({
          message: "You are not authorized to access this chat",
        });
      }
    }

    return res.status(200).json(enrichChats([chat], tokenUserId)[0]);
  } catch (error) {
    return handleError(res, error, "Failed to get chat");
  }
};

/* =========================================================
   CREATE CHAT
========================================================= */

export const addChat = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);
  const explicitReceiverId = normalizeId(req.body.receiverId || req.body.userId);
  const extraReceiverIds = Array.isArray(req.body.receiverIds)
    ? req.body.receiverIds.map((id) => normalizeId(id))
    : [];
  const propertyId = normalizeId(req.body.propertyId) || null;

  try {
    if (!tokenUserId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if (!isValidObjectId(tokenUserId)) {
      return res.status(400).json({
        message: "Invalid authenticated user ID",
      });
    }

    if (propertyId && !isValidObjectId(propertyId)) {
      return res.status(400).json({
        message: "Invalid property ID",
      });
    }

    let requestedReceiverIds = uniqueIds([
      explicitReceiverId,
      ...extraReceiverIds,
    ]).filter((id) => id !== tokenUserId);

    if (propertyId) {
      const property = await prisma.property.findUnique({
        where: {
          id: propertyId,
        },
        select: {
          id: true,
          userId: true,
          requestedByUserId: true,
        },
      });

      if (!property) {
        return res.status(404).json({
          message: "Property not found",
        });
      }

      requestedReceiverIds = uniqueIds([
        ...requestedReceiverIds,
        property.userId,
        property.requestedByUserId,
      ]).filter((id) => id !== tokenUserId);
    }

    if (requestedReceiverIds.length === 0) {
      return res.status(400).json({
        message: propertyId
          ? "You cannot start a listing chat with yourself"
          : "Receiver ID is required",
      });
    }

    if (requestedReceiverIds.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({
        message: "Invalid receiver ID",
      });
    }

    const [currentUser, receivers] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: tokenUserId,
        },
        select: safeUserSelect,
      }),
      prisma.user.findMany({
        where: {
          id: {
            in: requestedReceiverIds,
          },
        },
        select: safeUserSelect,
      }),
    ]);

    if (!currentUser) {
      return res.status(404).json({
        message: "Authenticated user not found",
      });
    }

    if (currentUser.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Your account is not active",
      });
    }

    const activeReceivers = receivers.filter(
      (user) => user.status === "ACTIVE"
    );
    const receiverIds = uniqueIds(activeReceivers.map((user) => user.id));

    if (receiverIds.length === 0) {
      return res.status(400).json({
        message: "The selected user is not available",
      });
    }

    const participantIds = uniqueIds([tokenUserId, ...receiverIds]);

    const candidateChats = await prisma.chat.findMany({
      where: {
        AND: [
          propertyId
            ? {
                propertyId,
              }
            : {
                propertyId: null,
              },
          ...participantIds.map((userId) => ({
            participants: {
              some: {
                userId,
              },
            },
          })),
        ],
      },
      include: chatInclude,
    });

    const existingChat = candidateChats.find((chat) =>
      sameParticipantSet(chat, participantIds)
    );

    if (existingChat) {
      const currentIds = getChatUserIds(existingChat);
      const missingIds = participantIds.filter((id) => !currentIds.includes(id));

      if (missingIds.length > 0) {
        await prisma.chatParticipant.createMany({
          data: missingIds.map((userId) => ({
            chatId: existingChat.id,
            userId,
          })),
        });
      }

      const refreshedChat = await prisma.chat.findUnique({
        where: {
          id: existingChat.id,
        },
        include: chatInclude,
      });

      return res.status(200).json(enrichChats([refreshedChat], tokenUserId)[0]);
    }

    const chat = await prisma.chat.create({
      data: {
        propertyId: propertyId || null,
        lastMessage: "",
        lastMessageAt: null,
        participants: {
          create: participantIds.map((userId) => ({
            userId,
          })),
        },
      },
      include: chatInclude,
    });

    return res.status(201).json(enrichChats([chat], tokenUserId)[0]);
  } catch (error) {
    return handleError(res, error, "Failed to create chat");
  }
};

/* =========================================================
   SEND MESSAGE
========================================================= */

export const sendMessage = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);
  const chatId = normalizeId(req.params.id || req.body.chatId);
  const text = cleanText(req.body.text);
  const image = cleanText(req.body.image);

  try {
    if (!tokenUserId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if (!isValidObjectId(chatId)) {
      return res.status(400).json({
        message: "Invalid chat ID",
      });
    }

    if (!text && !image) {
      return res.status(400).json({
        message: "Message text or image is required",
      });
    }

    if (text.length > 5000) {
      return res.status(400).json({
        message: "Message cannot exceed 5000 characters",
      });
    }

    const chat = await findChatWithParticipants(chatId);

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    if (!isChatMember(chat, tokenUserId)) {
      const allowed = await allowSupportAdmin(chat, tokenUserId);
      if (!allowed) {
        return res.status(403).json({
          message: "You are not authorized to send messages in this chat",
        });
      }
    }

    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: tokenUserId,
        text: text || null,
        image: image || null,
        isRead: false,
      },
      include: {
        sender: {
          select: safeUserSelect,
        },
      },
    });

    await prisma.chat.update({
      where: {
        id: chatId,
      },
      data: {
        lastMessage: text || (image ? "Image" : ""),
        lastMessageAt: new Date(),
      },
    });

    return res.status(201).json(formatMessage(message, chat));
  } catch (error) {
    return handleError(res, error, "Failed to send message");
  }
};

/* =========================================================
   MARK CHAT AS READ
========================================================= */

export const readChat = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);
  const chatId = normalizeId(req.params.id);

  try {
    if (!tokenUserId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if (!isValidObjectId(chatId)) {
      return res.status(400).json({
        message: "Invalid chat ID",
      });
    }

    const chat = await findChatWithParticipants(chatId);

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    if (!isChatMember(chat, tokenUserId)) {
      const allowed = await allowSupportAdmin(chat, tokenUserId);
      if (!allowed) {
        return res.status(403).json({
          message: "You are not authorized to access this chat",
        });
      }
    }

    const now = new Date();

    await prisma.message.updateMany({
      where: {
        chatId,
        senderId: {
          not: tokenUserId,
        },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: now,
      },
    });

    const updatedChat = await prisma.chat.findUnique({
      where: {
        id: chatId,
      },
      include: chatInclude,
    });

    return res.status(200).json({
      message: "Chat marked as read",
      chat: enrichChats([updatedChat], tokenUserId)[0],
    });
  } catch (error) {
    return handleError(res, error, "Failed to mark chat as read");
  }
};

/* =========================================================
   DELETE MESSAGE
========================================================= */

export const deleteMessage = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);
  const messageId = normalizeId(req.params.messageId || req.params.id);
  const scope = String(req.query.scope || req.body?.scope || "me")
    .toLowerCase()
    .trim();

  try {
    if (!tokenUserId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if (!isValidObjectId(messageId)) {
      return res.status(400).json({
        message: "Invalid message ID",
      });
    }

    if (scope !== "me" && scope !== "everyone") {
      return res.status(400).json({
        message: "Delete scope must be me or everyone",
      });
    }

    const message = await prisma.message.findUnique({
      where: {
        id: messageId,
      },
      include: {
        sender: {
          select: {
            id: true,
            role: true,
          },
        },
        chat: {
          include: {
            participants: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (!isChatMember(message.chat, tokenUserId)) {
      return res.status(403).json({
        message: "You are not authorized to access this message",
      });
    }

    const participantIds = getChatUserIds(message.chat);
    const currentUser = await prisma.user.findUnique({
      where: {
        id: tokenUserId,
      },
      select: {
        role: true,
      },
    });

    const isSender = message.senderId === tokenUserId;
    const isAdmin = currentUser?.role === "ADMIN";

    if (scope === "everyone" && !isSender && !isAdmin) {
      return res.status(403).json({
        message: "You can only delete your own messages for everyone",
      });
    }

    if (scope === "me") {
      const hiddenForIds = Array.isArray(message.hiddenForIds)
        ? message.hiddenForIds.map((id) => normalizeId(id)).filter(Boolean)
        : [];

      if (!hiddenForIds.includes(tokenUserId)) {
        await prisma.message.update({
          where: {
            id: messageId,
          },
          data: {
            hiddenForIds: {
              push: tokenUserId,
            },
          },
        });
      }

      emitToUser(tokenUserId, "messageDeleted", {
        chatId: message.chatId,
        messageId,
        scope: "me",
      });

      return res.status(200).json({
        message: "Message deleted for you",
        scope: "me",
        messageId,
        chatId: message.chatId,
      });
    }

    const updated = await prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        deletedForEveryone: true,
        text: "",
        image: null,
        mediaUrl: null,
        mediaKind: "deleted",
        mediaName: null,
        mediaMime: null,
      },
    });

    const latestVisible = await prisma.message.findFirst({
      where: {
        chatId: message.chatId,
        deletedForEveryone: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    await prisma.chat.update({
      where: {
        id: message.chatId,
      },
      data: {
        lastMessage: previewForLastMessage(latestVisible || {}),
        lastMessageAt: latestVisible?.createdAt || null,
      },
    });

    emitToUsers(participantIds, "messageDeleted", {
      chatId: message.chatId,
      messageId,
      scope: "everyone",
      deletedForEveryone: true,
      createdAt: updated.createdAt,
      senderId: message.senderId,
    });

    return res.status(200).json({
      message: "Message deleted for everyone",
      scope: "everyone",
      messageId,
      chatId: message.chatId,
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete message");
  }
};

/* =========================================================
   CLEAR CHAT (delete all messages, keep conversation)
========================================================= */

export const clearChat = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);
  const chatId = normalizeId(req.params.id);

  try {
    if (!tokenUserId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if (!isValidObjectId(chatId)) {
      return res.status(400).json({
        message: "Invalid chat ID",
      });
    }

    const chat = await findChatWithParticipants(chatId);

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    if (!isChatMember(chat, tokenUserId)) {
      return res.status(403).json({
        message: "You are not authorized to clear this chat",
      });
    }

    await prisma.message.deleteMany({
      where: {
        chatId,
      },
    });

    await prisma.chat.update({
      where: {
        id: chatId,
      },
      data: {
        lastMessage: "",
        lastMessageAt: null,
      },
    });

    const refreshed = await prisma.chat.findUnique({
      where: { id: chatId },
      include: chatInclude,
    });

    return res.status(200).json({
      message: "Chat cleared",
      chat: enrichChats([refreshed], tokenUserId)[0],
    });
  } catch (error) {
    return handleError(res, error, "Failed to clear chat");
  }
};

/* =========================================================
   DELETE CHAT
========================================================= */

export const deleteChat = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);
  const chatId = normalizeId(req.params.id);

  try {
    if (!tokenUserId) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    if (!isValidObjectId(chatId)) {
      return res.status(400).json({
        message: "Invalid chat ID",
      });
    }

    const chat = await findChatWithParticipants(chatId);

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    if (!isChatMember(chat, tokenUserId)) {
      return res.status(403).json({
        message: "You are not authorized to delete this chat",
      });
    }

    await prisma.message.deleteMany({
      where: {
        chatId,
      },
    });

    await prisma.chatParticipant.deleteMany({
      where: {
        chatId,
      },
    });

    await prisma.chat.delete({
      where: {
        id: chatId,
      },
    });

    return res.status(200).json({
      message: "Chat deleted successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete chat");
  }
};

const visitorFromSupportChat = (chat) => {
  const users = Array.isArray(chat?.participants)
    ? chat.participants.map((item) => item.user).filter(Boolean)
    : [];

  return (
    users.find((user) => String(user.role || "").toUpperCase() !== "ADMIN") ||
    users[0] ||
    null
  );
};

export const getOrCreateSupportChat = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);

  try {
    if (!tokenUserId || !isValidObjectId(tokenUserId)) {
      return res.status(401).json({
        message: "Not authenticated",
      });
    }

    const me = await prisma.user.findUnique({
      where: { id: tokenUserId },
      select: { id: true, role: true, status: true },
    });

    if (!me || me.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Your account is not active",
      });
    }

    if (String(me.role || "").toUpperCase() === "ADMIN") {
      return res.status(400).json({
        message: "Admins reply from the office",
      });
    }

    const existing = await prisma.chat.findFirst({
      where: {
        kind: "SUPPORT",
        participants: {
          some: {
            userId: tokenUserId,
          },
        },
      },
      include: chatInclude,
    });

    if (existing) {
      return res.status(200).json(enrichChats([existing], tokenUserId)[0]);
    }

    const admins = await prisma.user.findMany({
      where: {
        role: "ADMIN",
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!admins.length) {
      return res.status(503).json({
        message: "Support is unavailable right now",
      });
    }

    const participantIds = uniqueIds([
      tokenUserId,
      ...admins.map((admin) => admin.id),
    ]);

    const created = await prisma.chat.create({
      data: {
        kind: "SUPPORT",
        participants: {
          create: participantIds.map((userId) => ({ userId })),
        },
      },
      include: chatInclude,
    });

    return res.status(201).json(enrichChats([created], tokenUserId)[0]);
  } catch (error) {
    return handleError(res, error, "Failed to open support chat");
  }
};

export const getAdminSupportChats = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);

  try {
    const chats = await prisma.chat.findMany({
      where: {
        kind: "SUPPORT",
      },
      include: {
        participants: {
          include: {
            user: {
              select: safeUserSelect,
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          include: {
            sender: {
              select: safeUserSelect,
            },
          },
        },
      },
      orderBy: [
        { lastMessageAt: "desc" },
        { updatedAt: "desc" },
      ],
    });

    const list = enrichChats(chats, tokenUserId).map((chat) => {
      const raw = chats.find((item) => item.id === chat.id);
      const visitor = visitorFromSupportChat(raw || chat);

      return {
        ...chat,
        visitor,
        visitorId: visitor?.id || "",
      };
    });

    return res.status(200).json(list);
  } catch (error) {
    return handleError(res, error, "Failed to load support chats");
  }
};

export const getAdminSupportChat = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);
  const chatId = normalizeId(req.params.id);

  try {
    if (!isValidObjectId(chatId)) {
      return res.status(400).json({
        message: "Invalid chat ID",
      });
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: chatInclude,
    });

    if (!chat || !isSupportChat(chat)) {
      return res.status(404).json({
        message: "Support chat not found",
      });
    }

    await allowSupportAdmin(chat, tokenUserId);

    const formatted = enrichChats([chat], tokenUserId)[0];
    formatted.visitor = visitorFromSupportChat(chat);

    return res.status(200).json(formatted);
  } catch (error) {
    return handleError(res, error, "Failed to load support chat");
  }
};
