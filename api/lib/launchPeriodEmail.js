import prisma from "./prisma.js";
import { trySendMail } from "./sendEmail.js";
import {
  FREE_SELF_LISTINGS,
  GRACE_DAYS,
  PLAN_PRICES,
  TRIAL_DAYS,
  getPremiumFreeUntil,
  isLaunchPremiumFree,
} from "./subscription.js";
import {
  escapeHtml,
  getClientUrl,
  getPublicClientUrl,
  wrapEmailHtml,
  wrapEmailText,
} from "./emailLayout.js";

export const LAUNCH_PERIOD_CAMPAIGN = "launch_period_ended";
export const LAUNCH_PERIOD_LINK = "/billing?src=launch-end";

const formatWhen = (value) => {
  if (!value) return "the launch date";
  try {
    return new Date(value).toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return String(value);
  }
};

const normalizeRole = (role) => {
  const value = String(role || "USER").toUpperCase();
  if (value === "AGENT" || value === "ADMIN") return value;
  return "USER";
};

const perkTable = (items) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px 0;border:1px solid #ece7dc;border-radius:12px;overflow:hidden;">
    ${items
      .map(
        (item, index) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:${
          index === items.length - 1 ? "none" : "1px solid #ece7dc"
        };font-size:14px;line-height:1.55;color:#17150f;">
          <span style="display:inline-block;width:8px;height:8px;background:#e2b84a;margin-right:10px;vertical-align:middle;"></span>
          ${escapeHtml(item)}
        </td>
      </tr>`
      )
      .join("")}
  </table>
`;

export const getLaunchPeriodCopy = (role, { username, test = false } = {}) => {
  const name = username || "there";
  const price = PLAN_PRICES.PREMIUM;
  const until = formatWhen(getPremiumFreeUntil());
  const billingUrl = `${getClientUrl()}/billing`;
  const publicBillingUrl = getPublicClientUrl()
    ? `${getPublicClientUrl()}/billing`
    : "";
  const testNote = test
    ? "This is a test preview sent by an administrator. Live members receive this after the complimentary month ends."
    : "";

  if (role === "ADMIN") {
    return {
      subject: test
        ? "[Test] Launch month complete — staff briefing"
        : "Launch month is complete — staff briefing",
      notificationTitle: "Launch month is complete",
      notificationMessage:
        "Complimentary Premium has ended. Users now have 1 free self-listing. Agents need Premium to keep office tools.",
      payload: {
        preheader:
          "Complimentary Premium has ended. Staff access is unchanged.",
        eyebrow: "Staff briefing",
        title: "The complimentary launch month is complete",
        greeting: `Dear ${escapeHtml(name)},`,
        paragraphs: [
          `ShoufBayt’s complimentary Premium window ended on <strong>${escapeHtml(
            until
          )}</strong>. Your admin access is not billed and does not change.`,
          "From today, the platform follows the published plan rules:",
        ],
        details: [
          { label: "Your role", value: "Administrator" },
          { label: "Staff billing", value: "Not required" },
          {
            label: "Users",
            value: `${FREE_SELF_LISTINGS} free self-listing, then $${price}/month`,
          },
          {
            label: "Agents",
            value: `${TRIAL_DAYS}-day trial after verification, then $${price}/month`,
          },
        ],
        highlightHtml: perkTable([
          "Review agent requests, listings, payments, and support as usual",
          "Users can still browse, save, message, and ask an agent to list for free",
          "Agents keep office tools only with an active Premium period or trial",
          `After a paid period ends, agents have ${GRACE_DAYS} days to renew before the account returns to a regular user`,
        ]),
        ctaLabel: "Open billing",
        ctaUrl: publicBillingUrl,
        note:
          testNote ||
          `Use Billing and the admin office to follow payments and agent unlocks. ${billingUrl}`,
      },
    };
  }

  if (role === "AGENT") {
    return {
      subject: test
        ? "[Test] Your complimentary agent Premium has ended"
        : "Your complimentary agent Premium has ended",
      notificationTitle: "Complimentary Premium has ended",
      notificationMessage: `Agent Premium is $${price}/month after the launch month. Open Billing to keep your office, listings, and request tools.`,
      payload: {
        preheader: `Complimentary agent Premium ended on ${until}. Renew for $${price}/month to keep your office.`,
        eyebrow: "Agent Premium",
        title: "Your complimentary Premium month has ended",
        greeting: `Dear ${escapeHtml(name)},`,
        paragraphs: [
          `Thank you for launching with ShoufBayt. Complimentary Premium for verified agents ended on <strong>${escapeHtml(
            until
          )}</strong>.`,
          "Your role is a <strong>verified agent</strong>. Premium is what keeps the office, listings, and client requests available.",
        ],
        details: [
          { label: "Your role", value: "Verified agent" },
          { label: "Premium", value: `$${price} / month` },
          {
            label: "Trial",
            value: `${TRIAL_DAYS} days after verification, one per account`,
          },
          { label: "Grace", value: `${GRACE_DAYS} days after a period ends` },
        ],
        highlightHtml: perkTable([
          "Publish and manage listings from your agent office",
          "Accept owner listing requests and send proposals",
          "Dashboard, leads, visits, and featured tools",
          "No commission on sales or rentals",
          "Without Premium, new agent actions pause and listings can be archived after grace",
        ]),
        ctaLabel: "Renew Premium",
        ctaUrl: publicBillingUrl,
        note:
          testNote ||
          `Open Billing to send $${price} and keep your agent account. ${billingUrl}`,
      },
    };
  }

  return {
    subject: test
      ? "[Test] Complimentary Premium has ended — your user plan"
      : "Complimentary Premium has ended — here is what you can do",
    notificationTitle: "Complimentary Premium has ended",
    notificationMessage: `You keep browsing, saving, messaging, and ${FREE_SELF_LISTINGS} free self-listing. Asking an agent to list stays free. Premium is $${price}/month for unlimited self-listings.`,
    payload: {
      preheader: `Complimentary Premium ended on ${until}. You still have ${FREE_SELF_LISTINGS} free self-listing. Asking an agent stays free.`,
      eyebrow: "Your ShoufBayt plan",
      title: "Complimentary Premium has ended",
      greeting: `Dear ${escapeHtml(name)},`,
      paragraphs: [
        `Thank you for joining ShoufBayt. Everyone received Premium at no charge until <strong>${escapeHtml(
          until
        )}</strong>. That complimentary month is now over.`,
        "Your role is a <strong>home seeker / owner</strong>. You can still use the site without paying. Premium is only for unlimited self-listing.",
      ],
      details: [
        { label: "Your role", value: "User" },
        { label: "Free self-listings", value: String(FREE_SELF_LISTINGS) },
        { label: "Ask an agent to list", value: "Always free" },
        {
          label: "Premium",
          value: `$${price} / month for unlimited self-listings`,
        },
      ],
      highlightHtml: perkTable([
        "Browse, save, and message listings",
        "Request visits and follow offers",
        `List ${FREE_SELF_LISTINGS} home yourself at no charge`,
        "Ask a verified agent to list for you — always free",
        `Subscribe to Premium for $${price}/month if you want unlimited self-listings`,
      ]),
      ctaLabel: "View your plan",
      ctaUrl: publicBillingUrl,
      note:
        testNote ||
        `See the Free and Premium cards on Billing. ${billingUrl}`,
    },
  };
};

export const sendLaunchPeriodEndedEmail = async ({
  to,
  username,
  role,
  test = false,
}) => {
  if (!to) return null;

  const normalized = normalizeRole(role);
  const copy = getLaunchPeriodCopy(normalized, { username, test });

  return trySendMail(
    {
      to,
      subject: copy.subject,
      text: wrapEmailText(copy.payload),
      html: wrapEmailHtml(copy.payload),
    },
    `launch-period email (${normalized})`
  );
};

const alreadySentCampaign = (notifications = []) =>
  notifications.some(
    (item) => (item.metadata || {}).campaign === LAUNCH_PERIOD_CAMPAIGN
  );

const createCampaignNotification = async (user, copy) => {
  try {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "GENERAL",
        title: copy.notificationTitle,
        message: copy.notificationMessage,
        link: LAUNCH_PERIOD_LINK,
        metadata: {
          campaign: LAUNCH_PERIOD_CAMPAIGN,
          role: normalizeRole(user.role),
        },
      },
    });
  } catch (error) {
    console.error("Failed to create launch-period notification", error);
  }
};

