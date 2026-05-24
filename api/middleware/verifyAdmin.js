import prisma from "../lib/prisma.js";

export const shouldBeAdmin = async (req, res, next) => {
  const tokenUserId = req.userId;

  try {
    const user = await prisma.user.findUnique({
      where: {
        id: tokenUserId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin access only" });
    }

    next();
  } catch (error) {
    console.log("ADMIN CHECK ERROR:", error);
    res.status(500).json({ message: "Failed to verify admin" });
  }
};