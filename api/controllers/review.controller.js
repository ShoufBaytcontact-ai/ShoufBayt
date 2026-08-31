import prisma from "../lib/prisma.js";
import { cleanText, isValidObjectId } from "../lib/subscription.js";

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage.toUpperCase(), error);

  if (error?.code === "P2002") {
    return res.status(409).json({
      message: "You already reviewed this item",
    });
  }

  if (error?.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    });
  }

  return res.status(500).json({
    message: fallbackMessage,
  });
};

const parseRating = (value) => {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return null;
  }

  return rating;
};

const refreshAgentRating = async (agentProfileId) => {
  const stats = await prisma.agentReview.aggregate({
    where: {
      agentProfileId,
    },
    _avg: {
      rating: true,
    },
    _count: {
      rating: true,
    },
  });

  await prisma.agentProfile.update({
    where: {
      id: agentProfileId,
    },
    data: {
      rating: Number((stats._avg.rating || 0).toFixed(2)),
      totalReviews: stats._count.rating || 0,
    },
  });
};

/* =========================================================
   CREATE PROPERTY REVIEW
========================================================= */

export const createPropertyReview = async (req, res) => {
  const reviewerId = req.userId;
  const propertyId = cleanText(req.body.propertyId || req.params.id);
  const rating = parseRating(req.body.rating);
  const comment = cleanText(req.body.comment) || null;

  try {
    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({
        message: "Invalid property ID",
      });
    }

    if (!rating) {
      return res.status(400).json({
        message: "Rating must be an integer between 1 and 5",
      });
    }

    const property = await prisma.property.findUnique({
      where: {
        id: propertyId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!property) {
      return res.status(404).json({
        message: "Property not found",
      });
    }

    if (property.userId === reviewerId) {
      return res.status(400).json({
        message: "You cannot review your own property",
      });
    }

    const review = await prisma.propertyReview.create({
      data: {
        propertyId,
        reviewerId,
        rating,
        comment,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: "Review submitted successfully",
      review,
    });
  } catch (error) {
    return handleError(res, error, "Failed to create property review");
  }
};

/* =========================================================
   GET PROPERTY REVIEWS
========================================================= */

export const getPropertyReviews = async (req, res) => {
  const propertyId = cleanText(req.params.id);

  try {
    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({
        message: "Invalid property ID",
      });
    }

    const reviews = await prisma.propertyReview.findMany({
      where: {
        propertyId,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(reviews);
  } catch (error) {
    return handleError(res, error, "Failed to get property reviews");
  }
};

/* =========================================================
   CREATE AGENT REVIEW
========================================================= */

export const createAgentReview = async (req, res) => {
  const reviewerId = req.userId;
  const agentProfileId = cleanText(
    req.body.agentProfileId || req.params.id
  );
  const rating = parseRating(req.body.rating);
  const comment = cleanText(req.body.comment) || null;

  try {
    if (!isValidObjectId(agentProfileId)) {
      return res.status(400).json({
        message: "Invalid agent profile ID",
      });
    }

    if (!rating) {
      return res.status(400).json({
        message: "Rating must be an integer between 1 and 5",
      });
    }

    const agentProfile = await prisma.agentProfile.findUnique({
      where: {
        id: agentProfileId,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!agentProfile) {
      return res.status(404).json({
        message: "Agent profile not found",
      });
    }

    if (agentProfile.userId === reviewerId) {
      return res.status(400).json({
        message: "You cannot review yourself",
      });
    }

    const review = await prisma.agentReview.create({
      data: {
        agentProfileId,
        reviewerId,
        rating,
        comment,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    await refreshAgentRating(agentProfileId);

    return res.status(201).json({
      message: "Agent review submitted successfully",
      review,
    });
  } catch (error) {
    return handleError(res, error, "Failed to create agent review");
  }
};

/* =========================================================
   GET AGENT REVIEWS
========================================================= */

export const getAgentReviews = async (req, res) => {
  const agentProfileId = cleanText(req.params.id);

  try {
    if (!isValidObjectId(agentProfileId)) {
      return res.status(400).json({
        message: "Invalid agent profile ID",
      });
    }

    const reviews = await prisma.agentReview.findMany({
      where: {
        agentProfileId,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(reviews);
  } catch (error) {
    return handleError(res, error, "Failed to get agent reviews");
  }
};

/* =========================================================
   UPDATE OWN REVIEW
========================================================= */

export const updateMyPropertyReview = async (req, res) => {
  const reviewerId = req.userId;
  const reviewId = cleanText(req.params.id);
  const rating = parseRating(req.body.rating);
  const comment = cleanText(req.body.comment) || null;

  try {
    if (!isValidObjectId(reviewId)) {
      return res.status(400).json({
        message: "Invalid review ID",
      });
    }

    if (!rating) {
      return res.status(400).json({
        message: "Rating must be an integer between 1 and 5",
      });
    }

    const review = await prisma.propertyReview.findUnique({
      where: {
        id: reviewId,
      },
    });

    if (!review) {
      return res.status(404).json({
        message: "Review not found",
      });
    }

    if (review.reviewerId !== reviewerId) {
      return res.status(403).json({
        message: "You can only edit your own review",
      });
    }

    const updated = await prisma.propertyReview.update({
      where: {
        id: reviewId,
      },
      data: {
        rating,
        comment,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    return res.status(200).json({
      message: "Review updated",
      review: updated,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update review");
  }
};

export const updateMyAgentReview = async (req, res) => {
  const reviewerId = req.userId;
  const reviewId = cleanText(req.params.id);
  const rating = parseRating(req.body.rating);
  const comment = cleanText(req.body.comment) || null;

  try {
    if (!isValidObjectId(reviewId)) {
      return res.status(400).json({
        message: "Invalid review ID",
      });
    }

    if (!rating) {
      return res.status(400).json({
        message: "Rating must be an integer between 1 and 5",
      });
    }

    const review = await prisma.agentReview.findUnique({
      where: {
        id: reviewId,
      },
    });

    if (!review) {
      return res.status(404).json({
        message: "Review not found",
      });
    }

    if (review.reviewerId !== reviewerId) {
      return res.status(403).json({
        message: "You can only edit your own review",
      });
    }

    const updated = await prisma.agentReview.update({
      where: {
        id: reviewId,
      },
      data: {
        rating,
        comment,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    await refreshAgentRating(review.agentProfileId);

    return res.status(200).json({
      message: "Agent review updated",
      review: updated,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update agent review");
  }
};

/* =========================================================
   DELETE OWN REVIEW
========================================================= */

export const deleteMyPropertyReview = async (req, res) => {
  const reviewerId = req.userId;
  const reviewId = cleanText(req.params.id);

  try {
    if (!isValidObjectId(reviewId)) {
      return res.status(400).json({
        message: "Invalid review ID",
      });
    }

    const review = await prisma.propertyReview.findUnique({
      where: {
        id: reviewId,
      },
    });

    if (!review) {
      return res.status(404).json({
        message: "Review not found",
      });
    }

    if (review.reviewerId !== reviewerId) {
      return res.status(403).json({
        message: "You can only delete your own review",
      });
    }

    await prisma.propertyReview.delete({
      where: {
        id: reviewId,
      },
    });

    return res.status(200).json({
      message: "Review deleted",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete review");
  }
};

export const deleteMyAgentReview = async (req, res) => {
  const reviewerId = req.userId;
  const reviewId = cleanText(req.params.id);

  try {
    if (!isValidObjectId(reviewId)) {
      return res.status(400).json({
        message: "Invalid review ID",
      });
    }

    const review = await prisma.agentReview.findUnique({
      where: {
        id: reviewId,
      },
    });

    if (!review) {
      return res.status(404).json({
        message: "Review not found",
      });
    }

    if (review.reviewerId !== reviewerId) {
      return res.status(403).json({
        message: "You can only delete your own review",
      });
    }

    await prisma.agentReview.delete({
      where: {
        id: reviewId,
      },
    });

    await refreshAgentRating(review.agentProfileId);

    return res.status(200).json({
      message: "Agent review deleted",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete agent review");
  }
};
