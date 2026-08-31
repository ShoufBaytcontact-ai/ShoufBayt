import prisma from "../lib/prisma.js";
import {
  grantPremiumTrialAfterVerification,
  isLaunchPremiumFree,
  PLAN_PRICES,
  restoreAgentListings,
  TRIAL_DAYS,
} from "../lib/subscription.js";
import {
  sendAgentApplicationReceivedEmail,
  sendAgentStatusEmail,
} from "../lib/Email.js";
import { phoneUpdateFields, isValidPhone } from "../lib/phone.js";
import {
  UniqueConflictError,
  sendUniqueConflict,
  uniqueTargetMessage,
  assertPhoneAvailable,
  assertLicenseAvailable,
  assertFullNameAvailable,
} from "../lib/uniqueFields.js";

const applicationStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
];

const isValidObjectId = (id) => {
  return (
    typeof id === "string" &&
    /^[0-9a-fA-F]{24}$/.test(id)
  );
};

const cleanText = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
};

const normalizeId = (id) => {
  return String(id || "").trim();
};

const getUploadedFileUrl = (
  req,
  file
) => {
  if (!file) {
    return null;
  }

  if (file.secure_url) {
    return file.secure_url;
  }

  if (file.url) {
    return file.url;
  }

  if (
    file.path &&
    /^https?:\/\//i.test(file.path)
  ) {
    return file.path;
  }

  if (file.filename) {
    return file.secure_url || file.url || null;
  }

  return null;
};

const normalizeImageUrl = (
  req,
  image,
  fallback = "/no-avatar.png"
) => {
  const cleanedImage = cleanText(image);

  if (!cleanedImage) {
    return fallback;
  }

  if (
    cleanedImage.startsWith("http://") ||
    cleanedImage.startsWith("https://")
  ) {
    return cleanedImage;
  }

  if (
    cleanedImage.startsWith("/uploads/")
  ) {
    return `${req.protocol}://${req.get(
      "host"
    )}${cleanedImage}`;
  }

  return cleanedImage;
};

const handleError = (
  res,
  error,
  fallbackMessage
) => {
  console.error(
    fallbackMessage.toUpperCase(),
    error
  );

  if (error?.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    });
  }

  if (sendUniqueConflict(res, error)) {
    return;
  }

  if (error?.code === "P2002") {
    return res.status(409).json({
      message: uniqueTargetMessage(error),
    });
  }

  return res.status(500).json({
    message: fallbackMessage,
  });
};

