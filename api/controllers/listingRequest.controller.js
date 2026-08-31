import prisma from "../lib/prisma.js";
import { assertAgentSubscriptionAccess, ensureAgentProfile } from "../lib/subscription.js";
import {
  findEligibleLeadAgents,
  MAX_PROPOSALS_PER_REQUEST,
} from "../lib/listingLeadMatcher.js";
import { createNotification } from "../lib/notify.js";
import {
  sendListingLeadEmail,
  sendListingProposalAcceptedEmail,
  sendListingProposalReceivedEmail,
  sendListingProposalRejectedEmail,
  sendListingRequestAwardedEmail,
  sendListingRequestReceivedEmail,
  sendListingRequestRejectedEmail,
} from "../lib/listingRequestEmail.js";

const PROPERTY_TYPES = [
  "APARTMENT",
  "HOUSE",
  "LAND",
  "VILLA",
  "OFFICE",
  "SHOP",
  "WAREHOUSE",
];

const LISTING_TYPES = ["SALE", "RENT"];

const isValidObjectId = (id) =>
  typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);

const cleanText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const parseJsonField = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return {};
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    const err = new Error(`Invalid JSON for ${fieldName}`);
    err.status = 400;
    throw err;
  }
};

const toInt = (value, label, { allowZero = false } = {}) => {
  const number = Number(value);

  if (!Number.isFinite(number) || (!allowZero && number <= 0)) {
    const err = new Error(`${label} must be a valid number`);
    err.status = 400;
    throw err;
  }

  if (allowZero && number < 0) {
    const err = new Error(`${label} cannot be negative`);
    err.status = 400;
    throw err;
  }

  return Math.round(number);
};

const toFloat = (value, label) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    const err = new Error(`${label} must be a valid number`);
    err.status = 400;
    throw err;
  }

  return number;
};

const normalizeListingType = (value) => {
  const raw = cleanText(value).toUpperCase();
  if (raw === "BUY" || raw === "SALE" || raw === "SELL") return "SALE";
  if (raw === "RENT") return "RENT";
  return LISTING_TYPES.includes(raw) ? raw : null;
};

const normalizePropertyType = (value) => {
  const raw = cleanText(value).toUpperCase();
  return PROPERTY_TYPES.includes(raw) ? raw : null;
};

const slugify = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "property";

const getImageUrl = (req, file) => {
  if (!file) return "";
  if (file.secure_url) return file.secure_url;
  if (file.url) return file.url;
  if (file.path && /^https?:\/\//i.test(file.path)) return file.path;
  if (file.filename) {
    return file.secure_url || file.url || "";
  }
  return file.path || "";
};

const getUploadedImages = (req) => {
  const files = Array.isArray(req.files) ? req.files : [];
  return files
    .filter((file) => !file.fieldname || file.fieldname === "images")
    .map((file) => getImageUrl(req, file))
    .filter(Boolean)
    .slice(0, 20);
};

const isMongoDuplicate = (error) =>
  error?.code === 11000 ||
  error?.errorResponse?.code === 11000 ||
  /E11000/.test(String(error?.message || ""));

const isTransactionUnsupported = (error) => {
  const message = String(error?.message || "");
  return (
    /replica set/i.test(message) ||
    /transaction numbers are only allowed/i.test(message)
  );
};

const unwrapError = (error) => {
  if (!error || typeof error !== "object") return error;
  if (error.status) return error;
  if (error.cause && typeof error.cause === "object") return error.cause;
  return error;
};

const handleError = (res, error, fallback) => {
  console.error(fallback.toUpperCase(), error);
  const err = unwrapError(error);

  if (err?.code === "P2025") {
    return res.status(404).json({ message: "Record not found" });
  }

  if (err?.code === "P2002" || isMongoDuplicate(err) || isMongoDuplicate(error)) {
    const target = Array.isArray(err?.meta?.target)
      ? err.meta.target.join(", ")
      : err?.meta?.target || "unique field";
    return res.status(409).json({
      message: `A record with the same ${target} already exists`,
      code: "UNIQUE_CONFLICT",
    });
  }

  const status = err?.status || error?.status;
  return res.status(status || 500).json({
    message: status ? err?.message || error?.message : fallback,
    code: err?.code || error?.code,
  });
};

const fail = (status, message, code) => {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  throw err;
};

const toSafeInt = (value, fallback = 0) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? number : fallback;
};

