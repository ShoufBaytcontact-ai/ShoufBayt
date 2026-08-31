import prisma from "../lib/prisma.js";
import { createNotification } from "../lib/notify.js";
import {
  grantPremiumTrialAfterVerification,
  archiveListingsForFormerAgent,
  restoreAgentListings,
  ensureAgentProfile,
} from "../lib/subscription.js";
import {
  assertPhoneAvailable,
  assertFullNameAvailable,
  sendUniqueConflict,
} from "../lib/uniqueFields.js";
import { sendListingModerationEmail } from "../lib/Email.js";
import { isValidPhone, normalizePhone } from "../lib/phone.js";

const roles = ["USER", "AGENT", "ADMIN"];

const accountStatuses = [
  "ACTIVE",
  "PENDING",
  "SUSPENDED",
  "BANNED",
];

const contactStatuses = [
  "OPEN",
  "READ",
  "RESOLVED",
];

const propertyStatuses = [
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "SOLD",
  "RENTED",
  "ARCHIVED",
];

const applicationStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
];

const reportStatuses = [
  "PENDING",
  "REVIEWED",
  "DISMISSED",
];

const isValidObjectId = (id) => {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
};

const cleanText = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const hasText = (value) => {
  return cleanText(value).length > 0;
};

const parseOptionalInteger = (value, fallback = null) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return fallback;
  }

  return parsedValue;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
};

const getUploadedFilePath = (file) => {
  if (!file) {
    return null;
  }

  if (file.secure_url) {
    return file.secure_url;
  }

  if (file.url) {
    return file.url;
  }

  if (file.path && /^https?:\/\//i.test(file.path)) {
    return file.path;
  }

  if (file.filename) {
    return file.secure_url || file.url || null;
  }

  return null;
};

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage.toUpperCase(), error);

  if (sendUniqueConflict(res, error)) {
    return;
  }

  if (error?.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    });
  }

  if (error?.code === "P2002") {
    return res.status(409).json({
      message: "A record with the same unique value already exists",
    });
  }

  return res.status(500).json({
    message: fallbackMessage,
  });
};

const validateMongoId = (res, id, label = "ID") => {
  if (!isValidObjectId(id)) {
    res.status(400).json({
      message: `Invalid ${label}`,
    });

    return false;
  }

  return true;
};

const formatAdminAgent = (agent) => {
  return {
    id: agent.id,
    userId: agent.userId,

    username: agent.user?.username || "",
    email: agent.user?.email || "",
    avatar: agent.user?.avatar || null,
    role: agent.user?.role || "AGENT",
    accountStatus: agent.user?.status || "ACTIVE",

    name: agent.name || agent.user?.username || "Agent",
    agencyName: agent.agencyName || "",
    title: agent.title || "Real Estate Agent",
    phone: agent.phone || "",
    location: agent.location || "",
    bio: agent.bio || "",

    image:
      agent.image ||
      agent.user?.avatar ||
      "/no-avatar.png",

    website: agent.website || "",
    facebook: agent.facebook || "",
    instagram: agent.instagram || "",
    linkedin: agent.linkedin || "",

    yearsExperience: agent.yearsExperience ?? null,
    rating: agent.rating ?? 0,
    totalReviews: agent.totalReviews ?? 0,
    isVerified: agent.isVerified ?? false,

    properties:
      agent.user?._count?.properties ||
      agent.user?.properties?.length ||
      0,

    propertyList: agent.user?.properties || [],

    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,

    profile: {
      id: agent.id,
      userId: agent.userId,
      name: agent.name,
      agencyName: agent.agencyName,
      title: agent.title,
      phone: agent.phone,
      location: agent.location,
      bio: agent.bio,
      image: agent.image,
      website: agent.website,
      facebook: agent.facebook,
      instagram: agent.instagram,
      linkedin: agent.linkedin,
      yearsExperience: agent.yearsExperience,
      rating: agent.rating,
      totalReviews: agent.totalReviews,
      isVerified: agent.isVerified,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    },
  };
};

const findAgentUserId = async (id) => {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    include: {
      agentProfile: true,
    },
  });

  if (user) {
    return {
      userId: user.id,
      user,
    };
  }

  const profile = await prisma.agentProfile.findUnique({
    where: {
      id,
    },
    include: {
      user: true,
    },
  });

  if (!profile) {
    return null;
  }

  return {
    userId: profile.userId,
    user: profile.user,
  };
};


/* =========================================================
   ADMIN STATISTICS
========================================================= */

