import prisma from "../lib/prisma.js";

const email = process.argv[2];

if (!email) {
  console.log("Please provide the user email.");
  console.log("Example:");
  console.log("node scripts/makeAgent.js ha465mza@gmail.com");
  process.exit(1);
}

const agentProfileData = {
  name: "Hamza Farhat",
  title: "Senior Real Estate Agent",
  phone: "+961 70 123 456",
  location: "Beirut, Lebanon",
  bio: "Professional real estate agent helping users buy, rent, and manage properties with confidence.",
  image: "https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg",
};

try {
  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    console.log("No user found with this email:");
    console.log(email);
    process.exit(1);
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      role: "AGENT",
    },
  });

  const agentProfile = await prisma.agentProfile.upsert({
    where: {
      userId: user.id,
    },
    update: agentProfileData,
    create: {
      ...agentProfileData,
      userId: user.id,
    },
  });

  console.log("Agent created successfully:");
  console.log({
    id: updatedUser.id,
    username: updatedUser.username,
    email: updatedUser.email,
    role: updatedUser.role,
    agentProfile,
  });
} catch (error) {
  console.log("Failed to create agent:");
  console.log(error.message);
}

process.exit();