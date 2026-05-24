import prisma from "../lib/prisma.js";

const formatAgent = (user) => {
  const agentProfile = user.agentProfile || {};

  return {
    id: user.id,
    userId: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    name: agentProfile.name || user.username || "SmartEstate Agent",
    title: agentProfile.title || "Real Estate Agent",
    phone: agentProfile.phone || "No phone number",
    location: agentProfile.location || "No location",
    bio: agentProfile.bio || "Professional SmartEstate agent.",
    image: agentProfile.image || user.avatar || "/no-avatar.png",
    properties: user._count?.posts || user.posts?.length || 0,
    posts: user.posts || [],
  };
};

const checkAdmin = async (userId) => {
  if (!userId) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      role: true,
    },
  });

  return Boolean(user && String(user.role).toUpperCase() === "ADMIN");
};

export const getAgents = async (req, res) => {
  try {
    const agents = await prisma.user.findMany({
      where: {
        role: "AGENT",
        agentProfile: {
          isNot: null,
        },
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

    res.status(200).json(agents.map(formatAgent));
  } catch (error) {
    console.log("GET AGENTS ERROR:", error);

    res.status(500).json({
      message: "Failed to get agents",
      error: error.message,
    });
  }
};

export const getAgent = async (req, res) => {
  const { id } = req.params;

  try {
    const agent = await prisma.user.findFirst({
      where: {
        id,
        role: "AGENT",
        agentProfile: {
          isNot: null,
        },
      },
      include: {
        agentProfile: true,
        posts: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            postDetail: true,
          },
        },
      },
    });

    if (!agent) {
      return res.status(404).json({
        message: "Agent not found",
      });
    }

    res.status(200).json(formatAgent(agent));
  } catch (error) {
    console.log("GET AGENT ERROR:", error);

    res.status(500).json({
      message: "Failed to get agent",
      error: error.message,
    });
  }
};

export const requestAgent = async (req, res) => {
  const userId = req.userId;
  const { name, title, phone, location, bio } = req.body;

  try {
    console.log("AGENT REQUEST BODY:", req.body);
    console.log("AGENT REQUEST FILE:", req.file);

    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    if (
      !name?.trim() ||
      !title?.trim() ||
      !phone?.trim() ||
      !location?.trim() ||
      !bio?.trim()
    ) {
      return res.status(400).json({
        message: "Name, title, phone, location, and bio are required",
      });
    }

    const phoneRegex = /^[0-9+\-\s()]{7,25}$/;

    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({
        message:
          "Phone number can only contain numbers, spaces, +, -, and parentheses.",
      });
    }

    if (bio.trim().length < 20) {
      return res.status(400).json({
        message: "Bio must be at least 20 characters",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (String(user.role).toUpperCase() === "AGENT") {
      return res.status(400).json({
        message: "You are already a verified agent",
      });
    }

    const pendingRequest = await prisma.agentRequest.findFirst({
      where: {
        userId,
        status: "PENDING",
      },
    });

    if (pendingRequest) {
      return res.status(400).json({
        message: "You already have a pending agent request",
      });
    }

    const image = req.file
      ? `/uploads/${req.file.filename}`
      : user.avatar || "/no-avatar.png";

    const agentRequest = await prisma.agentRequest.create({
      data: {
        userId,
        name: name.trim(),
        title: title.trim(),
        phone: phone.trim(),
        location: location.trim(),
        bio: bio.trim(),
        image,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Agent request sent successfully",
      agentRequest,
    });
  } catch (error) {
    console.log("REQUEST AGENT ERROR:", error);

    res.status(500).json({
      message: "Failed to send agent request",
      error: error.message,
    });
  }
};

export const getMyAgentRequest = async (req, res) => {
  const userId = req.userId;

  try {
    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    const request = await prisma.agentRequest.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json(request);
  } catch (error) {
    console.log("GET MY AGENT REQUEST ERROR:", error);

    res.status(500).json({
      message: "Failed to get your agent request",
      error: error.message,
    });
  }
};

export const getAgentRequests = async (req, res) => {
  const adminId = req.userId;

  try {
    const isAdmin = await checkAdmin(adminId);

    if (!isAdmin) {
      return res.status(403).json({
        message: "Only admin can view agent requests",
      });
    }

    const { status } = req.query;
    const allowedStatuses = ["PENDING", "APPROVED", "REJECTED"];
    const selectedStatus = String(status || "").toUpperCase();

    const requests = await prisma.agentRequest.findMany({
      where: allowedStatuses.includes(selectedStatus)
        ? {
            status: selectedStatus,
          }
        : {},
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json(requests);
  } catch (error) {
    console.log("GET AGENT REQUESTS ERROR:", error);

    res.status(500).json({
      message: "Failed to get agent requests",
      error: error.message,
    });
  }
};

export const approveAgentRequest = async (req, res) => {
  const adminId = req.userId;
  const requestId = req.params.id;

  try {
    const isAdmin = await checkAdmin(adminId);

    if (!isAdmin) {
      return res.status(403).json({
        message: "Only admin can approve agent requests",
      });
    }

    const request = await prisma.agentRequest.findUnique({
      where: {
        id: requestId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({
        message: "Agent request not found",
      });
    }

    if (request.status === "APPROVED") {
      return res.status(400).json({
        message: "This request is already approved",
      });
    }

    const image = request.image || request.user.avatar || "/no-avatar.png";

    const updatedRequest = await prisma.$transaction(async (tx) => {
      await tx.agentProfile.upsert({
        where: {
          userId: request.userId,
        },
        update: {
          name: request.name,
          title: request.title,
          phone: request.phone,
          location: request.location,
          bio: request.bio,
          image,
        },
        create: {
          userId: request.userId,
          name: request.name,
          title: request.title,
          phone: request.phone,
          location: request.location,
          bio: request.bio,
          image,
        },
      });

      await tx.user.update({
        where: {
          id: request.userId,
        },
        data: {
          role: "AGENT",
        },
      });

      await tx.agentRequest.updateMany({
        where: {
          userId: request.userId,
          id: {
            not: requestId,
          },
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
        },
      });

      return tx.agentRequest.update({
        where: {
          id: requestId,
        },
        data: {
          status: "APPROVED",
          adminNote: req.body?.adminNote?.trim() || null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              role: true,
            },
          },
        },
      });
    });

    res.status(200).json(updatedRequest);
  } catch (error) {
    console.log("APPROVE AGENT REQUEST ERROR:", error);

    res.status(500).json({
      message: error.message || "Failed to approve agent request",
      error: error.message,
    });
  }
};

export const rejectAgentRequest = async (req, res) => {
  const adminId = req.userId;
  const requestId = req.params.id;

  try {
    const isAdmin = await checkAdmin(adminId);

    if (!isAdmin) {
      return res.status(403).json({
        message: "Only admin can reject agent requests",
      });
    }

    const request = await prisma.agentRequest.findUnique({
      where: {
        id: requestId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({
        message: "Agent request not found",
      });
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      await tx.agentProfile.deleteMany({
        where: {
          userId: request.userId,
        },
      });

      if (String(request.user.role).toUpperCase() !== "ADMIN") {
        await tx.user.update({
          where: {
            id: request.userId,
          },
          data: {
            role: "USER",
          },
        });
      }

      return tx.agentRequest.update({
        where: {
          id: requestId,
        },
        data: {
          status: "REJECTED",
          adminNote: req.body?.adminNote?.trim() || null,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              role: true,
            },
          },
        },
      });
    });

    res.status(200).json(updatedRequest);
  } catch (error) {
    console.log("REJECT AGENT REQUEST ERROR:", error);

    res.status(500).json({
      message: error.message || "Failed to reject agent request",
      error: error.message,
    });
  }
};