export const getLaunchPeriodStatus = async () => {
  const until = getPremiumFreeUntil();
  const active = isLaunchPremiumFree();
  const now = new Date();
  const daysLeft = Math.max(
    0,
    Math.ceil((until.getTime() - now.getTime()) / 86_400_000)
  );

  const [userCount, sentNotifications] = await Promise.all([
    prisma.user.count({
      where: {
        email: { not: "" },
        status: { notIn: ["BANNED", "SUSPENDED"] },
      },
    }),
    prisma.notification.findMany({
      where: {
        type: "GENERAL",
        link: LAUNCH_PERIOD_LINK,
      },
      select: { userId: true, metadata: true },
    }),
  ]);

  const sentUserIds = new Set(
    sentNotifications
      .filter((item) => item.metadata?.campaign === LAUNCH_PERIOD_CAMPAIGN)
      .map((item) => item.userId)
  );

  return {
    complimentaryActive: active,
    complimentaryUntil: until,
    daysLeft: active ? daysLeft : 0,
    ended: !active,
    priceMonthly: PLAN_PRICES.PREMIUM,
    freeSelfListings: FREE_SELF_LISTINGS,
    trialDays: TRIAL_DAYS,
    graceDays: GRACE_DAYS,
    eligibleUsers: userCount,
    sentCount: sentUserIds.size,
    pendingCount: Math.max(0, userCount - sentUserIds.size),
  };
};

