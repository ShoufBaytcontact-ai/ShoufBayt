import prisma from "../lib/prisma.js";
import { broadcastMessage } from "../lib/realtime.js";
import { upsertChatNotification } from "../lib/notify.js";
import {
  sanitizeMessageText,
  isSafeChatMediaUrl,
  buildChatUploadUrl,
  previewForLastMessage,
} from "../lib/chatSecurity.js";
import { classifyChatMime } from "../middleware/chatUpload.js";
import { allowSupportAdmin } from "../lib/supportChatAccess.js";
import { getStoredFileUrl } from "../lib/cloudStorage.js";

const safeUserSelect = {
  id: true,
  username: true,
  email: true,
  avatar: true,
  role: true,
  status: true,
};

const isValidObjectId = (id) => {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
};

const normalizeId = (id) => {
  return String(id || "").trim();
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

const getChatUserIds = (chat) => {
  if (Array.isArray(chat?.participants)) {
    return chat.participants
      .map((participant) => normalizeId(participant.userId))
      .filter(Boolean);
  }

  if (Array.isArray(chat?.userIDs)) {
    return chat.userIDs.map((id) => normalizeId(id)).filter(Boolean);
  }

  return [];
};

const getReceiverId = (chat, currentUserId) => {
  const cleanCurrentUserId = normalizeId(currentUserId);

  return (
    getChatUserIds(chat).find((id) => id && id !== cleanCurrentUserId) || ""
  );
};

const isChatMember = (chat, userId) => {
  const cleanUserId = normalizeId(userId);
  return getChatUserIds(chat).includes(cleanUserId);
};

const formatMessage = (message, receiverId = "", receiver = null) => {
  if (!message) {
    return null;
  }

  const senderId = normalizeId(message.senderId);
  const cleanReceiverId = normalizeId(receiverId);
  const mediaUrl = message.mediaUrl || message.image || null;
  const mediaKind =
    message.mediaKind ||
    (message.image || message.mediaUrl ? "image" : null);

  return {
    id: message.id,
    _id: message.id,

    chatId: message.chatId,

    text: message.text || "",
    image: mediaKind === "image" ? mediaUrl : message.image || null,

    mediaUrl,
    mediaKind,
    mediaName: message.mediaName || null,
    mediaMime: message.mediaMime || null,

    senderId,
    userId: senderId,
    receiverId: cleanReceiverId,

    isRead: message.isRead ?? false,
    readAt: message.readAt || null,

    createdAt: message.createdAt,

    sender: message.sender || null,
    user: message.sender || null,
    receiver,
  };
};

export const addMessage = async (req, res) => {
  const tokenUserId = normalizeId(req.userId);

  const chatId = normalizeId(
    req.body.chatId || req.params.chatId || req.params.id
  );

  const text = sanitizeMessageText(req.body.text);
  const requestedKind = String(req.body.mediaKind || "")
    .toLowerCase()
    .trim();

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

    if (!chatId || !isValidObjectId(chatId)) {
      return res.status(400).json({
        message: "Invalid chat ID",
      });
    }

    let mediaUrl = null;
    let mediaKind = null;
    let mediaName = null;
    let mediaMime = null;
    let image = null;

    if (req.file) {
      mediaMime = String(req.file.mimetype || "").toLowerCase();
      mediaKind = classifyChatMime(mediaMime);

      if (requestedKind === "voice" && mediaKind !== "voice") {
        return res.status(400).json({
          message: "Voice notes must be an audio file",
        });
      }

      if (requestedKind === "file" && mediaKind === "voice") {
        return res.status(400).json({
          message: "Use the voice recorder for audio notes",
        });
      }

      if (requestedKind === "image" && mediaKind !== "image") {
        return res.status(400).json({
          message: "Only image files are allowed for image messages",
        });
      }

      if (!mediaKind) {
        return res.status(400).json({
          message: "Unsupported media type",
        });
      }

      if (requestedKind === "file" && mediaKind === "image") {
        mediaKind = "file";
      }

      mediaUrl = getStoredFileUrl(req, req.file);
      if (!mediaUrl) {
        return res.status(503).json({
          message: "Cloud upload failed. Check Cloudflare R2 settings.",
        });
      }
      mediaName =
        req.file.cleanedOriginalName ||
        String(req.file.originalname || "file").slice(0, 120);

      if (mediaKind === "image") {
        image = mediaUrl;
      }
    } else if (req.body.image) {
      const candidate = String(req.body.image || "").trim();
      if (!isSafeChatMediaUrl(candidate, req)) {
        return res.status(400).json({
          message:
            "External image links are blocked. Please upload the file instead.",
        });
      }
      mediaUrl = candidate;
      mediaKind = "image";
      image = candidate;
    }

    if (!text && !mediaUrl) {
      return res.status(400).json({
        message: "Message text or attachment is required",
      });
    }

    const chat = await prisma.chat.findUnique({
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

    if (!chat) {
      return res.status(404).json({
        message: "Chat not found",
      });
    }

    if (!isChatMember(chat, tokenUserId)) {
      const allowed = await allowSupportAdmin(chat, tokenUserId);
      if (!allowed) {
        return res.status(403).json({
          message: "Not authorized to send a message in this chat",
        });
      }
    }

    const otherIds = getChatUserIds(chat).filter((id) => id !== tokenUserId);

    if (otherIds.length === 0) {
      return res.status(400).json({
        message: "Could not find the receiver of this chat",
      });
    }

    const [sender, receivers] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: tokenUserId,
        },
        select: safeUserSelect,
      }),
      prisma.user.findMany({
        where: {
          id: {
            in: otherIds,
          },
        },
        select: safeUserSelect,
      }),
    ]);

    if (!sender) {
      return res.status(404).json({
        message: "Sender user not found",
      });
    }

    if (sender.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Your account is not active",
      });
    }

    if (!receivers.length) {
      return res.status(404).json({
        message: "Receiver user not found",
      });
    }

    const activeReceivers = receivers.filter(
      (user) => user.status === "ACTIVE"
    );

    if (activeReceivers.length === 0) {
      return res.status(400).json({
        message: "The receiver is not available",
      });
    }

    const receiverIds = activeReceivers.map((user) => normalizeId(user.id));
    const receiver = activeReceivers[0] || null;
    const receiverId = receiverIds[0] || "";

    const message = await prisma.message.create({
      data: {
        chatId,
        senderId: tokenUserId,
        text: text || null,
        image: image || null,
        mediaUrl: mediaUrl || null,
        mediaKind: mediaKind || null,
        mediaName: mediaName || null,
        mediaMime: mediaMime || null,
        isRead: false,
      },
      include: {
        sender: {
          select: safeUserSelect,
        },
      },
    });

    const lastMessage = previewForLastMessage({
      text,
      mediaKind,
      mediaName,
    });

    await prisma.chat.update({
      where: {
        id: chatId,
      },
      data: {
        lastMessage,
        lastMessageAt: new Date(),
      },
    });

    const notifPreview = lastMessage || "New message";
    const isSupport =
      String(chat.kind || chat.kind || "").toUpperCase() === "SUPPORT";
    const senderName = sender.username || "someone";
    const senderRole = String(sender.role || "").toUpperCase();
    const supportLinkFor = (userId) => {
      const role = String(
        activeReceivers.find((user) => normalizeId(user.id) === userId)?.role ||
          ""
      ).toUpperCase();
      return role === "ADMIN" ? "/admin" : "/?support=1";
    };

    await Promise.all(
      receiverIds.map((userId) =>
        upsertChatNotification({
          userId,
          title: isSupport
            ? senderRole === "ADMIN"
              ? "Support replied"
              : "New support message"
            : `New message from ${senderName}`,
          message: notifPreview.slice(0, 120),
          link: isSupport ? supportLinkFor(userId) : `/chat/${chatId}`,
          metadata: {
            chatId,
            senderId: tokenUserId,
            messageId: message.id,
            support: isSupport,
          },
        })
      )
    );

    const formatted = formatMessage(message, receiverId, receiver);

    broadcastMessage({
      receiverId,
      receiverIds,
      senderId: tokenUserId,
      data: formatted,
    });

    return res.status(201).json(formatted);
  } catch (error) {
    return handleError(res, error, "Failed to send message");
  }
};
