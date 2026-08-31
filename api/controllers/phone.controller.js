import prisma from "../lib/prisma.js";
import { cleanPhone, isValidPhone, phoneUpdateFields } from "../lib/phone.js";
import {
  UniqueConflictError,
  sendUniqueConflict,
  uniqueTargetMessage,
  assertPhoneAvailable,
} from "../lib/uniqueFields.js";

const stripPassword = (user) => {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
};

const syncAgentPhone = async (userId, phone) => {
  await prisma.agentProfile.updateMany({
    where: { userId },
    data: { phone },
  });
};

export const savePhone = async (req, res) => {
  try {
    const userId = req.userId;
    const phone = cleanPhone(req.body.phone);

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        message:
          "Enter the required digits for the selected country, without the country code",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.phone === phone) {
      return res.status(200).json(stripPassword(user));
    }

    await assertPhoneAvailable(phone, userId);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: phoneUpdateFields(phone),
      include: { agentProfile: true },
    });

    await syncAgentPhone(userId, phone);

    return res.status(200).json(stripPassword(updatedUser));
  } catch (error) {
    console.log("SAVE PHONE ERROR:", error);

    if (sendUniqueConflict(res, error)) {
      return;
    }

    if (error.code === "P2002") {
      return res.status(400).json({
        message: uniqueTargetMessage(error),
      });
    }

    return res.status(500).json({
      message: "Failed to save phone number",
    });
  }
};