const decorateAgentApplications = async (applications) => {
  const list = Array.isArray(applications) ? applications : [];
  const userIds = list.map((item) => item.userId).filter(Boolean);

  const payments = userIds.length
    ? await prisma.payment.findMany({
        where: {
          userId: { in: userIds },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const latestByUser = {};
  for (const payment of payments) {
    if (!latestByUser[payment.userId]) {
      latestByUser[payment.userId] = payment;
    }
  }

  return list.map((item) => {
    const latestPayment = latestByUser[item.userId] || null;
    const isPaid =
      isLaunchPremiumFree() ||
      payments.some(
        (payment) => payment.userId === item.userId && payment.status === "SUCCESS"
      );
    const paymentStatus = isPaid
      ? "SUCCESS"
      : latestPayment?.status || "UNPAID";

    return {
      ...item,
      name: item.fullName || item.name || item.user?.username,
      title: item.agencyName || item.title || "Real Estate Agent",
      latestPayment,
      paymentStatus,
      isPaid,
      launchPremiumFree: isLaunchPremiumFree(),
    };
  });
};

const getLatestSuccessfulPayment = async (userId) => {
  return prisma.payment.findFirst({
    where: {
      userId,
      status: "SUCCESS",
    },
    orderBy: { createdAt: "desc" },
  });
};

const validateMongoId = (
  res,
  id,
  label = "ID"
) => {
  if (!isValidObjectId(id)) {
    res.status(400).json({
      message: `Invalid ${label}`,
    });

    return false;
  }

  return true;
};

const checkAdmin = async (userId) => {
  if (!isValidObjectId(userId)) {
    return false;
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
        role: true,
        status: true,
      },
    });

  return (
    user?.role === "ADMIN" &&
    user?.status === "ACTIVE"
  );
};

const validateAdmin = async (
  req,
  res,
  message
) => {
  const isAdmin = await checkAdmin(
    req.userId
  );

  if (!isAdmin) {
    res.status(403).json({
      message,
    });

    return false;
  }

  return true;
};


const formatAgent = (user, req) => {
  const profile =
    user.agentProfile || {};

  const image = normalizeImageUrl(
    req,
    profile.image || user.avatar,
    "/no-avatar.png"
  );

  return {
    id: user.id,
    userId: user.id,
    profileId: profile.id || null,

    username: user.username,
    email: user.email,

    avatar: normalizeImageUrl(
      req,
      user.avatar,
      null
    ),

    role: user.role,
    status: user.status,

    name:
      profile.name ||
      user.username ||
      "ShoufBayt Agent",

    agencyName:
      profile.agencyName || "",

    title:
      profile.title ||
      "Real Estate Agent",

    phone: profile.phone || "",

    location:
      profile.location || "",

    bio: profile.bio || "",

    image,

    website:
      profile.website || "",

    facebook:
      profile.facebook || "",

    instagram:
      profile.instagram || "",

    linkedin:
      profile.linkedin || "",

    yearsExperience:
      profile.yearsExperience ?? null,

    rating:
      profile.rating ?? 0,

    totalReviews:
      profile.totalReviews ?? 0,

    isVerified:
      profile.isVerified ?? false,

    properties:
      user._count?.properties ||
      user.properties?.length ||
      0,

    propertyList:
      user.properties || [],

    createdAt:
      profile.createdAt ||
      user.createdAt,

    updatedAt:
      profile.updatedAt ||
      user.updatedAt,
  };
};

/* =========================================================
   AGENT INSIGHTS (value dashboard)
========================================================= */

export const getMyAgentInsights = async (req, res) => {
  const userId = req.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });

    if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) {
      return res.status(403).json({
        message: "Agent access only",
      });
    }

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const properties = await prisma.property.findMany({
      where: { userId },
      select: {
        id: true,
        views: true,
        status: true,
        _count: {
          select: {
            savedBy: true,
          },
        },
      },
    });

    const propertyViews = properties.reduce(
      (sum, item) => sum + (item.views || 0),
      0
    );
    const saves = properties.reduce(
      (sum, item) => sum + (item._count?.savedBy || 0),
      0
    );
    const publishedCount = properties.filter(
      (item) => item.status === "PUBLISHED"
    ).length;

    const inquiries = await prisma.message.count({
      where: {
        senderId: {
          not: userId,
        },
        createdAt: {
          gte: since,
        },
        chat: {
          participants: {
            some: {
              userId,
            },
          },
        },
      },
    });

    return res.status(200).json({
      periodDays: 30,
      propertyViews,
      saves,
      inquiries,
      publishedCount,
      listingCount: properties.length,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load agent insights");
  }
};

const loadAgentUser = async (userId) => {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      include: {
        agentProfile: true,
        properties: {
          orderBy: { createdAt: "desc" },
          include: { detail: true },
        },
      },
    });
  } catch (includeError) {
    console.log("LOAD AGENT USER INCLUDE ERROR:", includeError);
    return prisma.user.findUnique({
      where: { id: userId },
      include: { agentProfile: true },
    });
  }
};

export const getMyAgentProfile = async (req, res) => {
  const userId = normalizeId(req.userId);

  try {
    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    const user = await loadAgentUser(userId);

    if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) {
      return res.status(403).json({
        message: "Agent access only",
      });
    }

    if (!user.agentProfile) {
      return res.status(404).json({
        message: "Agent profile not found",
      });
    }

    return res.status(200).json(formatAgent(user, req));
  } catch (error) {
    return handleError(res, error, "Failed to load agent profile");
  }
};

export const getMyAgentListings = async (req, res) => {
  const userId = normalizeId(req.userId);

  try {
    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    let listings = [];

    try {
      listings = await prisma.property.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { detail: true },
      });
    } catch (includeError) {
      console.log("MY AGENT LISTINGS INCLUDE ERROR:", includeError);
      listings = await prisma.property.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
    }

    return res.status(200).json({
      listings,
      posts: listings,
      userPosts: listings,
    });
  } catch (error) {
    console.log("MY AGENT LISTINGS ERROR:", error);
    return handleError(res, error, "Failed to load listings");
  }
};

