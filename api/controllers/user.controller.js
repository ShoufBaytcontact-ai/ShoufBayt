import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import { cleanPhone, isValidPhone, phoneUpdateFields } from "../lib/phone.js";
import {
  UniqueConflictError,
  sendUniqueConflict,
  uniqueTargetMessage,
  assertUsernameAvailable,
  assertEmailAvailable,
  assertPhoneAvailable,
  normalizeEmail,
  normalizeUsername,
} from "../lib/uniqueFields.js";
import { sendAgentStatusEmail } from "../lib/Email.js";
import {
  grantPremiumTrialAfterVerification,
  PLAN_PRICES,
  restoreAgentListings,
  TRIAL_DAYS,
} from "../lib/subscription.js";
import { notificationBadgeWhere } from "../lib/notify.js";
import { getStoredFileUrl } from "../lib/cloudStorage.js";

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

const isValidObjectId = (id) => {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
};

const removePassword = (user) => {
  if (!user) {
    return null;
  }

  const { password, ...userInfo } = user;
  return userInfo;
};

const formatProperty = (property) => {
  if (!property) {
    return null;
  }

  const agent = property.user || {};
  const profile = agent.agentProfile || {};

  return {
    ...property,
    postDetail: property.detail || null,
    bedroom: property.bedrooms,
    bathroom: property.bathrooms,
    type:
      property.listingType === "SALE"
        ? "buy"
        : property.listingType?.toLowerCase(),
    property: property.propertyType?.toLowerCase(),
    managedBy: agent.id
      ? {
          id: agent.id,
          profileId: profile.id || "",
          name: profile.name || agent.username || "",
          agencyName: profile.agencyName || "",
          avatar: profile.image || agent.avatar || "",
        }
      : null,
  };
};

export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: "AGENT",
        status: "ACTIVE",
      },
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
        agentProfile: {
          select: {
            id: true,
            name: true,
            agencyName: true,
            isVerified: true,
            image: true,
          },
        },
      },
    });

    return res.status(200).json(users);
  } catch (err) {
    console.log("GET USERS ERROR:", err);
    return res.status(500).json({
      message: "Failed to get users",
    });
  }
};

