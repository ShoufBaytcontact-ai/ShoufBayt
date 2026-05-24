import prisma from "../lib/prisma.js";

export const addMessage = async (req, res) => {
  const tokenUserId = req.userId;
  const { chatId, text } = req.body;

  try {
    if (!chatId || !text) {
      return res.status(400).json({ message: "Chat ID and text are required" });
    }

    const chat = await prisma.chat.findFirst({
      where: {
        id: chatId,
        userIDs: {
          has: tokenUserId,
        },
      },
    });

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const message = await prisma.message.create({
      data: {
        text,
        chatId,
        userId: tokenUserId,
      },
    });

    await prisma.chat.update({
      where: {
        id: chatId,
      },
      data: {
        seenBy: [tokenUserId],
        lastMessage: text,
      },
    });

    res.status(201).json(message);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to add message" });
  }
};