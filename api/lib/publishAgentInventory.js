import prisma from "./prisma.js";

export const publishAgentInventoryListings = async (userId) => {
  if (!userId) {
    return 0;
  }

  const result = await prisma.property.updateMany({
    where: {
      userId,
      status: "PENDING",
    },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  return result.count || 0;
};

export const publishAllAgentInventoryListings = async () => {
  const pending = await prisma.property.findMany({
    where: {
      status: "PENDING",
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!pending.length) {
    return 0;
  }

  const ownerIds = [...new Set(pending.map((item) => item.userId))];
  const agents = await prisma.user.findMany({
    where: {
      id: {
        in: ownerIds,
      },
      role: {
        in: ["AGENT", "ADMIN"],
      },
    },
    select: {
      id: true,
    },
  });
  const agentIds = new Set(agents.map((agent) => agent.id));
  const ids = pending
    .filter((item) => agentIds.has(item.userId))
    .map((item) => item.id);

  if (!ids.length) {
    return 0;
  }

  await prisma.property.updateMany({
    where: {
      id: {
        in: ids,
      },
    },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  return ids.length;
};