export const updateMyAgentProfile = async (req, res) => {
  const userId = normalizeId(req.userId);

  try {
    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    const user = await loadAgentUser(userId);

    if (!user || (user.role !== "AGENT" && user.role !== "ADMIN")) {
      return res.status(403).json({
        message: "Agent access only",
      });
    }

    if (!user.agentProfile) {
      return res.status(404).json({
        message: "Agent profile not found",
      });
    }

    const name = cleanText(req.body.fullName || req.body.name);
    const phone = cleanText(req.body.phone);
    const location = cleanText(req.body.location);
    const bio = cleanText(req.body.bio);
    const agencyName = cleanText(req.body.agencyName) || null;
    const title =
      cleanText(req.body.title) ||
      user.agentProfile.title ||
      "Real Estate Agent";
    const website =
      req.body.website !== undefined
        ? cleanText(req.body.website) || null
        : user.agentProfile.website;
    const facebook =
      req.body.facebook !== undefined
        ? cleanText(req.body.facebook) || null
        : user.agentProfile.facebook;
    const instagram =
      req.body.instagram !== undefined
        ? cleanText(req.body.instagram) || null
        : user.agentProfile.instagram;
    const linkedin =
      req.body.linkedin !== undefined
        ? cleanText(req.body.linkedin) || null
        : user.agentProfile.linkedin;

    if (!name || !phone || !location || !bio) {
      return res.status(400).json({
        message: "Full name, phone, location, and bio are required",
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        message:
          "Enter the required digits for the selected country, without the country code",
      });
    }

    if (name.length < 3) {
      return res.status(400).json({
        message: "Full name must be at least 3 characters",
      });
    }

    if (location.length < 2) {
      return res.status(400).json({
        message: "Location is required",
      });
    }

    if (bio.length < 20) {
      return res.status(400).json({
        message: "Bio must be at least 20 characters",
      });
    }

    await assertPhoneAvailable(phone, userId);
    await assertFullNameAvailable(name, userId);

    const uploadedImage = getUploadedFileUrl(req, req.file);
    const image =
      uploadedImage || user.agentProfile.image || user.avatar || null;

    await prisma.agentProfile.update({
      where: { id: user.agentProfile.id },
      data: {
        name,
        phone,
        location,
        bio,
        agencyName,
        title,
        website,
        facebook,
        instagram,
        linkedin,
        image,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        ...phoneUpdateFields(phone),
        ...(uploadedImage ? { avatar: uploadedImage } : {}),
      },
    });

    const refreshed = await loadAgentUser(userId);

    return res.status(200).json(formatAgent(refreshed, req));
  } catch (error) {
    return handleError(res, error, "Failed to update agent profile");
  }
};

/* =========================================================
   PUBLIC AGENT LIST
========================================================= */

export const getAgents = async (
  req,
  res
) => {
  try {
    // MongoDB: nested relation filters on User often return empty — load then filter
    const profiles = await prisma.agentProfile.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        user: {
          include: {
            _count: {
              select: {
                properties: true,
              },
            },
          },
        },
      },
    });

    const formattedAgents = profiles
      .filter(
        (profile) =>
          profile.user &&
          profile.user.role === "AGENT" &&
          profile.user.status === "ACTIVE"
      )
      .map((profile) =>
        formatAgent(
          {
            ...profile.user,
            agentProfile: {
              id: profile.id,
              userId: profile.userId,
              name: profile.name,
              agencyName: profile.agencyName,
              title: profile.title,
              phone: profile.phone,
              location: profile.location,
              bio: profile.bio,
              image: profile.image,
              website: profile.website,
              facebook: profile.facebook,
              instagram: profile.instagram,
              linkedin: profile.linkedin,
              yearsExperience: profile.yearsExperience,
              rating: profile.rating,
              totalReviews: profile.totalReviews,
              isVerified: profile.isVerified,
              createdAt: profile.createdAt,
              updatedAt: profile.updatedAt,
            },
            _count: profile.user._count,
          },
          req
        )
      );

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
   SINGLE AGENT
========================================================= */

