import prisma from "../lib/prisma.js";
import { getRealtimeOnlineUsers } from "../lib/realtime.js";

const LISTED = ["PUBLISHED", "SOLD", "RENTED"];

const monthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const buildMonthBuckets = (months = 6) => {
  const buckets = [];
  const now = new Date();

  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    buckets.push({
      key: monthKey(date),
      year: date.getFullYear(),
      month: date.getMonth(),
      listings: 0,
    });
  }

  return buckets;
};

export const getPublicStats = async (req, res) => {
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const [
      liveListings,
      sold,
      rented,
      forSale,
      forRent,
      agents,
      members,
      cityGroups,
      recentListings,
    ] = await Promise.all([
      prisma.property.count({
        where: { status: "PUBLISHED" },
      }),
      prisma.property.count({
        where: { status: "SOLD" },
      }),
      prisma.property.count({
        where: { status: "RENTED" },
      }),
      prisma.property.count({
        where: {
          status: { in: LISTED },
          listingType: "SALE",
        },
      }),
      prisma.property.count({
        where: {
          status: { in: LISTED },
          listingType: "RENT",
        },
      }),
      prisma.agentProfile.count({
        where: { isVerified: true },
      }),
      prisma.user.count({
        where: { status: "ACTIVE" },
      }),
      prisma.property.groupBy({
        by: ["city"],
        where: {
          status: { in: LISTED },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.property.findMany({
        where: {
          status: { in: LISTED },
          createdAt: { gte: since },
        },
        select: {
          createdAt: true,
        },
      }),
    ]);

    const cityCounts = new Map(
      cityGroups
        .map((row) => [String(row.city || "").trim(), row._count._all])
        .filter(([city]) => city)
    );
    const monthly = buildMonthBuckets(6);

    recentListings.forEach((row) => {
      if (!row.createdAt) {
        return;
      }

      const key = monthKey(new Date(row.createdAt));
      const bucket = monthly.find((item) => item.key === key);
      if (bucket) {
        bucket.listings += 1;
      }
    });

    const topCities = [...cityCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([city, count]) => ({ city, count }));

    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      onlineNow: getRealtimeOnlineUsers().length,
      liveListings,
      sold,
      rented,
      forSale,
      forRent,
      agents,
      members,
      cities: cityCounts.size,
      closed: sold + rented,
      monthly,
      topCities,
    });
  } catch (error) {
    console.error("PUBLIC STATS ERROR", error);
    return res.status(500).json({
      message: "Failed to load live numbers",
    });
  }
};