const uniquePropertySlug = async (db, title) => {
  const base = slugify(title);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = `${base}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const exists = await db.property.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) return slug;
  }
  return `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const notify = async (payload) => createNotification(payload);

const isOpenStatus = (status) =>
  status === "OPEN" || status === "PENDING";

const proposalStatusOf = (status) => String(status || "").toUpperCase();

const isBlockingProposal = (status) => {
  const value = proposalStatusOf(status);
  return value === "PENDING" || value === "ACCEPTED";
};

const proposalInclude = {
  agentProfile: {
    select: {
      id: true,
      name: true,
      agencyName: true,
      title: true,
      phone: true,
      location: true,
      image: true,
      rating: true,
      totalReviews: true,
      yearsExperience: true,
      isVerified: true,
      userId: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
        },
      },
    },
  },
};

const inviteInclude = {
  agentProfile: {
    select: {
      id: true,
      name: true,
      title: true,
      phone: true,
      location: true,
      image: true,
      userId: true,
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          avatar: true,
        },
      },
    },
  },
};

const requestInclude = {
  requester: {
    select: {
      id: true,
      username: true,
      email: true,
      avatar: true,
    },
  },
  acceptedByAgent: {
    select: {
      id: true,
      name: true,
      userId: true,
    },
  },
  property: {
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
    },
  },
  invites: {
    include: inviteInclude,
    orderBy: { createdAt: "asc" },
  },
  proposals: {
    include: proposalInclude,
    orderBy: { createdAt: "desc" },
  },
};

const parseRequestBody = (req) => {
  const data =
    req.body.requestData !== undefined
      ? parseJsonField(req.body.requestData, "requestData")
      : req.body.postData !== undefined
        ? parseJsonField(req.body.postData, "postData")
        : req.body;

  const detail =
    req.body.postDetail !== undefined
      ? parseJsonField(req.body.postDetail, "postDetail")
      : req.body.detail !== undefined
        ? parseJsonField(req.body.detail, "detail")
        : {};

  return { data, detail };
};

/* =========================================================
   USER: CREATE LISTING REQUEST (details only → matched leads)
========================================================= */

export const createListingRequest = async (req, res) => {
  const requesterId = req.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: requesterId },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        role: true,
      },
    });

    if (!user || user.status === "SUSPENDED" || user.status === "BANNED") {
      return res.status(403).json({ message: "Account cannot create requests" });
    }

    if (String(user.role || "").toUpperCase() === "AGENT") {
      return res.status(403).json({
        message:
          "Agents should publish their own listings from Add listing. Listing requests are for homeowners seeking an agent.",
        code: "AGENT_USE_OWN_LISTING",
      });
    }

    const { data, detail } = parseRequestBody(req);

    const title = cleanText(data.title);
    const address = cleanText(data.address);
    const city = cleanText(data.city);
    const listingType = normalizeListingType(data.listingType || data.type);
    const propertyType = normalizePropertyType(data.propertyType || data.property);
    const description = cleanText(
      detail.description || detail.desc || data.description || data.desc
    );

    if (!title || !address || !city) {
      return res.status(400).json({
        message: "Title, address, and city are required",
      });
    }

    if (!listingType || !propertyType) {
      return res.status(400).json({
        message: "Listing type and property type are required",
      });
    }

    if (!description || description.length < 20) {
      return res.status(400).json({
        message: "Description must be at least 20 characters",
      });
    }

    const price = toInt(data.price, "Price");
    const bedrooms = toInt(data.bedrooms ?? data.bedroom ?? 0, "Bedrooms", {
      allowZero: true,
    });
    const bathrooms = toInt(data.bathrooms ?? data.bathroom ?? 0, "Bathrooms", {
      allowZero: true,
    });
    const latitude = toFloat(data.latitude, "Latitude");
    const longitude = toFloat(data.longitude, "Longitude");
    const areaValue = data.area ?? detail.size ?? detail.area;
    const area =
      areaValue === undefined || areaValue === null || areaValue === ""
        ? null
        : toInt(areaValue, "Area");

    const images = getUploadedImages(req);

    if (images.length === 0) {
      return res.status(400).json({
        message: "At least one image is required",
      });
    }

    const eligibleAgents = (await findEligibleLeadAgents()).filter(
      (agent) => agent.userId !== requesterId
    );

    const request = await prisma.listingRequest.create({
      data: {
        requesterId,
        title,
        price,
        images,
        address,
        city,
        latitude,
        longitude,
        bedrooms,
        bathrooms,
        area,
        propertyType,
        listingType,
        description,
        contactName: cleanText(data.contactName) || user.username,
        contactPhone: cleanText(data.contactPhone) || null,
        contactEmail: cleanText(data.contactEmail) || user.email,
        status: "OPEN",
        invites: {
          create: eligibleAgents.map((agent) => ({
            agentProfileId: agent.id,
            status: "NOTIFIED",
          })),
        },
      },
      include: requestInclude,
    });

    await notify({
      userId: requesterId,
      type: "LISTING_REQUEST",
      title: "Listing request submitted",
      message: `We received “${title}”. Please wait while verified agents submit proposals.`,
      link: "/owner",
      requireRole: ["USER", "ADMIN"],
      metadata: {
        listingRequestId: request.id,
      },
    });

    sendListingRequestReceivedEmail({
      to: user.email,
      username: user.username,
      title,
      city,
      listingType,
      propertyType,
      price,
    });

    await Promise.all(
      eligibleAgents.map(async (agent) => {
        const agentUser = agent.user || {};
        if (String(agentUser.role || "").toUpperCase() !== "AGENT") {
          return;
        }

        await notify({
          userId: agent.userId,
          type: "LISTING_LEAD",
          title: "New listing lead",
          message: `A homeowner in ${city} needs an agent for “${title}”. Submit a proposal (max ${MAX_PROPOSALS_PER_REQUEST} total).`,
          link: "/agent",
          requireRole: "AGENT",
          metadata: {
            listingRequestId: request.id,
          },
        });

        sendListingLeadEmail({
          to: agentUser.email,
          username: agentUser.username || agent.name,
          title,
          city,
          listingType,
          propertyType,
          price,
        });
      })
    );

    return res.status(201).json({
      ...request,
      notifiedCount: eligibleAgents.length,
      maxProposals: MAX_PROPOSALS_PER_REQUEST,
    });
  } catch (error) {
    return handleError(res, error, "Failed to create listing request");
  }
};