export const getAdminStats = async (req, res) => {
  try {
    const [
      usersCount,
      activeUsersCount,
      pendingUsersCount,
      suspendedUsersCount,
      bannedUsersCount,

      propertiesCount,
      pendingPropertiesCount,
      publishedPropertiesCount,
      rejectedPropertiesCount,
      soldPropertiesCount,
      rentedPropertiesCount,
      archivedPropertiesCount,
      saleListingsCount,
      rentListingsCount,
      propertyTypeGroups,

      agentsCount,
      verifiedAgentsCount,
      agentApplicationsCount,
      pendingAgentApplicationsCount,

      chatsCount,
      messagesCount,
      savedPropertiesCount,

      contactMessagesCount,
      openContactMessagesCount,
      contactReportsCount,
      openContactReportsCount,

      reportsCount,
      pendingReportsCount,

      allSubscriptionsCount,
      subscriptionsCount,
      paymentsCount,
      pendingPaymentsCount,
      notificationsCount,
    ] = await Promise.all([
      prisma.user.count(),

      prisma.user.count({
        where: {
          status: "ACTIVE",
        },
      }),

      prisma.user.count({
        where: {
          status: "PENDING",
        },
      }),

      prisma.user.count({
        where: {
          status: "SUSPENDED",
        },
      }),

      prisma.user.count({
        where: {
          status: "BANNED",
        },
      }),

      prisma.property.count(),

      prisma.property.count({
        where: {
          status: "PENDING",
        },
      }),

      prisma.property.count({
        where: {
          status: "PUBLISHED",
        },
      }),

      prisma.property.count({
        where: {
          status: "REJECTED",
        },
      }),

      prisma.property.count({
        where: {
          status: "SOLD",
        },
      }),

      prisma.property.count({
        where: {
          status: "RENTED",
        },
      }),

      prisma.property.count({
        where: {
          status: "ARCHIVED",
        },
      }),

      prisma.property.count({
        where: {
          listingType: "SALE",
        },
      }),

      prisma.property.count({
        where: {
          listingType: "RENT",
        },
      }),

      prisma.property.groupBy({
        by: ["propertyType"],
        _count: {
          _all: true,
        },
      }),

      prisma.agentProfile.count(),

      prisma.agentProfile.count({
        where: {
          isVerified: true,
        },
      }),

      prisma.agentApplication.count(),

      prisma.agentApplication.count({
        where: {
          status: "PENDING",
        },
      }),

      prisma.chat.count(),
      prisma.message.count(),
      prisma.savedProperty.count(),

      prisma.contactMessage.count(),

      prisma.contactMessage.count({
        where: {
          status: "OPEN",
        },
      }),

      prisma.contactMessage.count({
        where: {
          type: "REPORT",
        },
      }),

      prisma.contactMessage.count({
        where: {
          type: "REPORT",
          status: "OPEN",
        },
      }),

      prisma.propertyReport.count(),

      prisma.propertyReport.count({
        where: {
          status: "PENDING",
        },
      }),

      prisma.subscription.count(),

      prisma.subscription.count({
        where: {
          isCurrent: true,
          status: {
            in: ["ACTIVE", "GRACE"],
          },
        },
      }),

      prisma.payment.count(),
      prisma.payment.count({
        where: {
          status: "PENDING",
        },
      }),
      prisma.notification.count(),
    ]);

    const propertyTypeCounts = Object.fromEntries(
      (propertyTypeGroups || []).map((row) => [
        row.propertyType,
        row._count?._all || 0,
      ])
    );

    return res.status(200).json({
      usersCount,
      activeUsersCount,
      pendingUsersCount,
      suspendedUsersCount,
      bannedUsersCount,

      propertiesCount,
      pendingPropertiesCount,
      publishedPropertiesCount,
      rejectedPropertiesCount,
      soldPropertiesCount,
      rentedPropertiesCount,
      archivedPropertiesCount,
      saleListingsCount,
      rentListingsCount,
      propertyTypeCounts,

      agentsCount,
      verifiedAgentsCount,
      agentApplicationsCount,
      pendingAgentApplicationsCount,

      chatsCount,
      messagesCount,
      savedPropertiesCount,

      contactMessagesCount,
      openContactMessagesCount,
      contactReportsCount,
      openContactReportsCount,

      reportsCount,
      pendingReportsCount,
      openReportsCount: pendingReportsCount,

      allSubscriptionsCount,
      subscriptionsCount,
      paymentsCount,
      pendingPaymentsCount,
      notificationsCount,

      // Compatibility with your older frontend
      postsCount: propertiesCount,
      savedPostsCount: savedPropertiesCount,
      agentRequestsCount: agentApplicationsCount,
      pendingAgentRequestsCount:
        pendingAgentApplicationsCount,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to get admin stats"
    );
  }
};

/* =========================================================
   USERS
========================================================= */

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
        status: true,
        emailVerified: true,

        createdAt: true,
        updatedAt: true,

        agentProfile: {
          select: {
            id: true,
            name: true,
            agencyName: true,
            title: true,
            phone: true,
            location: true,
            image: true,
            isVerified: true,
          },
        },

        _count: {
          select: {
            properties: true,
            savedProperties: true,
            messages: true,
            propertyReviews: true,
            agentReviews: true,
            propertyReports: true,
            agentApplications: true,
            subscriptions: true,
            payments: true,
          },
        },
      },
    });

    return res.status(200).json(users);
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to get users"
    );
  }
};

