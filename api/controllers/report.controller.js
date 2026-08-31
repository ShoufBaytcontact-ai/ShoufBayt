import prisma from "../lib/prisma.js";
import { cleanText, isValidObjectId } from "../lib/subscription.js";

const REPORT_STATUSES = ["PENDING", "REVIEWED", "DISMISSED"];

const handleError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage.toUpperCase(), error);

  if (error?.code === "P2025") {
    return res.status(404).json({
      message: "Record not found",
    });
  }

  return res.status(500).json({
    message: fallbackMessage,
  });
};

/* =========================================================
   CREATE PROPERTY REPORT
========================================================= */

export const createPropertyReport = async (req, res) => {
  const reporterId = req.userId;
  const propertyId = cleanText(req.body.propertyId || req.params.id);
  const reason = cleanText(req.body.reason);

  try {
    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({
        message: "Invalid property ID",
      });
    }

    if (!reason || reason.length < 10) {
      return res.status(400).json({
        message: "Reason must be at least 10 characters",
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

    if (property.userId === reporterId) {
      return res.status(400).json({
        message: "You cannot report your own property",
      });
    }

    const existing = await prisma.propertyReport.findFirst({
      where: {
        propertyId,
        reporterId,
        status: "PENDING",
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return res.status(400).json({
        message: "You already have a pending report for this property",
      });
    }

    const report = await prisma.propertyReport.create({
      data: {
        propertyId,
        reporterId,
        reason,
        status: "PENDING",
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            slug: true,
            city: true,
          },
        },
      },
    });

    return res.status(201).json({
      message: "Report submitted successfully",
      report,
    });
  } catch (error) {
    return handleError(res, error, "Failed to submit report");
  }
};

/* =========================================================
   MY REPORTS
========================================================= */

export const getMyReports = async (req, res) => {
  const reporterId = req.userId;

  try {
    const reports = await prisma.propertyReport.findMany({
      where: {
        reporterId,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            slug: true,
            images: true,
            city: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(reports);
  } catch (error) {
    return handleError(res, error, "Failed to get reports");
  }
};

/* =========================================================
   ADMIN: LIST REPORTS
========================================================= */

export const getAdminReports = async (req, res) => {
  try {
    const status = cleanText(req.query.status).toUpperCase();

    const where = {};

    if (REPORT_STATUSES.includes(status)) {
      where.status = status;
    }

    const reports = await prisma.propertyReport.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            slug: true,
            images: true,
            city: true,
            status: true,
            userId: true,
          },
        },
        reporter: {
          select: {
            id: true,
            username: true,
            email: true,
            avatar: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(reports);
  } catch (error) {
    return handleError(res, error, "Failed to get reports");
  }
};

/* =========================================================
   ADMIN: REVIEW REPORT
========================================================= */

export const reviewPropertyReport = async (req, res) => {
  const reportId = cleanText(req.params.id);
  const adminId = req.userId;

  const status = cleanText(req.body.status).toUpperCase();
  const adminNotes = cleanText(req.body.adminNotes) || null;
  const archiveProperty = String(req.body.archiveProperty || "").toLowerCase() === "true";

  try {
    if (!isValidObjectId(reportId)) {
      return res.status(400).json({
        message: "Invalid report ID",
      });
    }

    if (!["REVIEWED", "DISMISSED"].includes(status)) {
      return res.status(400).json({
        message: "Status must be REVIEWED or DISMISSED",
      });
    }

    const report = await prisma.propertyReport.findUnique({
      where: {
        id: reportId,
      },
    });

    if (!report) {
      return res.status(404).json({
        message: "Report not found",
      });
    }

    if (report.status !== "PENDING") {
      return res.status(400).json({
        message: "This report has already been reviewed",
      });
    }

    const updated = await prisma.propertyReport.update({
      where: {
        id: reportId,
      },
      data: {
        status,
        adminNotes,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      include: {
        property: true,
        reporter: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    if (status === "REVIEWED" && archiveProperty) {
      await prisma.property.update({
        where: {
          id: report.propertyId,
        },
        data: {
          status: "ARCHIVED",
          moderationNote: adminNotes || "Archived after report review",
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      });
    }

    return res.status(200).json({
      message: `Report marked as ${status}`,
      report: updated,
    });
  } catch (error) {
    return handleError(res, error, "Failed to review report");
  }
};