export const getUser = async (req, res) => {
  const id = req.params.id;

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
      include: {
        agentProfile: true,
        _count: {
          select: {
            properties: true,
            savedProperties: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json(removePassword(user));
  } catch (error) {
    console.log("GET USER ERROR:", error);

    return res.status(500).json({
      message: "Failed to get user",
    });
  }
};

export const updateUser = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  if (id !== tokenUserId) {
    return res.status(403).json({
      message: "Not authorized!",
    });
  }

  const { username, email, password, phone } = req.body;

  try {
    const updatedData = {};

    if (username && username.trim()) {
      updatedData.username = normalizeUsername(username);
      await assertUsernameAvailable(updatedData.username, id);
    }

    if (email && email.trim()) {
      updatedData.email = normalizeEmail(email);
      await assertEmailAvailable(updatedData.email, id);
    }

    if (password) {
      const nextPassword = String(password).trim();

      if (!passwordRegex.test(nextPassword)) {
        return res.status(400).json({
          message:
            "Password must contain at least 6 characters, uppercase, lowercase, number, and special character",
        });
      }

      updatedData.password = await bcrypt.hash(nextPassword, 10);
    }

    if (phone !== undefined) {
      const nextPhone = cleanPhone(phone);

      if (!nextPhone) {
        Object.assign(updatedData, phoneUpdateFields(""));
      } else if (!isValidPhone(nextPhone)) {
        return res.status(400).json({
          message:
            "Enter the required digits for the selected country, without the country code",
        });
      } else {
        await assertPhoneAvailable(nextPhone, id);
        Object.assign(updatedData, phoneUpdateFields(nextPhone));
      }
    }

    if (req.file) {
      updatedData.avatar = getStoredFileUrl(req, req.file);
    }

    if (Object.keys(updatedData).length === 0) {
      return res.status(400).json({
        message: "No data provided",
      });
    }

    const updatedUser = await prisma.user.update({
      where: {
        id,
      },
      data: updatedData,
      include: {
        agentProfile: true,
      },
    });

    if (Object.prototype.hasOwnProperty.call(updatedData, "phone")) {
      await prisma.agentProfile.updateMany({
        where: { userId: id },
        data: { phone: updatedData.phone || "" },
      });
    }

    return res.status(200).json(removePassword(updatedUser));
  } catch (error) {
    console.log("UPDATE USER ERROR:", error);

    if (sendUniqueConflict(res, error)) {
      return;
    }

    if (error.code === "P2002") {
      return res.status(400).json({
        message: uniqueTargetMessage(error),
      });
    }

    if (error.code === "P2025") {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(500).json({
      message: "Failed to update user",
    });
  }
};

export const updateAgentStatus = async (req, res) => {
  const id = req.params.id;
  const { status, reason } = req.body;
  const adminId = req.userId;

  const normalizedStatus = String(status || "").trim().toUpperCase();

  const finalStatus =
    normalizedStatus === "ACCEPTED"
      ? "APPROVED"
      : normalizedStatus === "REJECTED"
        ? "REJECTED"
        : normalizedStatus;

  const allowedStatuses = ["APPROVED", "REJECTED"];

  if (!allowedStatuses.includes(finalStatus)) {
    return res.status(400).json({
      message: "Invalid agent status",
    });
  }

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const admin = await prisma.user.findUnique({
      where: {
        id: adminId,
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!admin || admin.role !== "ADMIN" || admin.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Only admins can update agent status",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id,
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
        message: "Admin accounts cannot be converted to agents",
      });
    }

    const application = await prisma.agentApplication.findFirst({
      where: {
        userId: id,
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let updatedUser = user;
    let profile = user.agentProfile;
    let subscription = null;

    if (finalStatus === "APPROVED") {
      profile = await prisma.agentProfile.upsert({
        where: {
          userId: id,
        },
        update: {
          name: application?.fullName || user.username,
          agencyName: application?.agencyName || null,
          phone: application?.phone || profile?.phone || "",
          location: application?.location || profile?.location || "",
          bio: application?.bio || profile?.bio || "",
          image:
            application?.image ||
            profile?.image ||
            user.avatar ||
            null,
          isVerified: true,
        },
        create: {
          userId: id,
          name: application?.fullName || user.username,
          agencyName: application?.agencyName || null,
          title: "Real Estate Agent",
          phone: application?.phone || "",
          location: application?.location || "",
          bio: application?.bio || "Approved ShoufBayt agent",
          image: application?.image || user.avatar || null,
          isVerified: true,
        },
      });

      updatedUser = await prisma.user.update({
        where: {
          id,
        },
        data: {
          role: "AGENT",
          status: "ACTIVE",
        },
      });

      subscription = await grantPremiumTrialAfterVerification(id);
      await restoreAgentListings(id);

      if (application) {
        await prisma.agentApplication.update({
          where: {
            id: application.id,
          },
          data: {
            status: "APPROVED",
            rejectionReason: null,
            reviewedAt: new Date(),
            reviewedBy: adminId,
          },
        });

        await prisma.agentApplication.updateMany({
          where: {
            userId: id,
            id: {
              not: application.id,
            },
            status: "PENDING",
          },
          data: {
            status: "REJECTED",
            rejectionReason: "Another application was approved",
            reviewedAt: new Date(),
            reviewedBy: adminId,
          },
        });
      }

      await prisma.notification.create({
        data: {
          userId: id,
          type: "AGENT_APPLICATION_APPROVED",
          title: "Agent application approved",
          message: subscription
            ? `You're verified. Your ${TRIAL_DAYS}-day Premium trial has started — then $${PLAN_PRICES.PREMIUM}/month. No commission on sales.`
            : `You're verified. Subscribe to Premium ($${PLAN_PRICES.PREMIUM}/month) in Billing to publish listings.`,
          link: "/billing",
          metadata: {
            applicationId: application?.id || null,
            subscriptionId: subscription?.id || null,
          },
        },
      });
    } else {
      const rejectionReason =
        String(reason || "").trim() || "Application rejected by admin";

      if (application) {
        await prisma.agentApplication.update({
          where: {
            id: application.id,
          },
          data: {
            status: "REJECTED",
            rejectionReason,
            reviewedAt: new Date(),
            reviewedBy: adminId,
          },
        });
      }

      await prisma.notification.create({
        data: {
          userId: id,
          type: "AGENT_APPLICATION_REJECTED",
          title: "Agent application rejected",
          message: rejectionReason,
          link: "/become-agent",
          metadata: {
            applicationId: application?.id || null,
            rejectionReason,
          },
        },
      });
    }

    let emailSent = false;

    try {
      const mailed = await sendAgentStatusEmail({
        to: updatedUser.email,
        username: updatedUser.username,
        status: finalStatus,
        reason,
        trialGranted: Boolean(subscription?.isTrial),
        trialEndsAt: subscription?.endDate || subscription?.trialEnd || null,
        paidUntil: subscription?.isTrial ? null : subscription?.endDate || null,
      });
      emailSent = Boolean(mailed);
    } catch (emailError) {
      emailSent = false;
      console.error("AGENT STATUS EMAIL ERROR:", emailError);
    }

    return res.status(200).json({
      message:
        finalStatus === "APPROVED"
          ? "Agent accepted successfully"
          : "Agent rejected successfully",
      user: removePassword(updatedUser),
      profile,
      subscription,
      emailSent,
    });
  } catch (error) {
    console.log("UPDATE AGENT STATUS ERROR:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(500).json({
      message: "Failed to update agent status",
    });
  }
};

export const deleteUser = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  if (id !== tokenUserId) {
    return res.status(403).json({
      message: "Not authorized!",
    });
  }

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id,
      },
      include: {
        agentProfile: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (user.role === "ADMIN") {
      const adminCount = await prisma.user.count({
        where: {
          role: "ADMIN",
        },
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          message: "Cannot delete the last admin account",
        });
      }
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
        _count: {
          select: {
            participants: true,
          },
        },
      },
    });

    const chatsToDelete = [];
    const chatsToKeep = [];

    for (const chat of userChats) {
      if (chat._count.participants <= 2) {
        chatsToDelete.push(chat.id);
      } else {
        chatsToKeep.push(chat.id);
      }
    }

    if (chatsToDelete.length > 0) {
      await prisma.message.deleteMany({
        where: {
          chatId: {
            in: chatsToDelete,
          },
        },
      });

      await prisma.chatParticipant.deleteMany({
        where: {
          chatId: {
            in: chatsToDelete,
          },
        },
      });

      await prisma.chat.deleteMany({
        where: {
          id: {
            in: chatsToDelete,
          },
        },
      });
    }

    if (chatsToKeep.length > 0) {
      await prisma.chatParticipant.deleteMany({
        where: {
          chatId: {
            in: chatsToKeep,
          },
          userId: id,
        },
      });
    }

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

    if (user.agentProfile?.id) {
      await prisma.agentReview.deleteMany({
        where: {
          OR: [
            {
              reviewerId: id,
            },
            {
              agentProfileId: user.agentProfile.id,
            },
          ],
        },
      });
    } else {
      await prisma.agentReview.deleteMany({
        where: {
          reviewerId: id,
        },
      });
    }

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

    await prisma.chat.updateMany({
      where: {
        propertyId: {
          in: propertyIds,
        },
      },
      data: {
        propertyId: null,
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
    console.log("DELETE USER ERROR:", error);

    return res.status(500).json({
      message: "Failed to delete user",
    });
  }
};

export const savePost = async (req, res) => {
  const propertyId = req.params.id;
  const tokenUserId = req.userId;

  try {
    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({
        message: "Invalid property ID",
      });
    }

    const property = await prisma.property.findUnique({
      where: {
        id: propertyId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!property) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    const savedProperty = await prisma.savedProperty.findUnique({
      where: {
        userId_propertyId: {
          userId: tokenUserId,
          propertyId,
        },
      },
    });

    if (savedProperty) {
      await prisma.savedProperty.delete({
        where: {
          id: savedProperty.id,
        },
      });

      return res.status(200).json({
        message: "Property removed from saved list",
      });
    }

    await prisma.savedProperty.create({
      data: {
        userId: tokenUserId,
        propertyId,
      },
    });

    return res.status(200).json({
      message: "Property saved successfully",
    });
  } catch (error) {
    console.log("SAVE POST ERROR:", error);

    return res.status(500).json({
      message: "Failed to save property",
    });
  }
};

export const profilePosts = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    const currentUser = await prisma.user.findUnique({
      where: {
        id: tokenUserId,
      },
      select: {
        role: true,
        status: true,
      },
    });

    if (
      currentUser?.status === "ACTIVE" &&
      (currentUser.role === "AGENT" || currentUser.role === "ADMIN")
    ) {
      await restoreAgentListings(tokenUserId);
    }

    const currentRole = String(currentUser?.role || "").toUpperCase();
    const isAgentAccount = currentRole === "AGENT" || currentRole === "ADMIN";

    const propertyInclude = {
      detail: true,
      user: {
        select: {
          id: true,
          username: true,
          avatar: true,
          agentProfile: {
            select: {
              id: true,
              name: true,
              agencyName: true,
              image: true,
            },
          },
        },
      },
      _count: {
        select: {
          savedBy: true,
          reports: true,
          reviews: true,
        },
      },
    };

    const listingOrder = { createdAt: "desc" };

    const loadOwnedListings = async () => {
      try {
        const owner = await prisma.user.findUnique({
          where: { id: tokenUserId },
          select: {
            properties: {
              include: propertyInclude,
              orderBy: listingOrder,
            },
          },
        });

        if (Array.isArray(owner?.properties) && owner.properties.length) {
          return owner.properties;
        }
      } catch (relationError) {
        console.log("PROFILE POSTS RELATION ERROR:", relationError);
      }

      try {
        return await prisma.property.findMany({
          where: { userId: tokenUserId },
          include: propertyInclude,
          orderBy: listingOrder,
        });
      } catch (includeError) {
        console.log("PROFILE POSTS INCLUDE ERROR:", includeError);
        return prisma.property.findMany({
          where: { userId: tokenUserId },
          orderBy: listingOrder,
        });
      }
    };

    const [ownedListings, requestedListings] = await Promise.all([
      loadOwnedListings(),
      isAgentAccount
        ? Promise.resolve([])
        : prisma.property.findMany({
            where: { requestedByUserId: tokenUserId },
            include: propertyInclude,
            orderBy: listingOrder,
          }).catch(() => []),
    ]);

    const listingsById = new Map();
    [...ownedListings, ...requestedListings].forEach((property) => {
      listingsById.set(property.id, property);
    });
    const userPosts = [...listingsById.values()].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const saved = await prisma.savedProperty.findMany({
      where: {
        userId: tokenUserId,
      },
      include: {
        property: {
          include: {
            detail: true,
            _count: {
              select: {
                savedBy: true,
                reports: true,
                reviews: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const savedPosts = saved
      .map((item) => formatProperty(item.property))
      .filter(Boolean);

    const mappedPosts = userPosts.map(formatProperty).filter(Boolean);

    return res.status(200).json({
      userPosts: mappedPosts,
      posts: mappedPosts,
      listings: mappedPosts,
      savedPosts,
    });
  } catch (error) {
    console.log("PROFILE POSTS ERROR:", error);

    return res.status(500).json({
      message: "Failed to get profile posts",
    });
  }
};

export const getNotificationNumber = async (req, res) => {
  const tokenUserId = req.userId;

  try {
    if (!tokenUserId) {
      return res.status(401).json({ message: "You are not logged in!" });
    }

    const [unreadNotifications, inboxChats] = await Promise.all([
      prisma.notification.count({
        where: {
          ...notificationBadgeWhere(tokenUserId, req.userRole),
          isRead: false,
        },
      }),
      prisma.chat.findMany({
        where: {
          kind: { not: "SUPPORT" },
          participants: {
            some: {
              userId: tokenUserId,
            },
          },
        },
        select: {
          messages: {
            where: {
              isRead: false,
              deletedForEveryone: false,
              senderId: {
                not: tokenUserId,
              },
            },
            select: {
              hiddenForIds: true,
            },
          },
        },
      }),
    ]);

    const unreadMessages = inboxChats.reduce((total, chat) => {
      const visible = (chat.messages || []).filter(
        (message) => !message.hiddenForIds?.includes(tokenUserId)
      ).length;
      return total + visible;
    }, 0);

    return res.status(200).json({
      unreadNotifications,
      unreadMessages,
      total: unreadNotifications + unreadMessages,
    });
  } catch (error) {
    console.log("GET NOTIFICATION NUMBER ERROR:", error);

    return res.status(500).json({
      message: "Failed to get notification number",
    });
  }
};

/* =========================================================
   OWNER DASHBOARD
========================================================= */

export const getOwnerDashboard = async (req, res) => {
  const ownerId = req.userId;

  try {
    const properties = await prisma.property.findMany({
      where: { requestedByUserId: ownerId },
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            agentProfile: {
              select: {
                id: true,
                name: true,
                agencyName: true,
                phone: true,
                location: true,
              },
            },
          },
        },
        _count: {
          select: {
            savedBy: true,
            chats: true,
            appointments: true,
          },
        },
      },
    });

    const propertyIds = properties.map((item) => item.id);

    const [appointments, agentUpdates, openRequests, upcomingCount] =
      await Promise.all([
        propertyIds.length
          ? prisma.appointment.findMany({
              where: { ownerId },
              orderBy: { scheduledAt: "desc" },
              take: 20,
              include: {
                property: {
                  select: {
                    id: true,
                    title: true,
                    city: true,
                    images: true,
                    slug: true,
                  },
                },
                agent: {
                  select: {
                    id: true,
                    username: true,
                    avatar: true,
                    agentProfile: {
                      select: { name: true, agencyName: true },
                    },
                  },
                },
              },
            })
          : Promise.resolve([]),
        prisma.notification.findMany({
          where: {
            userId: ownerId,
            type: {
              in: [
                "LISTING_REQUEST",
                "LISTING_PROPOSAL",
                "LISTING_REQUEST_ACCEPTED",
                "LISTING_PROPOSAL_ACCEPTED",
                "PROPERTY_APPROVED",
                "PROPERTY_REJECTED",
                "APPOINTMENT_SCHEDULED",
                "APPOINTMENT_UPDATED",
                "APPOINTMENT_REQUESTED",
                "NEW_MESSAGE",
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
        prisma.listingRequest.findMany({
          where: {
            requesterId: ownerId,
            status: { in: ["OPEN", "PENDING"] },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            proposals: {
              include: {
                agentProfile: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                    isVerified: true,
                    userId: true,
                    user: {
                      select: {
                        id: true,
                        username: true,
                        avatar: true,
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        }),
        propertyIds.length
          ? prisma.appointment.count({
              where: {
                ownerId,
                status: { in: ["PENDING", "CONFIRMED", "RESCHEDULED"] },
                scheduledAt: { gte: new Date() },
              },
            })
          : Promise.resolve(0),
      ]);

    const now = new Date();

    const propertyCards = properties.map((property) => {
      const agentProfile = property.user?.agentProfile;
      const managedByName =
        agentProfile?.agencyName ||
        agentProfile?.name ||
        property.user?.username ||
        "Your agent";

      return {
        id: property.id,
        slug: property.slug,
        title: property.title,
        city: property.city,
        address: property.address,
        price: property.price,
        images: property.images || [],
        status: property.status,
        propertyType: property.propertyType,
        listingType: property.listingType,
        views: property.views || 0,
        interestedBuyers: property._count?.savedBy || 0,
        offersReceived: property._count?.chats || 0,
        scheduledVisits: property._count?.appointments || 0,
        managedBy: {
          id: property.user?.id || null,
          username: property.user?.username || null,
          avatar: property.user?.avatar || null,
          name: agentProfile?.name || property.user?.username || null,
          agencyName: agentProfile?.agencyName || null,
          phone: agentProfile?.phone || null,
          displayName: managedByName,
        },
      };
    });

    const stats = {
      views: propertyCards.reduce((sum, item) => sum + item.views, 0),
      interestedBuyers: propertyCards.reduce(
        (sum, item) => sum + item.interestedBuyers,
        0
      ),
      scheduledVisits: upcomingCount,
      offersReceived: propertyCards.reduce(
        (sum, item) => sum + item.offersReceived,
        0
      ),
      propertyCount: propertyCards.length,
      activeCount: propertyCards.filter((item) => item.status === "PUBLISHED")
        .length,
      openRequestCount: openRequests.length,
    };

    const appointmentCards = appointments.map((item) => {
      const when = new Date(item.scheduledAt);
      let timeline = "upcoming";
      if (item.status === "COMPLETED") timeline = "completed";
      else if (item.status === "CANCELLED") timeline = "cancelled";
      else if (when < now && item.status !== "COMPLETED") timeline = "past";

      return {
        id: item.id,
        scheduledAt: item.scheduledAt,
        status: item.status,
        timeline,
        visitorName: item.visitorName || null,
        visitorPhone: item.visitorPhone || null,
        notes: item.notes || null,
        property: item.property
          ? {
              id: item.property.id,
              title: item.property.title,
              city: item.property.city,
              images: item.property.images || [],
              slug: item.property.slug,
            }
          : null,
        agent: {
          id: item.agent?.id || null,
          name:
            item.agent?.agentProfile?.name ||
            item.agent?.username ||
            "Agent",
          agencyName: item.agent?.agentProfile?.agencyName || null,
          avatar: item.agent?.avatar || null,
        },
      };
    });

    return res.status(200).json({
      stats,
      properties: propertyCards,
      appointments: appointmentCards,
      agentUpdates,
      openRequests,
    });
  } catch (error) {
    console.error("GET OWNER DASHBOARD ERROR:", error);
    return res.status(500).json({
      message: "Failed to load owner dashboard",
    });
  }
};
