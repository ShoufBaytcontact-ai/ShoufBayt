import prisma from "../lib/prisma.js";

export const getAdminStats = async (req, res) => {
  try {
    const usersCount = await prisma.user.count();
    const postsCount = await prisma.post.count();
    const chatsCount = await prisma.chat.count();
    const messagesCount = await prisma.message.count();
    const savedPostsCount = await prisma.savedPost.count();
    const contactMessagesCount = await prisma.contactMessage.count();

    const openContactMessagesCount = await prisma.contactMessage.count({
      where: {
        status: "OPEN",
      },
    });

    res.status(200).json({
      usersCount,
      postsCount,
      chatsCount,
      messagesCount,
      savedPostsCount,
      contactMessagesCount,
      openContactMessagesCount,
    });
  } catch (error) {
    console.log("GET ADMIN STATS ERROR:", error);
    res.status(500).json({ message: "Failed to get admin stats" });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            savedPosts: true,
            messages: true,
          },
        },
      },
    });

    res.status(200).json(users);
  } catch (error) {
    console.log("GET ADMIN USERS ERROR:", error);
    res.status(500).json({ message: "Failed to get users" });
  }
};

export const getAdminPosts = async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
          },
        },
        postDetail: true,
      },
    });

    res.status(200).json(posts);
  } catch (error) {
    console.log("GET ADMIN POSTS ERROR:", error);
    res.status(500).json({ message: "Failed to get posts" });
  }
};

export const deleteAdminUser = async (req, res) => {
  const { id } = req.params;
  const tokenUserId = req.userId;

  try {
    if (id === tokenUserId) {
      return res.status(400).json({ message: "You cannot delete yourself" });
    }

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await prisma.agentProfile.deleteMany({
      where: {
        userId: id,
      },
    });

    await prisma.contactMessage.updateMany({
      where: {
        userId: id,
      },
      data: {
        userId: null,
      },
    });

    const userPosts = await prisma.post.findMany({
      where: {
        userId: id,
      },
      select: {
        id: true,
      },
    });

    const userPostIds = userPosts.map((post) => post.id);

    const userChats = await prisma.chat.findMany({
      where: {
        userIDs: {
          has: id,
        },
      },
      select: {
        id: true,
      },
    });

    const userChatIds = userChats.map((chat) => chat.id);

    if (userChatIds.length > 0) {
      await prisma.message.deleteMany({
        where: {
          chatId: {
            in: userChatIds,
          },
        },
      });

      await prisma.chat.deleteMany({
        where: {
          id: {
            in: userChatIds,
          },
        },
      });
    }

    await prisma.message.deleteMany({
      where: {
        userId: id,
      },
    });

    if (userPostIds.length > 0) {
      await prisma.savedPost.deleteMany({
        where: {
          postId: {
            in: userPostIds,
          },
        },
      });

      await prisma.postDetail.deleteMany({
        where: {
          postId: {
            in: userPostIds,
          },
        },
      });
    }

    await prisma.savedPost.deleteMany({
      where: {
        userId: id,
      },
    });

    await prisma.post.deleteMany({
      where: {
        userId: id,
      },
    });

    await prisma.user.delete({
      where: {
        id,
      },
    });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.log("DELETE ADMIN USER ERROR:", error);
    res.status(500).json({
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

export const deleteAdminPost = async (req, res) => {
  const { id } = req.params;

  try {
    const post = await prisma.post.findUnique({
      where: {
        id,
      },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    await prisma.savedPost.deleteMany({
      where: {
        postId: id,
      },
    });

    await prisma.postDetail.deleteMany({
      where: {
        postId: id,
      },
    });

    await prisma.post.delete({
      where: {
        id,
      },
    });

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.log("DELETE ADMIN POST ERROR:", error);
    res.status(500).json({
      message: "Failed to delete post",
      error: error.message,
    });
  }
};

export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    if (role !== "USER" && role !== "ADMIN" && role !== "AGENT") {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (role !== "AGENT") {
      await prisma.agentProfile.deleteMany({
        where: {
          userId: id,
        },
      });
    }

    const user = await prisma.user.update({
      where: {
        id,
      },
      data: {
        role,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        role: true,
      },
    });

    res.status(200).json(user);
  } catch (error) {
    console.log("UPDATE USER ROLE ERROR:", error);
    res.status(500).json({
      message: "Failed to update user role",
      error: error.message,
    });
  }
};

export const getAdminContactMessages = async (req, res) => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    res.status(200).json(messages);
  } catch (error) {
    console.log("GET CONTACT MESSAGES ERROR:", error);
    res.status(500).json({ message: "Failed to get contact messages" });
  }
};

export const updateContactMessageStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    if (!["OPEN", "READ", "RESOLVED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const message = await prisma.contactMessage.update({
      where: {
        id,
      },
      data: {
        status,
      },
    });

    res.status(200).json(message);
  } catch (error) {
    console.log("UPDATE CONTACT MESSAGE STATUS ERROR:", error);
    res.status(500).json({ message: "Failed to update message status" });
  }
};

export const deleteContactMessage = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.contactMessage.delete({
      where: {
        id,
      },
    });

    res.status(200).json({ message: "Contact message deleted successfully" });
  } catch (error) {
    console.log("DELETE CONTACT MESSAGE ERROR:", error);
    res.status(500).json({ message: "Failed to delete contact message" });
  }
};

