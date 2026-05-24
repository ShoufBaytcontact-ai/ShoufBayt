import prisma from "../lib/prisma.js";

export const getChats = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const chats = await prisma.chat.findMany({
      where: {
        userIDs: {
          has: tokenUserId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const chatsWithReceiver = await Promise.all(
      chats.map(async (chat) => {
        const receiverId = chat.userIDs?.find((id) => id !== tokenUserId);

        let receiver = null;

        if (receiverId) {
          receiver = await prisma.user.findUnique({
            where: {
              id: receiverId,
            },
            select: {
              id: true,
              username: true,
              avatar: true,
            },
          });
        }

        return {
          ...chat,
          receiver,
          seenBy: chat.seenBy || [],
        };
      })
    );

    res.status(200).json(chatsWithReceiver);
  } catch (error) {
    console.log("GET CHATS ERROR:", error);
    res.status(500).json({ message: "Failed to get chats" });
  }
};

export const getChat = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const chat = await prisma.chat.findFirst({
      where: {
        id: req.params.id,
        userIDs: {
          has: tokenUserId,
        },
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const seenBy = chat.seenBy || [];

    if (!seenBy.includes(tokenUserId)) {
      await prisma.chat.update({
        where: {
          id: req.params.id,
        },
        data: {
          seenBy: {
            push: tokenUserId,
          },
        },
      });
    }

    res.status(200).json({
      ...chat,
      seenBy: seenBy.includes(tokenUserId)
        ? seenBy
        : [...seenBy, tokenUserId],
    });
  } catch (error) {
    console.log("GET CHAT ERROR:", error);
    res.status(500).json({ message: "Failed to get chat" });
  }
};

export const addChat = async (req, res) => {
  const tokenUserId = req.userId;
  const { receiverId } = req.body;

  try {
    if (!receiverId) {
      return res.status(400).json({ message: "Receiver ID is required" });
    }

    if (receiverId === tokenUserId) {
      return res.status(400).json({ message: "You cannot chat with yourself" });
    }

    const receiver = await prisma.user.findUnique({
      where: {
        id: receiverId,
      },
      select: {
        id: true,
        username: true,
        avatar: true,
      },
    });

    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const existingChat = await prisma.chat.findFirst({
      where: {
        userIDs: {
          hasEvery: [tokenUserId, receiverId],
        },
      },
    });

    if (existingChat) {
      return res.status(200).json({
        ...existingChat,
        receiver,
        seenBy: existingChat.seenBy || [],
      });
    }

    const newChat = await prisma.chat.create({
      data: {
        userIDs: [tokenUserId, receiverId],
        seenBy: [tokenUserId],
      },
    });

    res.status(201).json({
      ...newChat,
      receiver,
    });
  } catch (error) {
    console.log("ADD CHAT ERROR:", error);
    res.status(500).json({ message: "Failed to add chat" });
  }
};

export const readChat = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const chat = await prisma.chat.findFirst({
      where: {
        id: req.params.id,
        userIDs: {
          has: tokenUserId,
        },
      },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const seenBy = chat.seenBy || [];

    if (!seenBy.includes(tokenUserId)) {
      await prisma.chat.update({
        where: {
          id: req.params.id,
        },
        data: {
          seenBy: {
            push: tokenUserId,
          },
        },
      });
    }

    res.status(200).json({ message: "Chat marked as read" });
  } catch (error) {
    console.log("READ CHAT ERROR:", error);
    res.status(500).json({ message: "Failed to read chat" });
  }
};