export const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const role = cleanText(req.body.role).toUpperCase();

  try {
    if (!validateMongoId(res, id, "user ID")) {
      return;
    }

    if (!roles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role",
      });
    }

    if (id === req.userId && role !== "ADMIN") {
      return res.status(400).json({
        message:
          "You cannot remove your own admin role",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        role: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (
      existingUser.role === "ADMIN" &&
      role !== "ADMIN"
    ) {
      const adminCount = await prisma.user.count({
        where: {
          role: "ADMIN",
        },
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          message:
            "You cannot remove the last admin",
        });
      }
    }

    if (role !== "AGENT") {
      await prisma.agentProfile.deleteMany({
        where: {
          userId: id,
        },
      });
    }

    if (existingUser.role === "AGENT" && role !== "AGENT" && role !== "ADMIN") {
      await archiveListingsForFormerAgent(id);
    }

    if (role === "AGENT") {
      await restoreAgentListings(id);
      await ensureAgentProfile(id);
    }

    const updatedUser = await prisma.user.update({
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
        status: true,
        emailVerified: true,
      },
    });

    return res.status(200).json(updatedUser);
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to update user role"
    );
  }
};

export const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const status = cleanText(req.body.status).toUpperCase();

  try {
    if (!validateMongoId(res, id, "user ID")) {
      return;
    }

    if (!accountStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid account status",
      });
    }

    if (
      id === req.userId &&
      status !== "ACTIVE"
    ) {
      return res.status(400).json({
        message:
          "You cannot suspend or ban your own account",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const updatedUser = await prisma.user.update({
      where: {
        id,
      },

      data: {
        status,
      },

      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        role: true,
        status: true,
        emailVerified: true,
      },
    });

    return res.status(200).json(updatedUser);
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to update user status"
    );
  }
};

/* =========================================================
   PROPERTIES
========================================================= */

export const getAdminProperties = async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
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
            role: true,
            status: true,
          },
        },

        detail: true,

        _count: {
          select: {
            savedBy: true,
            reports: true,
            reviews: true,
          },
        },
      },
    });

    return res.status(200).json(properties);
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to get properties"
    );
  }
};

// Keep this temporarily if your old routes still use getAdminPosts
export const getAdminPosts = getAdminProperties;

export const updatePropertyStatus = async (req, res) => {
  const { id } = req.params;
  const status = cleanText(req.body.status).toUpperCase();
  const rejectionReason = cleanText(req.body.rejectionReason);
  const moderationNote = cleanText(req.body.moderationNote);

  try {
    if (!validateMongoId(res, id, "property ID")) {
      return;
    }

    if (!propertyStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid property status",
      });
    }

    if (status === "REJECTED" && !rejectionReason) {
      return res.status(400).json({
        message: "Rejection reason is required",
      });
    }

    const existingProperty =
      await prisma.property.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          title: true,
          city: true,
          status: true,
          publishedAt: true,
          userId: true,
          requestedByUserId: true,
        },
      });

    if (!existingProperty) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    const property = await prisma.property.update({
      where: {
        id,
      },

      data: {
        status,

        publishedAt:
          status === "PUBLISHED"
            ? existingProperty.publishedAt || new Date()
            : status === "REJECTED"
              ? null
              : existingProperty.publishedAt,

        rejectionReason:
          status === "REJECTED" ? rejectionReason : null,

        moderationNote: moderationNote || null,

        reviewedAt: new Date(),
        reviewedBy: req.userId || null,
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

        detail: true,

        reviewer: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },

        _count: {
          select: {
            savedBy: true,
            reports: true,
            reviews: true,
          },
        },
      },
    });

    if (
      (status === "PUBLISHED" || status === "REJECTED") &&
      existingProperty.status !== status
    ) {
      const recipientIds = Array.from(
        new Set(
          [
            existingProperty.userId,
            existingProperty.requestedByUserId,
          ].filter(Boolean)
        )
      );

      await Promise.all(
        recipientIds.map((userId) =>
          createNotification({
            userId,
            type:
              status === "PUBLISHED"
                ? "PROPERTY_APPROVED"
                : "PROPERTY_REJECTED",
            title:
              status === "PUBLISHED"
                ? "Listing approved"
                : "Listing not approved",
            message:
              status === "PUBLISHED"
                ? "Your listing is now live on ShoufBayt."
                : rejectionReason || "Your listing was not approved.",
            link: `/properties/${property.id}`,
            metadata: {
              propertyId: property.id,
              status,
            },
          })
        )
      );

      const recipients = await prisma.user.findMany({
        where: { id: { in: recipientIds } },
        select: { id: true, email: true, username: true },
      });

      const emailed = new Set();
      recipients.forEach((recipient) => {
        const email = String(recipient.email || "").trim().toLowerCase();
        if (!email || emailed.has(email)) return;
        emailed.add(email);
        sendListingModerationEmail({
          to: recipient.email,
          username: recipient.username,
          title: property.title || existingProperty.title,
          city: property.city || existingProperty.city,
          status,
          reason: rejectionReason,
          propertyId: property.id,
        });
      });
    }

    return res.status(200).json(property);
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to update property status"
    );
  }
};

