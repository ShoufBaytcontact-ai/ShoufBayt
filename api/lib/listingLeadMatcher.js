import prisma from "./prisma.js";
import {
  getCurrentSubscription,
  expireIfNeeded,
  hasActiveSubscriptionAccess,
} from "./subscription.js";

export const MAX_NOTIFY_AGENTS = 100;
export const MAX_PROPOSALS_PER_REQUEST = 10;
export const MIN_AGENT_RATING = 3.5;

const hasGoodStanding = (agent) => {
  if (!agent.isVerified) return false;
  if (Number(agent.totalReviews || 0) < 3) return true;
  return Number(agent.rating || 0) >= MIN_AGENT_RATING;
};

/**
 * Verified Premium agents who can receive listing-lead notifications.
 * Inbox itself lists every open request for Premium agents.
 */
export const findEligibleLeadAgents = async ({
  limit = MAX_NOTIFY_AGENTS,
} = {}) => {
  const profiles = await prisma.agentProfile.findMany({
    where: {
      isVerified: true,
    },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          status: true,
          username: true,
          email: true,
        },
      },
    },
  });

  const eligible = [];

  for (const agent of profiles) {
    if (!agent.user || agent.user.role !== "AGENT" || agent.user.status !== "ACTIVE") {
      continue;
    }
    if (!hasGoodStanding(agent)) continue;

    let subscription = await getCurrentSubscription(agent.userId);
    subscription = await expireIfNeeded(subscription);

    if (!hasActiveSubscriptionAccess(subscription)) continue;

    eligible.push(agent);
  }

  eligible.sort((a, b) => {
    const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return Number(b.totalReviews || 0) - Number(a.totalReviews || 0);
  });

  return eligible.slice(0, Math.max(0, limit));
};
