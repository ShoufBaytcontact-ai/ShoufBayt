import prisma from "../lib/prisma.js";

try {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
    },
  });

  console.log("Users found:", users.length);
  console.table(users);
} catch (error) {
  console.log("Failed to list users:");
  console.log(error);
}

process.exit();