export const deleteAdminProperty = async (req, res) => {
  const { id } = req.params;

  try {
    if (!validateMongoId(res, id, "property ID")) {
      return;
    }

    const property = await prisma.property.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
      },
    });

    if (!property) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    await prisma.savedProperty.deleteMany({
      where: {
        propertyId: id,
      },
    });

    await prisma.propertyReview.deleteMany({
      where: {
        propertyId: id,
      },
    });

    await prisma.propertyReport.deleteMany({
      where: {
        propertyId: id,
      },
    });

    await prisma.propertyDetail.deleteMany({
      where: {
        propertyId: id,
      },
    });

    await prisma.chat.updateMany({
      where: {
        propertyId: id,
      },
      data: {
        propertyId: null,
      },
    });

    await prisma.property.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      message: "Property deleted successfully",
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to delete property"
    );
  }
};

// Keep this temporarily if your old routes still use deleteAdminPost
export const deleteAdminPost = deleteAdminProperty;
/* =========================================================
   DELETE USER
========================================================= */

export const deleteAdminUser = async (req, res) => {
  const { id } = req.params;
  const tokenUserId = req.userId;

  try {
    if (!validateMongoId(res, id, "user ID")) {
      return;
    }

    if (id === tokenUserId) {
      return res.status(400).json({
        message: "You cannot delete yourself",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const userProperties = await prisma.property.findMany({
      where: {
        userId: id,
      },
      select: {
        id: true,
      },
    });

    const propertyIds = userProperties.map((property) => property.id);

    const userChats = await prisma.chat.findMany({
      where: {
        participants: {
          some: {
            userId: id,
          },
        },
      },
      select: {
        id: true,
      },
    });

    const chatIds = userChats.map((chat) => chat.id);

    if (chatIds.length > 0) {
      await prisma.message.deleteMany({
        where: {
          chatId: {
            in: chatIds,
          },
        },
      });

      await prisma.chatParticipant.deleteMany({
        where: {
          chatId: {
            in: chatIds,
          },
        },
      });

      await prisma.chat.deleteMany({
        where: {
          id: {
            in: chatIds,
          },
        },
      });
    }

    await prisma.chatParticipant.deleteMany({
      where: {
        userId: id,
      },
    });

    await prisma.message.deleteMany({
      where: {
        senderId: id,
      },
    });

    await prisma.savedProperty.deleteMany({
      where: {
        OR: [
          {
            userId: id,
          },
          {
            propertyId: {
              in: propertyIds,
            },
          },
        ],
      },
    });

    await prisma.propertyReview.deleteMany({
      where: {
        OR: [
          {
            reviewerId: id,
          },
          {
            propertyId: {
              in: propertyIds,
            },
          },
        ],
      },
    });

    await prisma.agentReview.deleteMany({
      where: {
        reviewerId: id,
      },
    });

    await prisma.propertyReport.deleteMany({
      where: {
        OR: [
          {
            reporterId: id,
          },
          {
            propertyId: {
              in: propertyIds,
            },
          },
        ],
      },
    });

    await prisma.propertyDetail.deleteMany({
      where: {
        propertyId: {
          in: propertyIds,
        },
      },
    });

    await prisma.property.updateMany({
      where: {
        reviewedBy: id,
      },
      data: {
        reviewedBy: null,
      },
    });

    await prisma.property.deleteMany({
      where: {
        userId: id,
      },
    });

    await prisma.notification.deleteMany({
      where: {
        userId: id,
      },
    });

    await prisma.payment.updateMany({
      where: {
        reviewedBy: id,
      },
      data: {
        reviewedBy: null,
      },
    });

    await prisma.payment.deleteMany({
      where: {
        userId: id,
      },
    });

    await prisma.subscription.deleteMany({
      where: {
        userId: id,
      },
    });

    await prisma.verificationCode.deleteMany({
      where: {
        userId: id,
      },
    });

    await prisma.propertyReport.updateMany({
      where: {
        reviewedBy: id,
      },
      data: {
        reviewedBy: null,
      },
    });

    await prisma.agentApplication.updateMany({
      where: {
        reviewedBy: id,
      },
      data: {
        reviewedBy: null,
      },
    });

    await prisma.agentApplication.deleteMany({
      where: {
        userId: id,
      },
    });

    const agentProfile = await prisma.agentProfile.findUnique({
      where: {
        userId: id,
      },
      select: {
        id: true,
      },
    });

    if (agentProfile) {
      await prisma.agentReview.deleteMany({
        where: {
          agentProfileId: agentProfile.id,
        },
      });
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

    await prisma.user.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete user");
  }
};

/* =========================================================
   CONTACT MESSAGES
========================================================= */

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

    return res.status(200).json(messages);
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to get contact messages"
    );
  }
};

export const updateContactMessageStatus = async (req, res) => {
  const { id } = req.params;
  const status = cleanText(req.body.status).toUpperCase();

  try {
    if (!validateMongoId(res, id, "message ID")) {
      return;
    }

    if (!contactStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const message = await prisma.contactMessage.update({
      where: {
        id,
      },
      data: {
        status,
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

    return res.status(200).json(message);
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to update message status"
    );
  }
};

export const deleteContactMessage = async (req, res) => {
  const { id } = req.params;

  try {
    if (!validateMongoId(res, id, "message ID")) {
      return;
    }

    const existingMessage =
      await prisma.contactMessage.findUnique({
        where: {
          id,
        },
      });

    if (!existingMessage) {
      return res.status(404).json({
        message: "Contact message not found",
      });
    }

    await prisma.contactMessage.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      message: "Contact message deleted successfully",
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to delete contact message"
    );
  }
};

export const replyToContactMessage = async (req, res) => {
  const { id } = req.params;

  const adminReply = cleanText(req.body.adminReply);
  const status = cleanText(req.body.status).toUpperCase();

  try {
    if (!validateMongoId(res, id, "message ID")) {
      return;
    }

    if (!adminReply) {
      return res.status(400).json({
        message: "Reply message is required",
      });
    }

    const updatedMessage =
      await prisma.contactMessage.update({
        where: {
          id,
        },

        data: {
          adminReply,
          adminRepliedAt: new Date(),

          status: contactStatuses.includes(status)
            ? status
            : "READ",
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

    return res.status(200).json(updatedMessage);
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to reply to message"
    );
  }
};
/* =========================================================
   AGENTS
========================================================= */

export const getAdminAgents = async (req, res) => {
  try {
    const agents = await prisma.agentProfile.findMany({
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
            role: true,
            status: true,

            properties: {
              orderBy: {
                createdAt: "desc",
              },
            },

            _count: {
              select: {
                properties: true,
              },
            },
          },
        },
      },
    });

    const formattedAgents = agents
      .filter((agent) => Boolean(agent.user))
      .map((agent) => formatAdminAgent(agent));

    return res.status(200).json(formattedAgents);
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to get agents"
    );
  }
};

/* =========================================================
   AGENT APPLICATIONS
========================================================= */

export const getAdminAgentApplications = async (
  req,
  res
) => {
  try {
    const applications =
      await prisma.agentApplication.findMany({
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
              role: true,
              status: true,
            },
          },

          reviewer: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

    return res.status(200).json(
      applications.map((item) => ({
        ...item,
        name: item.fullName || item.name || item.user?.username,
        title: item.agencyName || item.title || "Real Estate Agent",
      }))
    );
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to get agent applications"
    );
  }
};