export const processLaunchPeriodEmails = async ({
  force = false,
  limit = 80,
} = {}) => {
  if (!force && isLaunchPremiumFree()) {
    return {
      skipped: true,
      reason: "launch_still_active",
      sent: 0,
      failed: 0,
      pending: 0,
    };
  }

  const users = await prisma.user.findMany({
    where: {
      email: { not: "" },
      status: { notIn: ["BANNED", "SUSPENDED"] },
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
    },
    take: Math.max(1, Math.min(Number(limit) || 80, 200)),
    orderBy: { createdAt: "asc" },
  });

  if (!users.length) {
    return { skipped: false, sent: 0, failed: 0, pending: 0 };
  }

  const existing = await prisma.notification.findMany({
    where: {
      userId: { in: users.map((user) => user.id) },
      type: "GENERAL",
      link: LAUNCH_PERIOD_LINK,
    },
    select: { userId: true, metadata: true },
  });

  const sentByUser = new Map();
  for (const item of existing) {
    const list = sentByUser.get(item.userId) || [];
    list.push(item);
    sentByUser.set(item.userId, list);
  }

  let sent = 0;
  let failed = 0;
  let skippedExisting = 0;

  for (const user of users) {
    if (alreadySentCampaign(sentByUser.get(user.id) || [])) {
      skippedExisting += 1;
      continue;
    }

    const copy = getLaunchPeriodCopy(normalizeRole(user.role), {
      username: user.username,
    });
    const mailed = await sendLaunchPeriodEndedEmail({
      to: user.email,
      username: user.username,
      role: user.role,
    });

    if (!mailed) {
      failed += 1;
      continue;
    }

    await createCampaignNotification(user, copy);
    sent += 1;
  }

  if (sent) {
    console.log(`Launch-period emails sent: ${sent}`);
  }

  return {
    skipped: false,
    sent,
    failed,
    skippedExisting,
    pending: users.length - sent - skippedExisting - failed,
  };
};