export const getAgent = async (
  req,
  res
) => {
  const id = normalizeId(
    req.params.id
  );

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

    // MongoDB: nested relation filters in OR often return empty — resolve in two steps
    let agent = await prisma.user.findUnique({
      where: { id },
      include: {
        agentProfile: true,
        properties: {
          where: {
            status: "PUBLISHED",
          },
          orderBy: {
            createdAt: "desc",
          },
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
        _count: {
          select: {
            properties: true,
          },
        },
      },
    });

    if (!agent) {
      const profile = await prisma.agentProfile.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (profile?.userId) {
        agent = await prisma.user.findUnique({
          where: { id: profile.userId },
          include: {
            agentProfile: true,
            properties: {
              where: {
                status: "PUBLISHED",
              },
              orderBy: {
                createdAt: "desc",
              },
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
            _count: {
              select: {
                properties: true,
              },
            },
          },
        });
      }
    }

    if (
      !agent ||
      !agent.agentProfile ||
      agent.role !== "AGENT" ||
      agent.status !== "ACTIVE"
    ) {
      return res.status(404).json({
        message: "Agent not found",
      });
    }

    return res
      .status(200)
      .json(
        formatAgent(agent, req)
      );
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to get agent"
    );
  }
};
/* =========================================================
   SUBMIT AGENT APPLICATION
========================================================= */

export const requestAgent = async (req, res) => {
  const userId = normalizeId(req.userId);

  const fullName = cleanText(req.body.fullName || req.body.name);
  const phone = cleanText(req.body.phone);
  const agencyName = cleanText(req.body.agencyName || req.body.title) || null;
  const licenseNumber = cleanText(req.body.licenseNumber) || null;
  const location = cleanText(req.body.location);
  const bio = cleanText(req.body.bio);

  try {
    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    if (!validateMongoId(res, userId, "user ID")) {
      return;
    }

    if (!fullName || !phone || !location || !bio) {
      return res.status(400).json({
        message: "Full name, phone, location, and bio are required",
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        message:
          "Enter the required digits for the selected country, without the country code",
      });
    }

    if (fullName.length < 3) {
      return res.status(400).json({
        message: "Full name must be at least 3 characters",
      });
    }

    if (location.length < 2) {
      return res.status(400).json({
        message: "Location is required",
      });
    }

    if (bio.length < 20) {
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
        status: true,
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

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Your account must be active before applying as an agent",
      });
    }

    if (user.role === "ADMIN") {
      return res.status(400).json({
        message: "Admin accounts cannot apply to become agents",
      });
    }

    if (user.role === "AGENT" || user.agentProfile) {
      return res.status(400).json({
        message: "You are already an agent",
      });
    }

    const pendingApplication = await prisma.agentApplication.findFirst({
      where: {
        userId,
        status: "PENDING",
      },
      select: {
        id: true,
      },
    });

    if (pendingApplication) {
      return res.status(400).json({
        message: "You already have a pending agent application",
      });
    }

    await assertPhoneAvailable(phone, userId);
    await assertFullNameAvailable(fullName, userId);
    if (licenseNumber) {
      await assertLicenseAvailable(licenseNumber, userId);
    }

    const uploadedImage = getUploadedFileUrl(req, req.file);

    const image =
      uploadedImage ||
      normalizeImageUrl(req, user.avatar, null);

    const application = await prisma.agentApplication.create({
      data: {
        userId,
        fullName,
        phone,
        agencyName,
        licenseNumber,
        location,
        bio,
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
            status: true,
          },
        },
      },
    });

    try {
      const mailed = await sendAgentApplicationReceivedEmail({
        to: application.user?.email || user.email,
        username: application.user?.username || user.username,
      });
      if (!mailed) {
        console.error(
          "AGENT APPLICATION EMAIL ERROR: send returned empty result"
        );
      }
    } catch (emailError) {
      console.error("AGENT APPLICATION EMAIL ERROR:", emailError);
    }

    return res.status(201).json({
      message: "Agent application submitted successfully",
      application,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to submit agent application"
    );
  }
};

/* =========================================================
   GET CURRENT USER'S LATEST APPLICATION
========================================================= */