const formatAdminAgent = (user) => {
  return {
    id: user.id,
    userId: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    createdAt: user.createdAt,
    name: user.agentProfile?.name || user.username,
    title: user.agentProfile?.title || "Real Estate Agent",
    phone: user.agentProfile?.phone || "No phone number",
    location: user.agentProfile?.location || "No location",
    bio: user.agentProfile?.bio || "Professional SmartEstate agent.",
    image: user.agentProfile?.image || user.avatar || "/no-avatar.png",
    properties: user._count?.posts || 0,
    profile: user.agentProfile || null,
  };
};

export const getAdminAgents = async (req, res) => {
  try {
    const agents = await prisma.user.findMany({
      where: {
        role: "AGENT",
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        agentProfile: true,
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    res.status(200).json(agents.map(formatAdminAgent));
  } catch (error) {
    console.log("GET ADMIN AGENTS ERROR:", error);
    res.status(500).json({ message: "Failed to get agents" });
  }
};

export const createAdminAgent = async (req, res) => {
  const { userId, name, title, phone, location, bio, image } = req.body;

  try {
    if (!userId || !name || !title || !phone || !location || !bio) {
      return res.status(400).json({ message: "All required fields are needed" });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "ADMIN") {
      return res.status(400).json({
        message: "You cannot convert an admin account to an agent",
      });
    }

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        role: "AGENT",
      },
    });

    const profile = await prisma.agentProfile.upsert({
      where: {
        userId,
      },
      update: {
        name,
        title,
        phone,
        location,
        bio,
        image: image || user.avatar || null,
      },
      create: {
        userId,
        name,
        title,
        phone,
        location,
        bio,
        image: image || user.avatar || null,
      },
    });

    res.status(201).json({
      message: "Agent created successfully",
      profile,
    });
  } catch (error) {
    console.log("CREATE ADMIN AGENT ERROR:", error);
    res.status(500).json({
      message: "Failed to create agent",
      error: error.message,
    });
  }
};

export const updateAdminAgent = async (req, res) => {
  const { id } = req.params;
  const { name, title, phone, location, bio, image } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!user || user.role !== "AGENT") {
      return res.status(404).json({ message: "Agent not found" });
    }

    const profile = await prisma.agentProfile.upsert({
      where: {
        userId: id,
      },
      update: {
        name,
        title,
        phone,
        location,
        bio,
        image: image || user.avatar || null,
      },
      create: {
        userId: id,
        name,
        title,
        phone,
        location,
        bio,
        image: image || user.avatar || null,
      },
    });

    res.status(200).json({
      message: "Agent updated successfully",
      profile,
    });
  } catch (error) {
    console.log("UPDATE ADMIN AGENT ERROR:", error);
    res.status(500).json({
      message: "Failed to update agent",
      error: error.message,
    });
  }
};

export const removeAdminAgent = async (req, res) => {
  const { id } = req.params;

  try {
    let userId = id;

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
      include: {
        agentProfile: true,
      },
    });

    if (!user) {
      const agentProfile = await prisma.agentProfile.findUnique({
        where: {
          id,
        },
      });

      if (!agentProfile) {
        return res.status(404).json({
          message: "Agent not found",
        });
      }

      userId = agentProfile.userId;
    }

    await prisma.agentProfile.deleteMany({
      where: {
        userId,
      },
    });

    const updateData = {
      role: "USER",
    };

    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        role: true,
      },
    });

    res.status(200).json({
      message: "Agent removed successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.log("REMOVE ADMIN AGENT ERROR:", error);

    res.status(500).json({
      message: "Failed to remove agent",
      error: error.message,
    });
  }
};

export const replyToContactMessage = async (req, res) => {
  const { id } = req.params;
  const { adminReply, status } = req.body;

  try {
    if (!adminReply || !adminReply.trim()) {
      return res.status(400).json({
        message: "Reply message is required",
      });
    }

    const allowedStatuses = ["OPEN", "READ", "RESOLVED"];

    const updatedMessage = await prisma.contactMessage.update({
      where: {
        id,
      },
      data: {
        adminReply: adminReply.trim(),
        adminRepliedAt: new Date(),
        status: allowedStatuses.includes(status) ? status : "READ",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    res.status(200).json(updatedMessage);
  } catch (error) {
    console.log("REPLY TO CONTACT MESSAGE ERROR:", error);
    res.status(500).json({
      message: "Failed to reply to message",
      error: error.message,
    });
  }
};