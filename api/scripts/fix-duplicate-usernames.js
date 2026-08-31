import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byUsername = new Map();

  for (const user of users) {
    const key = user.username.toLowerCase();
    if (!byUsername.has(key)) byUsername.set(key, []);
    byUsername.get(key).push(user);
  }

  const duplicates = [...byUsername.entries()].filter(([, group]) => group.length > 1);

  if (duplicates.length === 0) {
    console.log("No duplicate usernames found.");
    return;
  }

  console.log(`Found ${duplicates.length} duplicate username group(s):\n`);

  for (const [username, group] of duplicates) {
    console.log(`"${username}" (${group.length} users)`);

    // Keep the oldest account; rename the rest
    const [, ...toRename] = group;

    for (let i = 0; i < toRename.length; i++) {
      const user = toRename[i];
      const newUsername = `${user.username}_${user.id.slice(-6)}`;

      await prisma.user.update({
        where: { id: user.id },
        data: { username: newUsername },
      });

      console.log(`  kept: ${group[0].email}`);
      console.log(`  renamed: ${user.email} -> ${newUsername}`);
    }
  }

  console.log("\nDone. You can run: npx prisma db push");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