export const getMyAgentRequest = async (req, res) => {
  const userId = normalizeId(req.userId);

  try {
    if (!userId) {
      return res.status(401).json({
        message: "You are not logged in",
      });
    }

    if (!validateMongoId(res, userId, "user ID")) {
      return;
    }

    const application = await prisma.agentApplication.findFirst({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (!application) {
      return res.status(200).json(null);
    }

    const [decorated] = await decorateAgentApplications([application]);
    return res.status(200).json(decorated);
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to get your agent application"
    );
  }
};

// Optional cleaner export name for new routes
export const getMyAgentApplication = getMyAgentRequest;
/* =========================================================
   ADMIN: GET AGENT APPLICATIONS
========================================================= */

export const getAgentRequests = async (req, res) => {
  try {
    const isAdmin = await validateAdmin(
      req,
      res,
      "Only admins can view agent applications"
    );

    if (!isAdmin) {
      return;
    }

    const selectedStatus = cleanText(req.query.status).toUpperCase();

    const where = applicationStatuses.includes(selectedStatus)
      ? {
          status: selectedStatus,
        }
      : {};

    const applications = await prisma.agentApplication.findMany({
      where,
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
      await decorateAgentApplications(applications)
    );
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to get agent applications"
    );
  }
};

// Optional cleaner export name for new routes
export const getAgentApplications = getAgentRequests;

/* =========================================================
   ADMIN: APPROVE AGENT APPLICATION
========================================================= */

export const approveAgentRequest = async (req, res) => {
  const applicationId = normalizeId(req.params.id);

  try {
    if (!validateMongoId(res, applicationId, "application ID")) {
      return;
    }

    const isAdmin = await validateAdmin(
      req,
      res,
      "Only admins can approve agent applications"
    );

    if (!isAdmin) {
      return;
    }

    const adminId = normalizeId(req.userId);

    if (!validateMongoId(res, adminId, "admin ID")) {
      return;
    }

    const application = await prisma.agentApplication.findUnique({
      where: {
        id: applicationId,
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
        message: "Agent application not found",
      });
    }

    if (application.status !== "PENDING") {
      return res.status(400).json({
        message: "Only pending applications can be approved",
      });
    }

    if (!application.user) {
      return res.status(404).json({
        message: "Applicant user account not found",
      });
    }

    const paid = await getLatestSuccessfulPayment(application.userId);

    if (!paid && !isLaunchPremiumFree()) {
      return res.status(400).json({
        message:
          "This applicant has not completed payment yet. Approve their payment on the Payments tab first, then approve this request.",
        code: "PAYMENT_REQUIRED",
      });
    }

    if (application.user.role === "ADMIN") {
      return res.status(400).json({
        message: "Admin accounts cannot be converted to agents",
      });
    }

    await assertPhoneAvailable(
      application.phone,
      application.userId
    );

    await assertFullNameAvailable(
      application.fullName,
      application.userId
    );

    const image =
      application.image ||
      application.user.agentProfile?.image ||
      application.user.avatar ||
      null;

    const reviewedAt = new Date();

    const result = await prisma.$transaction(
      async (tx) => {
        const profile = await tx.agentProfile.upsert({
          where: {
            userId: application.userId,
          },

          update: {
            name: application.fullName,
            agencyName: application.agencyName,
            phone: application.phone,
            location: application.location,
            bio: application.bio,
            image,
            isVerified: true,
            serviceAreas: application.location
              ? [application.location]
              : [],
          },

          create: {
            userId: application.userId,
            name: application.fullName,
            agencyName: application.agencyName,
            title: "Real Estate Agent",
            phone: application.phone,
            location: application.location,
            bio: application.bio,
            image,
            isVerified: true,
            serviceAreas: application.location
              ? [application.location]
              : [],
          },
        });

        const updatedUser = await tx.user.update({
          where: {
            id: application.userId,
          },

          data: {
            role: "AGENT",
            status: "ACTIVE",
            ...phoneUpdateFields(application.phone),
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

        await tx.agentApplication.updateMany({
          where: {
            userId: application.userId,
            id: {
              not: applicationId,
            },
            status: "PENDING",
          },

          data: {
            status: "REJECTED",
            rejectionReason: "Another application was approved",
            reviewedAt,
            reviewedBy: adminId,
          },
        });

        const updatedApplication =
          await tx.agentApplication.update({
            where: {
              id: applicationId,
            },

            data: {
              status: "APPROVED",
              rejectionReason: null,
              reviewedAt,
              reviewedBy: adminId,
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

        /*
         * IMPORTANT:
         *
         * grantPremiumTrialAfterVerification must use the
         * `tx` client passed here instead of using the global
         * `prisma` client internally.
         */
        const subscription =
          await grantPremiumTrialAfterVerification(
            application.userId,
            tx
          );

        /*
         * restoreAgentListings must also use the passed
         * transaction client internally.
         */
        await restoreAgentListings(
          application.userId,
          tx
        );

        await tx.notification.create({
          data: {
            userId: application.userId,
            type: "AGENT_APPLICATION_APPROVED",
            title: "Agent application approved",

            message: subscription
              ? `You're verified. Your ${TRIAL_DAYS}-day Premium trial has started — then $${PLAN_PRICES.PREMIUM}/month. No commission on sales.`
              : `You're verified. Subscribe to Premium ($${PLAN_PRICES.PREMIUM}/month) in Billing to publish listings.`,

            link: "/billing",

            metadata: {
              applicationId,
              subscriptionId: subscription?.id || null,
            },
          },
        });

        return {
          profile,
          user: updatedUser,
          application: updatedApplication,
          subscription,
        };
      },
      {
        /*
         * Prisma interactive transactions normally timeout
         * after 5000 ms.
         *
         * This approval process performs multiple queries,
         * so give it more time.
         */
        maxWait: 5000,
        timeout: 15000,
      }
    );

    /*
     * Keep email sending OUTSIDE the database transaction.
     *
     * SMTP/network requests can be slow and should never
     * keep a database transaction open.
     */
    let emailSent = false;

    try {
      const mailed = await sendAgentStatusEmail({
        to: result.user.email,
        username: result.user.username,
        status: "APPROVED",

        trialGranted: Boolean(
          result.subscription?.isTrial
        ),

        trialEndsAt:
          result.subscription?.endDate ||
          result.subscription?.trialEnd ||
          null,

        paidUntil: result.subscription?.isTrial
          ? null
          : result.subscription?.endDate || null,
      });

      emailSent = Boolean(mailed);
    } catch (emailError) {
      console.error(
        "AGENT APPROVAL EMAIL ERROR:",
        emailError
      );
    }

    return res.status(200).json({
      message: "Agent application approved successfully",
      ...result,
      emailSent,
    });
  } catch (error) {
    console.error(
      "FAILED TO APPROVE AGENT APPLICATION",
      error
    );

    return handleError(
      res,
      error,
      "Failed to approve agent application"
    );
  }
};

// Optional cleaner export name for new routes
export const approveAgentApplication = approveAgentRequest;

/* =========================================================
   ADMIN: REJECT AGENT APPLICATION
========================================================= */

export const rejectAgentRequest = async (req, res) => {
  const applicationId = normalizeId(req.params.id);

  const rejectionReason = cleanText(
    req.body.rejectionReason || req.body.adminNote
  );

  try {
    if (!validateMongoId(res, applicationId, "application ID")) {
      return;
    }

    const isAdmin = await validateAdmin(
      req,
      res,
      "Only admins can reject agent applications"
    );

    if (!isAdmin) {
      return;
    }

    if (!validateMongoId(res, req.userId, "admin ID")) {
      return;
    }

    if (!rejectionReason) {
      return res.status(400).json({
        message: "Rejection reason is required",
      });
    }

    const application = await prisma.agentApplication.findUnique({
      where: {
        id: applicationId,
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
      },
    });

    if (!application) {
      return res.status(404).json({
        message: "Agent application not found",
      });
    }

    if (application.status !== "PENDING") {
      return res.status(400).json({
        message: "Only pending applications can be rejected",
      });
    }

    const updatedApplication = await prisma.agentApplication.update({
      where: {
        id: applicationId,
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

    await prisma.notification.create({
      data: {
        userId: application.userId,
        type: "AGENT_APPLICATION_REJECTED",
        title: "Agent application rejected",
        message: rejectionReason,
        link: "/become-agent",
        metadata: {
          applicationId,
          rejectionReason,
        },
      },
    });

    let emailSent = false;
    try {
      const mailed = await sendAgentStatusEmail({
        to: updatedApplication.user?.email || application.user?.email,
        username: updatedApplication.user?.username || application.user?.username,
        status: "REJECTED",
        reason: rejectionReason,
      });
      emailSent = Boolean(mailed);
    } catch (emailError) {
      console.error("AGENT REJECTION EMAIL ERROR:", emailError);
    }

    return res.status(200).json({
      message: "Agent application rejected successfully",
      application: updatedApplication,
      emailSent,
    });
  } catch (error) {
    return handleError(
      res,
      error,
      "Failed to reject agent application"
    );
  }
};

// Optional cleaner export name for new routes
export const rejectAgentApplication = rejectAgentRequest;