/* =========================================================
   USER: MY REQUESTS / DETAIL / CANCEL
========================================================= */

export const getMyListingRequests = async (req, res) => {
  try {
    const requests = await prisma.listingRequest.findMany({
      where: { requesterId: req.userId },
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json(requests);
  } catch (error) {
    return handleError(res, error, "Failed to load listing requests");
  }
};

export const getListingRequestById = async (req, res) => {
  const id = cleanText(req.params.id);

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid request ID" });
    }

    const request = await prisma.listingRequest.findUnique({
      where: { id },
      include: requestInclude,
    });

    if (!request) {
      return res.status(404).json({ message: "Listing request not found" });
    }

    const agent = await prisma.agentProfile.findUnique({
      where: { userId: req.userId },
      select: { id: true },
    });

    const isRequester = request.requesterId === req.userId;
    const isLeadAgent =
      Boolean(agent) && request.requesterId !== req.userId;

    if (!isRequester && !isLeadAgent) {
      return res.status(403).json({ message: "Not allowed to view this request" });
    }

    return res.status(200).json(request);
  } catch (error) {
    return handleError(res, error, "Failed to load listing request");
  }
};

export const cancelListingRequest = async (req, res) => {
  const id = cleanText(req.params.id);

  try {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid request ID" });
    }

    const request = await prisma.listingRequest.findFirst({
      where: {
        id,
        requesterId: req.userId,
      },
    });

    if (!request) {
      return res.status(404).json({ message: "Listing request not found" });
    }

    if (!isOpenStatus(request.status)) {
      return res.status(400).json({
        message: "Only open requests can be cancelled",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.listingRequestInvite.updateMany({
        where: {
          listingRequestId: id,
          status: { in: ["NOTIFIED", "PENDING", "PROPOSED"] },
        },
        data: {
          status: "EXPIRED",
          respondedAt: new Date(),
        },
      });

      await tx.listingProposal.updateMany({
        where: {
          listingRequestId: id,
          status: "PENDING",
        },
        data: { status: "REJECTED" },
      });

      return tx.listingRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: requestInclude,
      });
    });

    return res.status(200).json(updated);
  } catch (error) {
    return handleError(res, error, "Failed to cancel listing request");
  }
};

/* =========================================================
   AGENT: LEADS INBOX
========================================================= */

