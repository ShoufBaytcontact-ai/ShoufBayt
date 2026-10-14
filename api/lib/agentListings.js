import prisma from "./prisma.js";
import { isValidObjectId } from "./text.js";

/** Hide live listings when someone is no longer an agent. */
export const archiveListingsForFormerAgent = async (userId, db = prisma) => {
  if (!isValidObjectId(userId)) {
    return;
  }

  await db.property.updateMany({
    where: {
      userId,
      status: "PUBLISHED",
    },
    data: {
      status: "ARCHIVED",
    },
  });
};

export const restoreAgentListings = async (userId, db = prisma) => {
  if (!isValidObjectId(userId)) {
    return;
  }

  await db.property.updateMany({
    where: {
      userId,
      status: "ARCHIVED",
    },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  await db.property.updateMany({
    where: {
      userId,
      status: "PENDING",
    },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      rejectionReason: null,
    },
  });
};
