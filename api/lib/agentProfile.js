import prisma from "./prisma.js";

/**
 * Every AGENT needs an AgentProfile row. Role changes and older accounts
 * can miss it, which blocks the Agent Hub with "Agent profile required".
 */
export const ensureAgentProfile = async (userId, db = prisma) => {
  if (!userId) {
    return null;
  }

  const existing = await db.agentProfile.findUnique({
    where: { userId },
  });

  if (existing) {
    if (existing.isVerified) {
      return existing;
    }

    return db.agentProfile.update({
      where: { id: existing.id },
      data: { isVerified: true },
    });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      avatar: true,
      role: true,
    },
  });

  if (!user || String(user.role).toUpperCase() !== "AGENT") {
    return null;
  }

  const application = await db.agentApplication.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const name = application?.fullName || user.username || "ShoufBayt Agent";
  const location = application?.location || "";

  return db.agentProfile.upsert({
    where: { userId },
    update: {
      isVerified: true,
    },
    create: {
      userId,
      name,
      agencyName: application?.agencyName || null,
      title: application?.agencyName || "Real Estate Agent",
      phone: application?.phone || "",
      location,
      bio: application?.bio || "ShoufBayt agent",
      image: application?.image || user.avatar || null,
      isVerified: true,
      serviceAreas: location ? [location] : [],
    },
  });
};

/** Active agents may list and take leads. Admins pass through without an agent profile. */
export const requireActiveAgent = async (userId, db = prisma) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      status: true,
    },
  });

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (user.role === "ADMIN") {
    return { user, allowed: true };
  }

  if (user.role !== "AGENT" || user.status !== "ACTIVE") {
    const error = new Error("Only active agents can perform this action");
    error.status = 403;
    throw error;
  }

  return { user, allowed: true };
};
