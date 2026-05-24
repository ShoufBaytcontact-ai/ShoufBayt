import prisma from "../lib/prisma.js";

const email = process.argv[2];

if (!email) {
  console.log("Please provide an email.");
  console.log("Example: node scripts/makeAdmin.js 22230690@students.liu.edu.lb");
  process.exit(1);
}

try {
  const user = await prisma.user.update({
    where: {
      email,
    },
    data: {
      role: "ADMIN",
    },
  });

  console.log("Admin user updated successfully:");
  console.log({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });
} catch (error) {
  console.log("Failed to make admin:");
  console.log(error.message);
}

process.exit();