export const getAgentLeads = async (req, res) => {
  try {
    const access = await assertAgentSubscriptionAccess(req.userId);

    if (access?.user?.role === "ADMIN") {
      return res.status(200).json([]);
    }

    const agent = await ensureAgentProfile(req.userId);

    if (!agent) {
      return res.status(403).json({ message: "Agent profile required" });
    }

    // Show open owner listing requests only — never leads submitted by agents
    const requests = await prisma.listingRequest.findMany({
      where: {
        status: { in: ["OPEN", "PENDING"] },
        NOT: { requesterId: req.userId },
      },
      include: {
        requester: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        proposals: {
          where: { agentProfileId: agent.id },
          include: proposalInclude,
          orderBy: { updatedAt: "desc" },
        },
        _count: {
          select: {
            proposals: {
              where: { status: { in: ["PENDING", "ACCEPTED"] } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const ownerRequests = requests.filter(
      (item) => String(item.requester?.role || "").toUpperCase() !== "AGENT"
    );

    const leads = ownerRequests.map((listingRequest) => {
      const myProposal = listingRequest.proposals?.[0];
      const proposalStatus = proposalStatusOf(myProposal?.status);
      const isActiveProposal = isBlockingProposal(proposalStatus);

      return {
        id: listingRequest.id,
        status: isActiveProposal ? "PROPOSED" : "NOTIFIED",
        canProposeAgain: !isActiveProposal,
        listingRequest,
      };
    });

    return res.status(200).json(leads);
  } catch (error) {
    return handleError(res, error, "Failed to load agent leads");
  }
};

/** @deprecated alias — use getAgentLeads */
export const getAgentListingInbox = getAgentLeads;

/* =========================================================
   AGENT: SUBMIT / WITHDRAW PROPOSAL
========================================================= */

export const submitListingProposal = async (req, res) => {
  const listingRequestId = cleanText(req.params.id);

  try {
    if (!isValidObjectId(listingRequestId)) {
      return res.status(400).json({ message: "Invalid request ID" });
    }

    await assertAgentSubscriptionAccess(req.userId);

    const agent = await ensureAgentProfile(req.userId);

    if (!agent || !agent.isVerified) {
      return res.status(403).json({
        message: "Verified agent profile required to submit proposals",
      });
    }

    const message = cleanText(req.body.message);
    const estimatedDays = toInt(req.body.estimatedDays, "Estimated days");
    const commissionPercent = toFloat(
      req.body.commissionPercent,
      "Commission percent"
    );

    if (message.length < 20) {
      return res.status(400).json({
        message: "Proposal message must be at least 20 characters",
      });
    }

    if (commissionPercent < 0 || commissionPercent > 100) {
      return res.status(400).json({
        message: "Commission percent must be between 0 and 100",
      });
    }

    const invite =
      (await prisma.listingRequestInvite.findFirst({
        where: {
          listingRequestId,
          agentProfileId: agent.id,
        },
      })) ||
      (await prisma.listingRequestInvite.create({
        data: {
          listingRequestId,
          agentProfileId: agent.id,
          status: "NOTIFIED",
        },
      }));

    const request = await prisma.listingRequest.findUnique({
      where: { id: listingRequestId },
      include: {
        _count: {
          select: {
            proposals: {
              where: { status: { in: ["PENDING", "ACCEPTED"] } },
            },
          },
        },
      },
    });

    if (!request || !isOpenStatus(request.status)) {
      return res.status(409).json({
        message: "This listing request is no longer open for proposals",
        code: "REQUEST_CLOSED",
      });
    }

    if (request.requesterId === req.userId) {
      return res.status(403).json({
        message: "You cannot propose on your own listing request",
      });
    }

    const requester = await prisma.user.findUnique({
      where: { id: request.requesterId },
      select: { role: true, email: true, username: true },
    });

    if (String(requester?.role || "").toUpperCase() === "AGENT") {
      return res.status(403).json({
        message: "Listing requests from agents are not open for proposals",
        code: "AGENT_OWNED_REQUEST",
      });
    }

    const mine = await prisma.listingProposal.findMany({
      where: {
        listingRequestId,
        agentProfileId: agent.id,
      },
      orderBy: { updatedAt: "desc" },
    });

    const reusable = mine.find((item) => !isBlockingProposal(item.status));
    const activeMine = mine.filter((item) => isBlockingProposal(item.status));

    if (!reusable && activeMine.length) {
      return res.status(409).json({
        message: "You already submitted a proposal for this listing",
        code: "PROPOSAL_EXISTS",
      });
    }

    const activeCount = await prisma.listingProposal.count({
      where: {
        listingRequestId,
        status: { in: ["PENDING", "ACCEPTED"] },
        NOT: { agentProfileId: agent.id },
      },
    });

    if (activeCount >= MAX_PROPOSALS_PER_REQUEST) {
      return res.status(400).json({
        message: `This listing already has the maximum of ${MAX_PROPOSALS_PER_REQUEST} proposals`,
        code: "PROPOSAL_CAP",
      });
    }

    const proposal = await prisma.$transaction(async (tx) => {
      let created;

      if (reusable) {
        created = await tx.listingProposal.update({
          where: { id: reusable.id },
          data: {
            message,
            estimatedDays,
            commissionPercent,
            status: "PENDING",
          },
          include: proposalInclude,
        });

        const leftoverIds = mine
          .map((item) => item.id)
          .filter((id) => id !== reusable.id);

        if (leftoverIds.length) {
          await tx.listingProposal.updateMany({
            where: { id: { in: leftoverIds } },
            data: { status: "WITHDRAWN" },
          });
        }
      } else {
        try {
          created = await tx.listingProposal.create({
            data: {
              listingRequestId,
              agentProfileId: agent.id,
              message,
              estimatedDays,
              commissionPercent,
              status: "PENDING",
            },
            include: proposalInclude,
          });
        } catch (createError) {
          const duplicate = unwrapError(createError);
          if (
            duplicate?.code !== "P2002" &&
            !isMongoDuplicate(duplicate) &&
            !isMongoDuplicate(createError)
          ) {
            throw createError;
          }

          const fallback = await tx.listingProposal.findFirst({
            where: {
              listingRequestId,
              agentProfileId: agent.id,
            },
            orderBy: { updatedAt: "desc" },
          });

          if (!fallback || isBlockingProposal(fallback.status)) {
            throw createError;
          }

          created = await tx.listingProposal.update({
            where: { id: fallback.id },
            data: {
              message,
              estimatedDays,
              commissionPercent,
              status: "PENDING",
            },
            include: proposalInclude,
          });
        }
      }

      await tx.listingRequestInvite.update({
        where: { id: invite.id },
        data: {
          status: "PROPOSED",
          respondedAt: new Date(),
        },
      });

      return created;
    });

    await notify({
      userId: request.requesterId,
      type: "LISTING_PROPOSAL",
      title: "New agent proposal",
      message: `${agent.name || "An agent"} proposed to list “${request.title}” (${commissionPercent}% · ~${estimatedDays} days).`,
      link: "/owner",
      requireRole: ["USER", "ADMIN"],
      metadata: {
        listingRequestId,
        proposalId: proposal.id,
      },
    });

    sendListingProposalReceivedEmail({
      to: requester?.email,
      username: requester?.username,
      title: request.title,
      city: request.city,
      address: request.address,
      listingType: request.listingType,
      propertyType: request.propertyType,
      price: request.price,
      bedrooms: request.bedrooms,
      bathrooms: request.bathrooms,
      area: request.area,
      agentName: agent.name,
      agencyName: agent.agencyName,
      agentTitle: agent.title,
      agentPhone: agent.phone,
      agentLocation: agent.location,
      yearsExperience: agent.yearsExperience,
      rating: agent.rating,
      totalReviews: agent.totalReviews,
      message,
      commissionPercent,
      estimatedDays,
    });

    return res.status(201).json(proposal);
  } catch (error) {
    return handleError(res, error, "Failed to submit proposal");
  }
};

export const withdrawListingProposal = async (req, res) => {
  const proposalId = cleanText(req.params.id);

  try {
    if (!isValidObjectId(proposalId)) {
      return res.status(400).json({ message: "Invalid proposal ID" });
    }

    const agent = await ensureAgentProfile(req.userId);

    if (!agent) {
      return res.status(403).json({ message: "Agent profile required" });
    }

    const proposal = await prisma.listingProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal || proposal.agentProfileId !== agent.id) {
      return res.status(404).json({ message: "Proposal not found" });
    }

    if (proposal.status !== "PENDING") {
      return res.status(400).json({ message: "Only pending proposals can be withdrawn" });
    }

    const updated = await prisma.listingProposal.update({
      where: { id: proposalId },
      data: { status: "WITHDRAWN" },
      include: proposalInclude,
    });

    return res.status(200).json(updated);
  } catch (error) {
    return handleError(res, error, "Failed to withdraw proposal");
  }
};

/* =========================================================
   OWNER: ACCEPT / REJECT PROPOSAL
========================================================= */

const awardProposal = async (db, { listingRequestId, proposalId, userId }) => {
  const request = await db.listingRequest.findUnique({
    where: { id: listingRequestId },
  });

  if (!request || request.requesterId !== userId) {
    fail(404, "Listing request not found");
  }

  if (!isOpenStatus(request.status)) {
    fail(409, "This request is no longer open", "REQUEST_CLOSED");
  }

  const proposal = await db.listingProposal.findUnique({
    where: { id: proposalId },
    include: {
      agentProfile: {
        select: {
          id: true,
          userId: true,
          name: true,
          phone: true,
          agencyName: true,
          user: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      },
    },
  });

  if (
    !proposal ||
    proposal.listingRequestId !== listingRequestId ||
    proposal.status !== "PENDING"
  ) {
    fail(409, "Proposal not available");
  }

  const agentUserId = proposal.agentProfile?.userId;
  if (!agentUserId) {
    fail(409, "This agent account is no longer available");
  }

  const agentUser = await db.user.findUnique({
    where: { id: agentUserId },
    select: { id: true, status: true },
  });

  if (!agentUser || agentUser.status === "SUSPENDED" || agentUser.status === "BANNED") {
    fail(409, "This agent account is no longer available");
  }

  const listingType = normalizeListingType(request.listingType);
  const propertyType = normalizePropertyType(request.propertyType);

  if (!listingType || !propertyType) {
    fail(400, "This listing request has invalid property details");
  }

  const images = (Array.isArray(request.images) ? request.images : []).filter(
    (image) => typeof image === "string" && image.trim()
  );

  if (images.length === 0) {
    fail(400, "This listing request has no images to publish");
  }

  const latitude = Number(request.latitude);
  const longitude = Number(request.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    fail(400, "This listing request has an invalid map location");
  }

  const slug = await uniquePropertySlug(db, request.title);
  const description = cleanText(request.description) || request.title;

  const property = await db.property.create({
    data: {
      slug,
      title: request.title,
      price: toSafeInt(request.price),
      images,
      address: request.address,
      city: request.city,
      latitude,
      longitude,
      bedrooms: toSafeInt(request.bedrooms, 0),
      bathrooms: toSafeInt(request.bathrooms, 0),
      area:
        request.area === undefined || request.area === null
          ? null
          : toSafeInt(request.area),
      propertyType,
      listingType,
      status: "PUBLISHED",
      publishedAt: new Date(),
      userId: agentUserId,
      requestedByUserId: request.requesterId,
      detail: {
        create: {
          description,
          amenities: [],
        },
      },
    },
  });

  const admins = await db.user.findMany({
    where: {
      role: "ADMIN",
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  await Promise.all(
    admins.map((admin) =>
      notify({
        userId: admin.id,
        type: "GENERAL",
        title: "New listing published",
        message: `"${property.title}" is now live on ShoufBayt.`,
        link: "/admin",
        metadata: {
          propertyId: property.id,
          kind: "PUBLISHED_LISTING",
        },
      })
    )
  );

  await db.listingProposal.update({
    where: { id: proposal.id },
    data: { status: "ACCEPTED" },
  });

  const autoRejected = await db.listingProposal.findMany({
    where: {
      listingRequestId,
      id: { not: proposal.id },
      status: { in: ["PENDING", "WITHDRAWN"] },
    },
    include: {
      agentProfile: {
        select: {
          userId: true,
          name: true,
          user: {
            select: {
              email: true,
              username: true,
            },
          },
        },
      },
    },
  });

  await db.listingProposal.updateMany({
    where: {
      listingRequestId,
      id: { not: proposal.id },
      status: { in: ["PENDING", "WITHDRAWN"] },
    },
    data: { status: "REJECTED" },
  });

  await db.listingRequestInvite.updateMany({
    where: {
      listingRequestId,
      NOT: { agentProfileId: proposal.agentProfileId },
    },
    data: {
      status: "EXPIRED",
      respondedAt: new Date(),
    },
  });

  await db.listingRequestInvite.updateMany({
    where: {
      listingRequestId,
      agentProfileId: proposal.agentProfileId,
    },
    data: {
      status: "ACCEPTED",
      respondedAt: new Date(),
    },
  });

  const updatedRequest = await db.listingRequest.update({
    where: { id: listingRequestId },
    data: {
      status: "AWARDED",
      acceptedByAgentId: proposal.agentProfileId,
      acceptedAt: new Date(),
      propertyId: property.id,
    },
    select: {
      id: true,
      title: true,
      status: true,
      propertyId: true,
      acceptedByAgentId: true,
      acceptedAt: true,
    },
  });

  return { property, updatedRequest, proposal, request, autoRejected };
};

export const acceptListingProposal = async (req, res) => {
  const listingRequestId = cleanText(req.params.id);
  const proposalId = cleanText(req.params.proposalId);

  try {
    if (!isValidObjectId(listingRequestId) || !isValidObjectId(proposalId)) {
      return res.status(400).json({ message: "Invalid IDs" });
    }

    const payload = {
      listingRequestId,
      proposalId,
      userId: req.userId,
    };

    let result;
    try {
      result = await prisma.$transaction((tx) => awardProposal(tx, payload), {
        maxWait: 8000,
        timeout: 20000,
      });
    } catch (error) {
      if (!isTransactionUnsupported(error)) {
        throw error;
      }
      result = await awardProposal(prisma, payload);
    }

    const agentProfile = result.proposal.agentProfile || {};
    const awardedRequest = result.request || result.updatedRequest;
    const awardedProperty = result.property;
    const owner =
      awardedRequest?.contactEmail
        ? {
            email: awardedRequest.contactEmail,
            username: awardedRequest.contactName,
          }
        : await prisma.user.findUnique({
            where: { id: req.userId },
            select: { email: true, username: true },
          });

    sendListingProposalAcceptedEmail({
      to: agentProfile.user?.email,
      username: agentProfile.name || agentProfile.user?.username,
      title: awardedProperty?.title || awardedRequest?.title,
      city: awardedProperty?.city || awardedRequest?.city,
      address: awardedProperty?.address || awardedRequest?.address,
      listingType: awardedProperty?.listingType || awardedRequest?.listingType,
      propertyType: awardedProperty?.propertyType || awardedRequest?.propertyType,
      price: awardedProperty?.price || awardedRequest?.price,
      bedrooms: awardedProperty?.bedrooms ?? awardedRequest?.bedrooms,
      bathrooms: awardedProperty?.bathrooms ?? awardedRequest?.bathrooms,
      area: awardedProperty?.area ?? awardedRequest?.area,
      commissionPercent: result.proposal.commissionPercent,
      estimatedDays: result.proposal.estimatedDays,
      ownerName: awardedRequest?.contactName,
      ownerPhone: awardedRequest?.contactPhone,
      ownerEmail: awardedRequest?.contactEmail,
      propertyId: awardedProperty?.id,
    });

    sendListingRequestAwardedEmail({
      to: owner?.email,
      username: owner?.username || awardedRequest?.contactName,
      title: awardedProperty?.title || awardedRequest?.title,
      city: awardedProperty?.city || awardedRequest?.city,
      address: awardedProperty?.address || awardedRequest?.address,
      listingType: awardedProperty?.listingType || awardedRequest?.listingType,
      propertyType: awardedProperty?.propertyType || awardedRequest?.propertyType,
      price: awardedProperty?.price || awardedRequest?.price,
      agentName: agentProfile.name || agentProfile.user?.username,
      agencyName: agentProfile.agencyName,
      agentPhone: agentProfile.phone,
      commissionPercent: result.proposal.commissionPercent,
      estimatedDays: result.proposal.estimatedDays,
      propertyId: awardedProperty?.id,
    });

    try {
      await notify({
        userId: result.proposal.agentProfile?.userId,
        type: "LISTING_PROPOSAL_ACCEPTED",
        title: "Proposal accepted",
        message: `The owner chose you for “${result.updatedRequest.title}”. Listing is pending admin publish.`,
        link: `/properties/${result.property.id}`,
        requireRole: "AGENT",
        metadata: {
          propertyId: result.property.id,
          listingRequestId,
        },
      });

      await notify({
        userId: req.userId,
        type: "LISTING_REQUEST_ACCEPTED",
        title: "Listing request accepted",
        message: `You accepted ${agentProfile.name || "an agent"} to list “${result.updatedRequest.title}”.`,
        link: `/properties/${result.property.id}`,
        requireRole: ["USER", "ADMIN"],
        metadata: {
          propertyId: result.property.id,
          listingRequestId,
        },
      });

      const losers = result.autoRejected || [];

      await Promise.all(
        losers.map((item) => {
          sendListingProposalRejectedEmail({
            to: item.agentProfile?.user?.email,
            username:
              item.agentProfile?.name || item.agentProfile?.user?.username,
            title: result.updatedRequest.title,
            city: awardedRequest?.city,
            ownerName: awardedRequest?.contactName,
            commissionPercent: item.commissionPercent,
            estimatedDays: item.estimatedDays,
            anotherChosen: true,
          });

          return notify({
            userId: item.agentProfile?.userId,
            type: "LISTING_PROPOSAL_REJECTED",
            title: "Proposal not selected",
            message: `Another agent was chosen for “${result.updatedRequest.title}”. This request is now closed.`,
            link: "/agent",
            requireRole: "AGENT",
          });
        })
      );
    } catch (notifyError) {
      console.error("ACCEPT PROPOSAL NOTIFY", notifyError);
    }

    return res.status(200).json({
      message: "Proposal accepted",
      property: result.property,
      request: result.updatedRequest,
    });
  } catch (error) {
    return handleError(res, error, "Failed to accept proposal");
  }
};

export const rejectListingProposal = async (req, res) => {
  const listingRequestId = cleanText(req.params.id);
  const proposalId = cleanText(req.params.proposalId);

  try {
    if (!isValidObjectId(listingRequestId) || !isValidObjectId(proposalId)) {
      return res.status(400).json({ message: "Invalid IDs" });
    }

    const request = await prisma.listingRequest.findUnique({
      where: { id: listingRequestId },
    });

    if (!request || request.requesterId !== req.userId) {
      return res.status(404).json({ message: "Listing request not found" });
    }

    if (!isOpenStatus(request.status)) {
      return res.status(409).json({
        message: "This request is no longer open",
        code: "REQUEST_CLOSED",
      });
    }

    const proposal = await prisma.listingProposal.findUnique({
      where: { id: proposalId },
      include: {
        agentProfile: {
          select: {
            id: true,
            userId: true,
            name: true,
            user: {
              select: {
                email: true,
                username: true,
              },
            },
          },
        },
      },
    });

    if (
      !proposal ||
      proposal.listingRequestId !== listingRequestId ||
      proposal.status !== "PENDING"
    ) {
      return res.status(409).json({ message: "Proposal not available" });
    }

    const updated = await prisma.listingProposal.update({
      where: { id: proposal.id },
      data: { status: "REJECTED" },
      include: proposalInclude,
    });

    await prisma.listingProposal.updateMany({
      where: {
        listingRequestId,
        agentProfileId: proposal.agentProfileId,
        status: "PENDING",
      },
      data: { status: "REJECTED" },
    });

    await prisma.listingRequestInvite.updateMany({
      where: {
        listingRequestId,
        agentProfileId: proposal.agentProfileId,
      },
      data: {
        status: "NOTIFIED",
        respondedAt: new Date(),
      },
    });

    const ownerEmail =
      request.contactEmail ||
      (
        await prisma.user.findUnique({
          where: { id: req.userId },
          select: { email: true },
        })
      )?.email;

    sendListingProposalRejectedEmail({
      to: proposal.agentProfile?.user?.email,
      username: proposal.agentProfile?.name || proposal.agentProfile?.user?.username,
      title: request.title,
      city: request.city,
      ownerName: request.contactName,
      commissionPercent: proposal.commissionPercent,
      estimatedDays: proposal.estimatedDays,
    });

    sendListingRequestRejectedEmail({
      to: ownerEmail,
      username: request.contactName,
      title: request.title,
      city: request.city,
      agentName: proposal.agentProfile?.name || proposal.agentProfile?.user?.username,
    });

    try {
      await notify({
        userId: proposal.agentProfile?.userId,
        type: "LISTING_PROPOSAL_REJECTED",
        title: "Proposal declined",
        message: `The owner declined your proposal for “${request.title}”. You can send a new proposal until they accept someone.`,
        link: "/agent",
        requireRole: "AGENT",
        metadata: {
          listingRequestId,
          proposalId: proposal.id,
        },
      });

      await notify({
        userId: request.requesterId,
        type: "LISTING_REQUEST_REJECTED",
        title: "Proposal declined",
        message: `You declined ${proposal.agentProfile?.name || "an agent"}’s proposal for “${request.title}”. They can send another offer, and other agents can still propose, until you accept one.`,
        link: "/owner",
        requireRole: ["USER", "ADMIN"],
        metadata: {
          listingRequestId,
          proposalId: proposal.id,
        },
      });
    } catch (notifyError) {
      console.error("REJECT PROPOSAL NOTIFY", notifyError);
    }

    return res.status(200).json({
      message: "Proposal rejected",
      proposal: updated,
    });
  } catch (error) {
    return handleError(res, error, "Failed to reject proposal");
  }
};

/* =========================================================
   LEGACY stubs (kept for old clients)
========================================================= */

export const acceptListingInvite = async (req, res) => {
  return res.status(410).json({
    message:
      "Direct invite accept is retired. Submit a proposal from Agent Hub → Leads.",
    code: "USE_PROPOSALS",
  });
};

export const rejectListingInvite = async (req, res) => {
  return res.status(410).json({
    message: "Use proposal withdraw or ignore the lead instead.",
    code: "USE_PROPOSALS",
  });
};