export const reviewAgentApplication = async (
  req,
  res
) => {
  const { id } = req.params;

  const status = cleanText(
    req.body.status
  ).toUpperCase();

  const rejectionReason = cleanText(
    req.body.rejectionReason
  );

  try {
    if (
      !validateMongoId(
        res,
        id,
        "application ID"
      )
    ) {
      return;
    }

    if (
      !applicationStatuses.includes(status) ||
      status === "PENDING"
    ) {
      return res.status(400).json({
        message:
          "Status must be APPROVED or REJECTED",
      });
    }

    if (
      status === "REJECTED" &&
      !rejectionReason
    ) {
      return res.status(400).json({
        message:
          "Rejection reason is required",
      });
    }

    if (
      !validateMongoId(
        res,
        req.userId,
        "reviewer ID"
      )
    ) {
      return;
    }

    const application =
      await prisma.agentApplication.findUnique({
        where: {
          id,
        },

        include: {
          user: {
            include: {
              agentProfile: true,
            },
          },
        },
      });

    if (!application) {
      return res.status(404).json({
        message:
          "Agent application not found",
      });
    }

    if (application.status !== "PENDING") {
      return res.status(400).json({
        message:
          "This application has already been reviewed",
      });
    }

    if (
      application.user.role === "ADMIN"
    ) {
      return res.status(400).json({
        message:
          "Admin users cannot become agents",
      });
    }

    if (status === "APPROVED") {
      const paidPayment = await prisma.payment.findFirst({
        where: {
          userId: application.userId,
          status: "SUCCESS",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!paidPayment) {
        return res.status(400).json({
          message:
            "This applicant has not completed payment yet. Approve their payment on the Payments tab first, then approve this request.",
          code: "PAYMENT_REQUIRED",
        });
      }

      await assertPhoneAvailable(application.phone, application.userId);
      await assertFullNameAvailable(application.fullName, application.userId);

      const profile =
        await prisma.agentProfile.upsert({
          where: {
            userId: application.userId,
          },

          update: {
            name: application.fullName,
            agencyName:
              application.agencyName,
            phone: application.phone,
            location: application.location,
            bio: application.bio,

            image:
              application.image ||
              application.user
                .agentProfile?.image ||
              application.user.avatar ||
              null,

            isVerified: true,
          },

          create: {
            userId: application.userId,
            name: application.fullName,
            agencyName:
              application.agencyName,
            title: "Real Estate Agent",
            phone: application.phone,
            location: application.location,
            bio: application.bio,

            image:
              application.image ||
              application.user.avatar ||
              null,

            isVerified: true,
          },
        });

      const updatedUser =
        await prisma.user.update({
          where: {
            id: application.userId,
          },

          data: {
            role: "AGENT",
            status: "ACTIVE",
          },

          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            role: true,
            status: true,
          },
        });

      const subscription = await grantPremiumTrialAfterVerification(
        application.userId
      );

      await restoreAgentListings(application.userId);

      const updatedApplication =
        await prisma.agentApplication.update({
          where: {
            id,
          },

          data: {
            status: "APPROVED",
            rejectionReason: null,
            reviewedAt: new Date(),
            reviewedBy: req.userId,
          },

          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                avatar: true,
                role: true,
                status: true,
              },
            },

            reviewer: {
              select: {
                id: true,
                username: true,
                email: true,
                avatar: true,
              },
            },
          },
        });

      return res.status(200).json({
        message:
          "Agent application approved successfully",
        application: updatedApplication,
        user: updatedUser,
        profile,
        subscription,
      });
    }

    const updatedApplication =
      await prisma.agentApplication.update({
        where: {
          id,
        },

        data: {
          status: "REJECTED",
          rejectionReason,
          reviewedAt: new Date(),
          reviewedBy: req.userId,
        },

        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
              role: true,
              status: true,
            },
          },

          reviewer: {
            select: {
              id: true,
              username: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

    return res.status(200).json({
      message:
        "Agent application rejected successfully",
      application: updatedApplication,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to review agent application"
    );
  }
};

/* =========================================================
   CREATE AGENT
========================================================= */

export const createAdminAgent = async (
  req,
  res
) => {
  try {
    const userId = cleanText(
      req.body.userId
    );

    const name = cleanText(
      req.body.name
    );

    const agencyName =
      cleanText(req.body.agencyName) ||
      null;

    const title =
      cleanText(req.body.title) ||
      "Real Estate Agent";

    const phone = cleanText(
      req.body.phone
    );

    const location = cleanText(
      req.body.location
    );

    const bio = cleanText(
      req.body.bio
    );

    if (
      !validateMongoId(
        res,
        userId,
        "user ID"
      )
    ) {
      return;
    }

    if (
      !name ||
      !phone ||
      !location ||
      !bio
    ) {
      return res.status(400).json({
        message:
          "Name, phone, location, and bio are required",
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        message:
          "Enter the required digits for the selected country, without the country code",
      });
    }

    const normalizedPhone = normalizePhone(phone);

    await assertPhoneAvailable(normalizedPhone, userId);
    await assertFullNameAvailable(name, userId);

    const user =
      await prisma.user.findUnique({
        where: {
          id: userId,
        },

        include: {
          agentProfile: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.role === "ADMIN") {
      return res.status(400).json({
        message:
          "Admin users cannot be converted to agents",
      });
    }

    const uploadedImage =
      getUploadedFilePath(req.file);

    const profileImage =
      uploadedImage ||
      user.agentProfile?.image ||
      user.avatar ||
      null;

    const profile =
      await prisma.agentProfile.upsert({
        where: {
          userId,
        },

        update: {
          name,
          agencyName,
          title,
          phone: normalizedPhone,
          location,
          bio,
          image: profileImage,

          website:
            cleanText(req.body.website) ||
            null,

          facebook:
            cleanText(req.body.facebook) ||
            null,

          instagram:
            cleanText(
              req.body.instagram
            ) || null,

          linkedin:
            cleanText(req.body.linkedin) ||
            null,

          yearsExperience:
            parseOptionalInteger(
              req.body.yearsExperience
            ),

          isVerified: parseBoolean(
            req.body.isVerified,
            false
          ),
        },

        create: {
          userId,
          name,
          agencyName,
          title,
          phone: normalizedPhone,
          location,
          bio,
          image: profileImage,

          website:
            cleanText(req.body.website) ||
            null,

          facebook:
            cleanText(req.body.facebook) ||
            null,

          instagram:
            cleanText(
              req.body.instagram
            ) || null,

          linkedin:
            cleanText(req.body.linkedin) ||
            null,

          yearsExperience:
            parseOptionalInteger(
              req.body.yearsExperience
            ),

          isVerified: parseBoolean(
            req.body.isVerified,
            false
          ),
        },
      });

    const updatedUser =
      await prisma.user.update({
        where: {
          id: userId,
        },

        data: {
          role: "AGENT",
          status: "ACTIVE",
        },

        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          role: true,
          status: true,

          _count: {
            select: {
              properties: true,
            },
          },
        },
      });

    if (
      req.userId &&
      isValidObjectId(req.userId)
    ) {
      await prisma.agentApplication.updateMany({
        where: {
          userId,
          status: "PENDING",
        },

        data: {
          status: "APPROVED",
          rejectionReason: null,
          reviewedAt: new Date(),
          reviewedBy: req.userId,
        },
      });
    } else {
      await prisma.agentApplication.updateMany({
        where: {
          userId,
          status: "PENDING",
        },

        data: {
          status: "APPROVED",
          rejectionReason: null,
          reviewedAt: new Date(),
        },
      });
    }

    const subscription = await grantPremiumTrialAfterVerification(userId);

    await restoreAgentListings(userId);

    return res.status(201).json({
      message:
        "Agent created successfully",

      id: profile.id,
      userId: profile.userId,

      username: updatedUser.username,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      role: updatedUser.role,
      status: updatedUser.status,

      name: profile.name,
      agencyName:
        profile.agencyName,
      title: profile.title,
      phone: profile.phone,
      location: profile.location,
      bio: profile.bio,

      image:
        profile.image ||
        updatedUser.avatar ||
        "/no-avatar.png",

      website: profile.website,
      facebook: profile.facebook,
      instagram: profile.instagram,
      linkedin: profile.linkedin,

      yearsExperience:
        profile.yearsExperience,

      rating: profile.rating,
      totalReviews:
        profile.totalReviews,

      isVerified:
        profile.isVerified,

      properties:
        updatedUser._count
          ?.properties || 0,

      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,

      profile,
      subscription,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to create agent"
    );
  }
};

/* =========================================================
   UPDATE AGENT
========================================================= */

export const updateAdminAgent = async (
  req,
  res
) => {
  const { id } = req.params;

  try {
    if (
      !validateMongoId(
        res,
        id,
        "agent ID"
      )
    ) {
      return;
    }

    const result =
      await findAgentUserId(id);

    if (!result?.user) {
      return res.status(404).json({
        message: "Agent not found",
      });
    }

    const user = result.user;
    const userId = result.userId;

    if (user.role === "ADMIN") {
      return res.status(400).json({
        message:
          "Admin users cannot be converted to agents",
      });
    }

    const existingProfile =
      await prisma.agentProfile.findUnique({
        where: {
          userId,
        },
      });

    if (
      !existingProfile &&
      user.role !== "AGENT"
    ) {
      return res.status(404).json({
        message:
          "Agent profile not found",
      });
    }

    const uploadedImage =
      getUploadedFilePath(req.file);

    const profileData = {
      name: hasText(req.body.name)
        ? cleanText(req.body.name)
        : existingProfile?.name ||
          user.username,

      agencyName:
        req.body.agencyName !==
        undefined
          ? cleanText(
              req.body.agencyName
            ) || null
          : existingProfile?.agencyName ||
            null,

      title: hasText(req.body.title)
        ? cleanText(req.body.title)
        : existingProfile?.title ||
          "Real Estate Agent",

      phone: hasText(req.body.phone)
        ? cleanText(req.body.phone)
        : existingProfile?.phone || "",

      location: hasText(
        req.body.location
      )
        ? cleanText(req.body.location)
        : existingProfile?.location ||
          "",

      bio: hasText(req.body.bio)
        ? cleanText(req.body.bio)
        : existingProfile?.bio || "",

      image:
        uploadedImage ||
        existingProfile?.image ||
        user.avatar ||
        null,

      website:
        req.body.website !== undefined
          ? cleanText(
              req.body.website
            ) || null
          : existingProfile?.website ||
            null,

      facebook:
        req.body.facebook !== undefined
          ? cleanText(
              req.body.facebook
            ) || null
          : existingProfile?.facebook ||
            null,

      instagram:
        req.body.instagram !==
        undefined
          ? cleanText(
              req.body.instagram
            ) || null
          : existingProfile?.instagram ||
            null,

      linkedin:
        req.body.linkedin !==
        undefined
          ? cleanText(
              req.body.linkedin
            ) || null
          : existingProfile?.linkedin ||
            null,

      yearsExperience:
        req.body.yearsExperience !==
        undefined
          ? parseOptionalInteger(
              req.body.yearsExperience,
              existingProfile
                ?.yearsExperience ?? null
            )
          : existingProfile
              ?.yearsExperience ?? null,

      isVerified:
        req.body.isVerified !==
        undefined
          ? parseBoolean(
              req.body.isVerified,
              existingProfile
                ?.isVerified ?? false
            )
          : existingProfile
              ?.isVerified ?? false,
    };

    if (
      !profileData.name ||
      !profileData.phone ||
      !profileData.location ||
      !profileData.bio
    ) {
      return res.status(400).json({
        message:
          "Name, phone, location, and bio are required",
      });
    }

    if (!isValidPhone(profileData.phone)) {
      return res.status(400).json({
        message:
          "Enter the required digits for the selected country, without the country code",
      });
    }

    profileData.phone = normalizePhone(profileData.phone);

    await assertPhoneAvailable(profileData.phone, userId);
    await assertFullNameAvailable(profileData.name, userId);

    const profile =
      await prisma.agentProfile.upsert({
        where: {
          userId,
        },

        update: profileData,

        create: {
          userId,
          ...profileData,
        },
      });

    if (user.role !== "AGENT") {
      await prisma.user.update({
        where: {
          id: userId,
        },

        data: {
          role: "AGENT",
          status: "ACTIVE",
        },
      });
      await restoreAgentListings(userId);
    }

    return res.status(200).json({
      message:
        "Agent updated successfully",
      profile,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to update agent"
    );
  }
};

/* =========================================================
   REMOVE AGENT
========================================================= */

export const removeAdminAgent = async (
  req,
  res
) => {
  const { id } = req.params;

  try {
    if (
      !validateMongoId(
        res,
        id,
        "agent ID"
      )
    ) {
      return;
    }

    const result =
      await findAgentUserId(id);

    if (!result?.user) {
      return res.status(404).json({
        message: "Agent not found",
      });
    }

    const userId = result.userId;

    if (userId === req.userId) {
      return res.status(400).json({
        message:
          "You cannot remove your own agent profile",
      });
    }

    if (result.user.role === "ADMIN") {
      return res.status(400).json({
        message:
          "Admin users cannot be removed as agents",
      });
    }

    await prisma.agentProfile.deleteMany({
      where: {
        userId,
      },
    });

    await prisma.agentApplication.deleteMany({
      where: {
        userId,
      },
    });

    await archiveListingsForFormerAgent(userId);

    const updatedUser =
      await prisma.user.update({
        where: {
          id: userId,
        },

        data: {
          role: "USER",
        },

        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
          role: true,
          status: true,
        },
      });

    return res.status(200).json({
      message:
        "Agent removed successfully",
      user: updatedUser,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to remove agent"
    );
  }
};