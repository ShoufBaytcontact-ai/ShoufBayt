import prisma from "./prisma.js";
import { toPhoneKey } from "./phone.js";

const createSparseUniqueIndex = async (collection, name, key) => {
  try {
    await prisma.$runCommandRaw({
      createIndexes: collection,
      indexes: [
        {
          name,
          key,
          unique: true,
          sparse: true,
        },
      ],
    });
  } catch (error) {
    const message = String(error?.message || error);
    if (
      message.includes("already exists") ||
      message.includes("IndexOptionsConflict") ||
      message.includes("IndexKeySpecsConflict")
    ) {
      return;
    }

    if (message.includes("E11000") || message.includes("duplicate key")) {
      console.warn(
        `UNIQUE INDEX skipped for ${collection}.${Object.keys(key).join(",")}: existing duplicates must be cleaned first`
      );
      return;
    }

    console.error(`UNIQUE INDEX failed for ${collection}.${name}:`, message);
  }
};

const backfillPhoneKeys = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      phone: true,
      pendingPhone: true,
      agentProfile: {
        select: {
          phone: true,
        },
      },
    },
  });

  const used = new Map();

  for (const user of users) {
    const key =
      toPhoneKey(user.phone) ||
      toPhoneKey(user.pendingPhone) ||
      toPhoneKey(user.agentProfile?.phone);

    if (!key) continue;

    const ownerId = used.get(key);
    if (ownerId && ownerId !== user.id) {
      console.warn(
        `PHONE KEY duplicate skipped for user ${user.id}; already used by ${ownerId}`
      );
      continue;
    }

    used.set(key, user.id);

    try {
      await prisma.$runCommandRaw({
        update: "User",
        updates: [
          {
            q: { _id: { $oid: user.id } },
            u: { $set: { phoneKey: key } },
          },
        ],
      });
    } catch (error) {
      console.warn(`PHONE KEY backfill failed for ${user.id}:`, error?.message || error);
    }
  }
};

export const ensureUniqueIndexes = async () => {
  await backfillPhoneKeys();

  await createSparseUniqueIndex("User", "User_phoneKey_unique", {
    phoneKey: 1,
  });
  await createSparseUniqueIndex("User", "User_stripeCustomerId_unique", {
    stripeCustomerId: 1,
  });
  await createSparseUniqueIndex("Payment", "Payment_transactionId_unique", {
    transactionId: 1,
  });
};
