import prisma from "../lib/prisma.js";

export const createContactMessage = async (req, res) => {
  const { name, email, subject, message, type } = req.body;

  try {
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const contactMessage = await prisma.contactMessage.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        type: type === "REPORT" ? "REPORT" : "MESSAGE",
        userId: req.userId || null,
      },
    });

    return res.status(201).json({
      message: "Message sent successfully",
      contactMessage,
    });
  } catch (error) {
    console.log("CREATE CONTACT MESSAGE ERROR:", error);

    return res.status(500).json({
      message: "Failed to send message",
      error: error.message,
    });
  }
};

export const getMyContactMessages = async (req, res) => {
  const userId = req.userId;

  try {
    const messages = await prisma.contactMessage.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(messages);
  } catch (error) {
    console.log("GET MY CONTACT MESSAGES ERROR:", error);

    return res.status(500).json({
      message: "Failed to get your contact messages",
      error: error.message,
    });
  }
};