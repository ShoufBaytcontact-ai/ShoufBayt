import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Old Mongo documents sometimes have null/missing updatedAt, or orphan
 * AgentProfile rows whose User was deleted. Prisma refuses to read them.
 *
 * Via $runCommandRaw, JS Date values serialize as strings — use Extended
 * JSON `{ $date: "..." }` so Mongo stores real BSON dates.
 */

const COLLECTIONS_WITH_UPDATED_AT = [
  "User",
  "AgentApplication",
  "AgentProfile",
  "Property",
  "PropertyDetail",
  "SavedProperty",
  "Chat",
  "ChatParticipant",
  "Message",
  "ContactMessage",
  "Subscription",
  "Payment",
  "Notification",
  "PropertyReview",
  "AgentReview",
  "PropertyReport",
  "VerificationCode",
];

const DATE_FIELDS = ["createdAt", "updatedAt"];

function bsonDate(value = new Date()) {
  const iso =
    value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  return { $date: iso };
}

/** Normalize Mongo Extended JSON / ObjectId values to a hex string. */
function idStr(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (value.$oid) return String(value.$oid);
    if (typeof value.toHexString === "function") return value.toHexString();
  }
  return String(value);
}

async function findAll(collection, filter = {}, projection = null) {
  const command = {
    find: collection,
    filter,
  };

  if (projection) {
    command.projection = projection;
  }

  const result = await prisma.$runCommandRaw(command);
  return result?.cursor?.firstBatch || [];
}

async function listCollectionNames() {
  const result = await prisma.$runCommandRaw({ listCollections: 1 });
  const names = (result?.cursor?.firstBatch || []).map((c) => c.name);
  return names;
}

function resolveCollectionName(wanted, available) {
  if (available.includes(wanted)) return wanted;
  const lower = wanted.toLowerCase();
  const match = available.find((n) => n.toLowerCase() === lower);
  return match || wanted;
}

async function fixNullUpdatedAt(collection) {
  const now = bsonDate();

  const result = await prisma.$runCommandRaw({
    update: collection,
    updates: [
      {
        q: {
          $or: [{ updatedAt: null }, { updatedAt: { $exists: false } }],
        },
        u: {
          $set: {
            updatedAt: now,
          },
        },
        multi: true,
      },
    ],
  });

  const modified =
    result?.nModified ?? result?.n ?? result?.modifiedCount ?? 0;

  if (modified > 0) {
    console.log(`  ${collection}: fixed ${modified} null/missing updatedAt`);
  }

  return modified;
}

/**
 * Convert ISO/string date fields to BSON Date so Prisma can read them.
 * Also covers values previously written incorrectly by this script.
 */
async function fixStringDates(collection) {
  const docs = await findAll(collection);
  let fixed = 0;

  for (const doc of docs) {
    const set = {};

    for (const field of DATE_FIELDS) {
      const value = doc[field];
      if (typeof value === "string" && value.trim() !== "") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          set[field] = bsonDate(parsed);
        }
      }
    }

    if (Object.keys(set).length === 0) continue;

    await prisma.$runCommandRaw({
      update: collection,
      updates: [
        {
          q: { _id: doc._id },
          u: { $set: set },
          multi: false,
        },
      ],
    });

    fixed += 1;
  }

  if (fixed > 0) {
    console.log(`  ${collection}: converted ${fixed} string date document(s)`);
  }

  return fixed;
}

async function fixOrphanAgentProfiles(agentCollection, userCollection) {
  const users = await findAll(userCollection, {}, { _id: 1 });
  const userIds = new Set(users.map((user) => idStr(user._id)));

  const agents = await findAll(agentCollection, {}, { _id: 1, userId: 1 });
  let removed = 0;

  for (const agent of agents) {
    const userId = idStr(agent.userId);

    if (!userId || !userIds.has(userId)) {
      await prisma.$runCommandRaw({
        delete: agentCollection,
        deletes: [
          {
            q: { _id: agent._id },
            limit: 1,
          },
        ],
      });

      removed += 1;
      console.log(
        `  AgentProfile ${idStr(agent._id)} removed (missing user ${userId || "n/a"})`
      );
    }
  }

  if (removed === 0) {
    console.log("  No orphan agent profiles found.");
  }

  return removed;
}

async function verifyReads() {
  const users = await prisma.user.findMany({ take: 1 });
  const messages = await prisma.contactMessage.findMany({ take: 1 });
  const agents = await prisma.agentProfile.findMany({
    take: 5,
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });

  console.log(
    `Verify OK — users sample: ${users.length}, messages: ${messages.length}, agents: ${agents.length}`
  );
}

async function main() {
  const available = await listCollectionNames();
  console.log(`Collections found: ${available.join(", ") || "(none)"}`);

  const resolved = COLLECTIONS_WITH_UPDATED_AT.map((name) =>
    resolveCollectionName(name, available)
  ).filter((name, index, arr) => arr.indexOf(name) === index);

  console.log("\nFixing null updatedAt fields...");

  let totalNull = 0;
  let totalString = 0;

  for (const collection of resolved) {
    if (!available.includes(collection)) {
      console.log(`  ${collection}: skipped (collection missing)`);
      continue;
    }

    try {
      totalNull += await fixNullUpdatedAt(collection);
      totalString += await fixStringDates(collection);
    } catch (error) {
      if (!String(error.message || "").includes("ns does not exist")) {
        console.log(`  ${collection}: skipped (${error.message})`);
      }
    }
  }

  console.log(`\nUpdatedAt null fixes: ${totalNull}`);
  console.log(`String date conversions: ${totalString}`);

  const userCol = resolveCollectionName("User", available);
  const agentCol = resolveCollectionName("AgentProfile", available);

  console.log("\nRemoving orphan agent profiles...");
  if (available.includes(userCol) && available.includes(agentCol)) {
    await fixOrphanAgentProfiles(agentCol, userCol);
  } else {
    console.log("  Skipped (User or AgentProfile collection missing).");
  }

  console.log("\nVerifying Prisma reads...");
  await verifyReads();

  console.log("\nDone. Restart the API and reload the admin page.");
}

main()
  .catch((error) => {
    console.error("Fix failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
