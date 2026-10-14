import "../lib/loadEnv.js";
import prisma from "../lib/prisma.js";

const oid = (id) => ({ $oid: id });

const runRaw = async (command) => {
  try {
    return await prisma.$runCommandRaw(command);
  } catch (error) {
    const message = String(error?.message || error);
    if (
      message.includes("ns not found") ||
      message.includes("IndexNotFound") ||
      message.includes("index not found")
    ) {
      return null;
    }
    throw error;
  }
};

const main = async () => {
  const profiles = await prisma.agentProfile.findMany({
    select: { userId: true },
  });
  const profileUserIds = profiles.map((profile) => profile.userId).filter(Boolean);

  const restored = profileUserIds.length
    ? await prisma.user.updateMany({
        where: {
          id: { in: profileUserIds },
          role: "USER",
        },
        data: { role: "AGENT" },
      })
    : { count: 0 };

  const agents = await prisma.user.findMany({
    where: {
      role: { in: ["AGENT", "ADMIN"] },
    },
    select: { id: true },
  });
  const agentIds = agents.map((agent) => oid(agent.id));

  let republished = 0;
  if (agentIds.length) {
    const result = await runRaw({
      update: "Property",
      updates: [
        {
          q: {
            userId: { $in: agentIds },
            pausedBySubscription: true,
            status: "ARCHIVED",
          },
          u: {
            $set: {
              status: "PUBLISHED",
              publishedAt: { $date: new Date().toISOString() },
            },
            $unset: { pausedBySubscription: "" },
          },
          multi: true,
        },
      ],
    });
    republished = Number(result?.nModified || result?.n || 0);
  }

  await runRaw({
    update: "Property",
    updates: [
      {
        q: { pausedBySubscription: { $exists: true } },
        u: { $unset: { pausedBySubscription: "" } },
        multi: true,
      },
    ],
  });

  await runRaw({
    update: "User",
    updates: [
      {
        q: {},
        u: {
          $unset: {
            premiumTrialClaimed: "",
            stripeCustomerId: "",
            stripePaymentMethodId: "",
          },
        },
        multi: true,
      },
    ],
  });

  const deletedNotes = await runRaw({
    delete: "Notification",
    deletes: [
      {
        q: {
          type: {
            $in: [
              "SUBSCRIPTION_EXPIRING",
              "SUBSCRIPTION_EXPIRED",
              "PAYMENT_CONFIRMED",
              "PAYMENT_FAILED",
            ],
          },
        },
        limit: 0,
      },
    ],
  });

  await runRaw({ drop: "Subscription" });
  await runRaw({ drop: "Payment" });
  await runRaw({
    dropIndexes: "User",
    index: "User_stripeCustomerId_unique",
  });

  console.log(
    JSON.stringify(
      {
        agentsRestored: restored.count,
        listingsRepublished: republished,
        billingNotificationsDeleted: Number(deletedNotes?.n || 0),
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
