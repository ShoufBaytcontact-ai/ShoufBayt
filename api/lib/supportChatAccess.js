import prisma from "./prisma.js";

export function isSupportChat(chat) {
  return String(chat?.kind || "").toUpperCase() === "SUPPORT";
}

export async function allowSupportAdmin(chat, userId) {
  if (!isSupportChat(chat) || !userId) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });

  if (String(user?.role || "").toUpperCase() !== "ADMIN") {
    return false;
  }

  if (user.status && user.status !== "ACTIVE") {
    return false;
  }

  const already = (chat.participants || []).some((participant) => {
    return String(participant.userId || participant.user?.id || "") === String(userId);
  });

  if (already) {
    return true;
  }

  try {
    await prisma.chatParticipant.create({
      data: {
        chatId: chat.id,
        userId,
      },
    });
  } catch (err) {
    if (err?.code !== "P2002") {
      throw err;
    }
  }

  if (Array.isArray(chat.participants)) {
    chat.participants.push({ userId });
  }

  return true;
}
