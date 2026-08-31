import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import apiRequest from "../../lib/apiRequest";
import {
  adminBillingApi,
  paymentApi,
  subscriptionApi,
} from "../../lib/services";
import CardCheckout from "../../components/cardCheckout/CardCheckout.jsx";
import {
  AgentPreviewCard,
  AgentUnlockPath,
  getUnlockStep,
  readAgentPreview,
} from "../../components/agentUnlock/agentUnlock";
import "./billingPage.scss";

const PAYEE = {
  name: "Hamza Farhat",
  phone: "+96171582487",
  phoneDisplay: "+961 71 582 487",
};

function manualMethods(price) {
  return [
    {
      id: "OMT",
      label: "OMT",
      hint: `Send $${price} then upload the receipt`,
    },
    {
      id: "WHISH",
      label: "Whish Money",
      hint: `Send $${price} then upload the receipt`,
    },
    {
      id: "BOB",
      label: "BOB Finance",
      hint: `Send $${price} then upload the receipt`,
    },
  ];
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function PlanCard({
  variant,
  tag,
  title,
  priceLabel,
  period,
  lead,
  perks,
  current,
  currentLabel,
}) {
  return (
    <article
      className={`planCard ${variant} ${current ? "isCurrent" : ""}`.trim()}
    >
      <div className="planCardTop">
        <span className="planTag">{tag}</span>
        {current ? <span className="currentMark">{currentLabel}</span> : null}
      </div>
      <div className="priceBlock">
        <h2>{priceLabel}</h2>
        <p>{period}</p>
      </div>
      <h3>{title}</h3>
      <p>{lead}</p>
      <ul className="planPerks">
        {perks.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function BillingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser, updateUser } = useContext(AuthContext);
  const isApplyFlow = searchParams.get("apply") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [application, setApplication] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cardFormKey, setCardFormKey] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [plan] = useState("PREMIUM");
  const [method, setMethod] = useState("OMT");
  const [cardReady, setCardReady] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [proof, setProof] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [testEmail, setTestEmail] = useState("");
  const [testRole, setTestRole] = useState("USER");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [forceSend, setForceSend] = useState(false);

  const payee = data?.policy?.payee || PAYEE;
  const payeeName = payee.name || PAYEE.name;
  const payeePhone = payee.phone || PAYEE.phone;
  const payeeDisplay = payee.phoneDisplay || PAYEE.phoneDisplay;

  const refreshSessionUser = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await apiRequest.get(`/users/${currentUser.id}`);
      if (res.data?.id) {
        updateUser({
          ...currentUser,
          id: res.data.id,
          email: res.data.email,
          username: res.data.username,
          avatar: res.data.avatar,
          role: res.data.role,
          status: res.data.status,
          premiumTrialClaimed: res.data.premiumTrialClaimed,
          agentProfile: res.data.agentProfile || null,
        });
      }
    } catch {
      /* keep the existing session if refresh fails */
    }
  }, [currentUser, updateUser]);

  const role = currentUser?.role?.toUpperCase();
  const isAgent = role === "AGENT";
  const isAdmin = role === "ADMIN";
  const isApplicant =
    String(application?.status || "").toUpperCase() === "PENDING";
  const isRegularUser = role === "USER" && !isApplicant;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [subRes, payRes, cardRes, requestRes] = await Promise.all([
        subscriptionApi.me(),
        paymentApi.mine(),
        paymentApi.cardConfig().catch(() => ({ data: { configured: false } })),
        apiRequest.get("/agents/my-request").catch(() => ({ data: null })),
      ]);

      setData(subRes.data);
      setPayments(Array.isArray(payRes.data) ? payRes.data : []);
      setApplication(requestRes.data || null);
      const stripeOn = Boolean(cardRes.data?.configured);
      setCardReady(stripeOn);
      setMethod((current) =>
        current === "CARD" && !stripeOn ? "OMT" : current
      );

      if (String(currentUser?.role || "").toUpperCase() === "ADMIN") {
        const launchRes = await adminBillingApi.launchPeriod().catch(() => null);
        if (launchRes?.data) setCampaign(launchRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load billing info");
    } finally {
      setLoading(false);
    }
  }, [currentUser?.role]);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    setTestEmail((value) => value || currentUser.email || "");
    load();
  }, [currentUser, navigate, load]);

  const subscription = data?.subscription;
  const hasAccess = data?.hasAccess;
  const inGrace = data?.inGrace;
  const phase = data?.phase || "none";
  const isTrial = data?.isTrial || phase === "trial";
  const trialClaimed = data?.premiumTrialClaimed;
  const hasPaidAccess = Boolean(data?.hasPaidAccess);
  const launchPremiumFree = Boolean(data?.launchPremiumFree);
  const launchFreeUntil = data?.launchFreeUntil;
  const launchDaysLeft = data?.launchDaysLeft ?? 0;
  const complimentaryActive = launchPremiumFree;
  const premiumEndsAt = data?.periodEndsAt;
  const showPremiumEnd = !complimentaryActive && Boolean(premiumEndsAt);
  const premiumDaysLeft = showPremiumEnd
    ? Math.max(
        0,
        Math.ceil((new Date(premiumEndsAt).getTime() - Date.now()) / 86_400_000)
      )
    : 0;
  const listingQuota = data?.listingQuota;
  const price =
    Number(data?.plans?.PREMIUM?.price ?? data?.policy?.priceMonthly ?? 20) ||
    20;
  const freeLimit =
    listingQuota?.freeLimit ?? data?.policy?.freeSelfListings ?? 1;
  const trialDays = data?.policy?.trialDays ?? 30;
  const graceDays = data?.policy?.graceDays ?? 7;
  const copyKey = isAdmin ? "admin" : isAgent ? "agent" : "user";

  const methods = useMemo(() => {
    const manuals = manualMethods(price);
    if (!cardReady) return manuals;
    return [
      { id: "CARD", label: "Card", hint: "Instant activation" },
      ...manuals,
    ];
  }, [cardReady, price]);

  const selectedMethod =
    methods.find((item) => item.id === method) || methods[0];
  const isCardMethod = method === "CARD";
  const cancelsAtPeriodEnd = Boolean(
    data?.cancelsAtPeriodEnd || subscription?.status === "CANCELLED"
  );

  const statusLabel = useMemo(() => {
    if (
      cancelsAtPeriodEnd &&
      (hasAccess || phase === "trial" || phase === "premium")
    ) {
      return t("billingPage.statusLabels.cancels");
    }
    if (phase === "trial") return t("billingPage.statusLabels.trial");
    if (phase === "premium") return t("billingPage.statusLabels.premium");
    if (phase === "launch" || launchPremiumFree) {
      return t("billingPage.statusLabels.launch");
    }
    if (phase === "grace") return t("billingPage.statusLabels.grace");
    if (phase === "inactive") return t("billingPage.statusLabels.inactive");
    return t("billingPage.statusLabels.none");
  }, [cancelsAtPeriodEnd, phase, hasAccess, launchPremiumFree, t]);

  const handleCardError = useCallback((message) => {
    setError(message || "");
    setSuccess("");
  }, []);

  const handleCardSuccess = useCallback(async () => {
    setError("");
    setSuccess(
      isApplicant
        ? "Payment received. An admin will review your agent request next."
        : isRegularUser
          ? "Premium activated. You can list homes yourself without the free-listing limit."
          : "Premium activated. Your agent account and listings are restored."
    );
    setCardFormKey((key) => key + 1);
    await refreshSessionUser();
    await load();
  }, [isApplicant, isRegularUser, load, refreshSessionUser]);

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(payeePhone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isCardMethod) return;
    if (!proof) {
      setError("Upload a clear photo of the receipt after you send the money.");
      setSuccess("");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("plan", plan);
      formData.append("method", method);
      if (transactionId.trim()) {
        formData.append("transactionId", transactionId.trim());
      }
      formData.append("proof", proof);
      await paymentApi.submit(formData);
      setSuccess(
        isApplicant
          ? "Receipt submitted. Once payment is confirmed, an admin can review your agent request."
          : cancelsAtPeriodEnd
            ? "Receipt submitted. After confirmation, Premium will renew and the cancellation will be replaced by a new period."
            : "Receipt submitted. We’ll activate Premium after the payment is confirmed."
      );
      setTransactionId("");
      setProof(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit payment");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      setCancelling(true);
      setError("");
      await subscriptionApi.cancel();
      setConfirmCancel(false);
      setSuccess(
        "Subscription cancelled. You keep access until this period ends. A confirmation email was sent."
      );
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  const handleResumeSubscription = async () => {
    try {
      setResuming(true);
      setError("");
      await subscriptionApi.resume();
      setSuccess(
        "Subscription resumed. You keep Premium until the current period ends."
      );
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resume subscription");
    } finally {
      setResuming(false);
    }
  };

  const handleSendTest = async () => {
    try {
      setSendingTest(true);
      setError("");
      const res = await adminBillingApi.sendLaunchTest({
        email: testEmail,
        role: testRole,
        username: currentUser?.username,
      });
      setSuccess(res.data?.message || "Preview email sent.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send preview email");
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendAll = async () => {
    try {
      setSendingAll(true);
      setError("");
      const res = await adminBillingApi.sendLaunchEmails({
        confirm: "SEND_LAUNCH_EMAILS",
        force: forceSend,
      });
      setSuccess(res.data?.message || "Campaign ran.");
      const launchRes = await adminBillingApi.launchPeriod().catch(() => null);
      if (launchRes?.data) setCampaign(launchRes.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send campaign emails");
    } finally {
      setSendingAll(false);
    }
  };

  const paidSuccess =
    payments.some((item) => String(item.status).toUpperCase() === "SUCCESS") ||
    Boolean(application?.isPaid);
  const paidPending = payments.some(
    (item) => String(item.status).toUpperCase() === "PENDING"
  );
  const subscriptionPaid = hasPaidAccess || phase === "premium";
  const hidePaymentForm =
    isAdmin ||
    subscriptionPaid ||
    launchPremiumFree ||
    (isApplicant && paidSuccess) ||
    paidPending;
  const applyJourney = isApplicant || isApplyFlow;
  const storedPreview = readAgentPreview();
  const agentCard = {
    name:
      application?.name ||
      application?.fullName ||
      storedPreview?.name ||
      currentUser?.username,
    title:
      application?.title ||
      application?.agencyName ||
      storedPreview?.title,
    location: application?.location || storedPreview?.location,
    bio: application?.bio || storedPreview?.bio,
    image: application?.image || storedPreview?.image || currentUser?.avatar,
  };
  const unlockStep = getUnlockStep({
    isAgent: isAgent && !isApplicant,
    isPending: applyJourney,
    isPaid: paidSuccess || launchPremiumFree,
  });

  const freePerks = asList(
    t(`billingPage.free.${copyKey}Perks`, {
      returnObjects: true,
      limit: freeLimit,
    })
  );
  const premiumPerks = asList(
    t(`billingPage.premium.${copyKey}Perks`, {
      returnObjects: true,
      trial: trialDays,
      price,
      grace: graceDays,
    })
  );

  const premiumIsCurrent =
    launchPremiumFree || hasPaidAccess || inGrace || phase === "trial";
  const freeIsCurrent = !premiumIsCurrent;

  const listingsValue = listingQuota?.unlimited
    ? t("billingPage.unlimited")
    : `${listingQuota?.used ?? 0} / ${freeLimit}`;

  if (!currentUser) return null;

  return (
    <main className="billingPage pageFade">
      <header className="billingHero">
        <div>
          <p className="eyebrow">
            {applyJourney
              ? t("agentUnlock.billing.badge")
              : t(`billingPage.hero.${copyKey}Badge`)}
          </p>
          <h1>
            {applyJourney
              ? t("agentUnlock.billing.title")
              : t(`billingPage.hero.${copyKey}Title`)}
          </h1>
          <p>
            {applyJourney
              ? t("agentUnlock.billing.description", {
                  price,
                  name: payeeName,
                })
              : t(`billingPage.hero.${copyKey}Text`, {
                  price,
                  limit: freeLimit,
                  trial: trialDays,
                  date: formatDate(launchFreeUntil),
                })}
          </p>
        </div>
        <Link
          to={applyJourney ? "/agents" : "/profile"}
          className="ghostBtn heroBack"
        >
          {applyJourney
            ? t("agentUnlock.billing.back")
            : t("billingPage.back")}
        </Link>
      </header>

      {(applyJourney || isAgent) && (
        <div className="agentJourney">
          <AgentUnlockPath currentStep={unlockStep} />
        </div>
      )}

      {loading ? (
        <div className="billingStateCard">{t("billingPage.loading")}</div>
      ) : (
        <>
          {error && <div className="billingAlert error">{error}</div>}
          {success && <div className="billingAlert success">{success}</div>}

          {launchPremiumFree && (
            <div className="launchBanner">
              <span className="planTag">
                {t("billingPage.statusLabels.launch")}
              </span>
              <p>
                {t("billingPage.launchBanner", {
                  date: formatDate(launchFreeUntil),
                })}
              </p>
              {launchDaysLeft > 0 ? (
                <strong>
                  {t("billingPage.daysLeft", { count: launchDaysLeft })}
                </strong>
              ) : null}
            </div>
          )}

          {showPremiumEnd && (
            <div className="launchBanner premiumEndBanner">
              <span className="planTag">
                {t("billingPage.premiumEnds")}
              </span>
              <p>
                {t("billingPage.premiumEndsBanner", {
                  date: formatDateTime(premiumEndsAt),
                })}
              </p>
              {premiumDaysLeft > 0 ? (
                <strong>
                  {t("billingPage.daysLeft", { count: premiumDaysLeft })}
                </strong>
              ) : null}
            </div>
          )}

          {applyJourney && (
            <section className="applySplit">
              <AgentPreviewCard {...agentCard} />
              <div className="applySplitCopy">
                <span className="planTag">
                  {paidSuccess || launchPremiumFree
                    ? t("agentUnlock.billing.tagReview")
                    : paidPending
                      ? t("agentUnlock.billing.tagPending")
                      : t("agentUnlock.billing.tagPay")}
                </span>
                <h2>
                  {paidSuccess || launchPremiumFree
                    ? t("agentUnlock.billing.headReview")
                    : paidPending
                      ? t("agentUnlock.billing.headPending")
                      : t("agentUnlock.billing.headPay", { price })}
                </h2>
                <p>
                  {launchPremiumFree
                    ? t("billingPage.launchBanner", {
                        date: formatDate(launchFreeUntil),
                      })
                    : paidSuccess
                      ? t("agentUnlock.billing.copyReview")
                      : paidPending
                        ? t("agentUnlock.billing.copyPending")
                        : t("agentUnlock.billing.copyPay", {
                            price,
                            name: payeeName,
                            phone: payeeDisplay,
                          })}
                </p>
              </div>
            </section>
          )}

          <section className="snapshotPanel">
            <div className="historyHeader">
              <h3>{t("billingPage.snapshot")}</h3>
              <p className="muted">{statusLabel}</p>
            </div>
            <ul className="snapshotGrid">
              <li>
                <span>{t("billingPage.role")}</span>
                <strong>
                  {t(
                    `billingPage.roles.${
                      isApplicant ? "APPLICANT" : role || "USER"
                    }`
                  )}
                </strong>
              </li>
              <li>
                <span>{t("billingPage.status")}</span>
                <strong>{statusLabel}</strong>
              </li>
              {complimentaryActive ? (
                <li>
                  <span>{t("billingPage.complimentaryUntil")}</span>
                  <strong>{formatDate(launchFreeUntil)}</strong>
                </li>
              ) : null}
              {showPremiumEnd ? (
                <li>
                  <span>{t("billingPage.premiumEnds")}</span>
                  <strong>{formatDateTime(premiumEndsAt)}</strong>
                </li>
              ) : null}
              <li>
                <span>{t("billingPage.graceEnd")}</span>
                <strong>{formatDate(data?.graceEndsAt)}</strong>
              </li>
              <li>
                <span>{t("billingPage.trialUsed")}</span>
                <strong>
                  {trialClaimed ? t("billingPage.yes") : t("billingPage.no")}
                </strong>
              </li>
              <li>
                <span>{t("billingPage.renewal")}</span>
                <strong>
                  {cancelsAtPeriodEnd
                    ? t("billingPage.cancelled")
                    : subscription?.autoRenew
                      ? t("billingPage.on")
                      : t("billingPage.manual")}
                </strong>
              </li>
              <li>
                <span>{t("billingPage.listings")}</span>
                <strong>
                  {isRegularUser || listingQuota
                    ? listingsValue
                    : t("billingPage.unlimited")}
                </strong>
              </li>
            </ul>
          </section>

          <section className="billingGrid planCompare">
            <PlanCard
              variant="free"
              tag={t("billingPage.free.tag")}
              title={t(`billingPage.free.${copyKey}Title`)}
              priceLabel={t("billingPage.free.price")}
              period={t("billingPage.free.period")}
              lead={t(`billingPage.free.${copyKey}Lead`, { limit: freeLimit })}
              perks={freePerks}
              current={freeIsCurrent}
              currentLabel={t("billingPage.current")}
            />
            <PlanCard
              variant="premium featured"
              tag={
                launchPremiumFree
                  ? t("billingPage.premium.complimentary")
                  : t("billingPage.premium.tag")
              }
              title={t(`billingPage.premium.${copyKey}Title`)}
              priceLabel={launchPremiumFree ? "$0" : `$${price}`}
              period={
                launchPremiumFree
                  ? t("billingPage.included")
                  : t("billingPage.premium.period")
              }
              lead={t(`billingPage.premium.${copyKey}Lead`)}
              perks={premiumPerks}
              current={premiumIsCurrent}
              currentLabel={t("billingPage.current")}
            />
          </section>

          {hasPaidAccess && !isApplicant && !isAdmin ? (
            <div className="planActions billingActions">
              {cancelsAtPeriodEnd ? (
                <div className="resumeBox">
                  <p>
                    {t("billingPage.resumeCopy", {
                      date: formatDate(
                        data?.periodEndsAt || data?.graceEndsAt
                      ),
                    })}
                  </p>
                  <button
                    type="button"
                    className="primaryBtn compact"
                    onClick={handleResumeSubscription}
                    disabled={resuming}
                  >
                    {resuming
                      ? t("billingPage.resuming")
                      : t("billingPage.resume")}
                  </button>
                </div>
              ) : confirmCancel ? (
                <div className="cancelConfirm">
                  <p>
                    {t("billingPage.confirmCancel", {
                      date: formatDate(
                        data?.periodEndsAt || data?.graceEndsAt
                      ),
                    })}
                  </p>
                  <div className="planActions">
                    <button
                      type="button"
                      className="dangerBtn compact"
                      onClick={handleCancelSubscription}
                      disabled={cancelling}
                    >
                      {cancelling
                        ? t("billingPage.cancelling")
                        : t("billingPage.confirmCancellation")}
                    </button>
                    <button
                      type="button"
                      className="ghostBtn compact"
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelling}
                    >
                      {t("billingPage.keepPlan")}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="dangerBtn compact"
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    setConfirmCancel(true);
                  }}
                >
                  {t("billingPage.cancel")}
                </button>
              )}
            </div>
          ) : null}

          {isAdmin && (
            <section className="campaignPanel">
              <div className="historyHeader">
                <div>
                  <p className="eyebrow">{t("billingPage.campaign.badge")}</p>
                  <h3>{t("billingPage.campaign.title")}</h3>
                </div>
                <p className="muted">
                  {t("billingPage.campaign.sent", {
                    sent: campaign?.sentCount ?? 0,
                    pending: campaign?.pendingCount ?? 0,
                  })}
                </p>
              </div>
              <p>{t("billingPage.campaign.text")}</p>
              <p className="campaignStatus">
                {campaign?.complimentaryActive ?? launchPremiumFree
                  ? t("billingPage.campaign.active", {
                      date: formatDate(
                        campaign?.complimentaryUntil || launchFreeUntil
                      ),
                      days: campaign?.daysLeft ?? launchDaysLeft,
                    })
                  : t("billingPage.campaign.ended")}
              </p>
              <div className="campaignFields">
                <label>
                  {t("billingPage.campaign.email")}
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                </label>
                <label>
                  {t("billingPage.campaign.role")}
                  <select
                    value={testRole}
                    onChange={(e) => setTestRole(e.target.value)}
                  >
                    <option value="USER">USER</option>
                    <option value="AGENT">AGENT</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </label>
              </div>
              <div className="planActions">
                <button
                  type="button"
                  className="primaryBtn compact"
                  onClick={handleSendTest}
                  disabled={sendingTest}
                >
                  {sendingTest
                    ? t("billingPage.campaign.sendingTest")
                    : t("billingPage.campaign.sendTest")}
                </button>
                <button
                  type="button"
                  className="ghostBtn compact"
                  onClick={handleSendAll}
                  disabled={sendingAll}
                >
                  {sendingAll
                    ? t("billingPage.campaign.sendingAll")
                    : t("billingPage.campaign.sendAll")}
                </button>
              </div>
              <label className="forceRow">
                <input
                  type="checkbox"
                  checked={forceSend}
                  onChange={(e) => setForceSend(e.target.checked)}
                />
                {t("billingPage.campaign.force")}
              </label>
            </section>
          )}

          {!hidePaymentForm ? (
            <>
              <section className="payeeCard">
                <div className="payeeCopy">
                  <p className="eyebrow">{t("billingPage.howToPay")}</p>
                  <h3>
                    {t("billingPage.sendTo", { price, name: payeeName })}
                  </h3>
                  <p>
                    {t("billingPage.payCopy", { price })}
                  </p>
                </div>
                <div className="payeeDetails">
                  <div>
                    <span>{t("billingPage.recipient")}</span>
                    <strong>{payeeName}</strong>
                  </div>
                  <div className="payeePhone">
                    <span>{t("billingPage.number")}</span>
                    <strong>{payeeDisplay}</strong>
                    <button
                      type="button"
                      className="copyBtn"
                      onClick={handleCopyPhone}
                    >
                      {copied ? t("billingPage.copied") : t("billingPage.copy")}
                    </button>
                  </div>
                  <div>
                    <span>{t("billingPage.amount")}</span>
                    <strong>${price} USD</strong>
                  </div>
                </div>
              </section>

              <section className="paymentPanel">
                <div className="paymentPanelHeader">
                  <div>
                    <h3>
                      {cancelsAtPeriodEnd
                        ? t("billingPage.renewPremium")
                        : t("billingPage.payPremium")}
                    </h3>
                    <p>{t("billingPage.amountDue", { price })}</p>
                  </div>
                  <span className="modePill">
                    {isCardMethod
                      ? t("billingPage.instant")
                      : t("billingPage.receiptReview")}
                  </span>
                </div>

                <div className={`methodGrid count-${methods.length}`}>
                  {methods.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        method === item.id ? "methodCard active" : "methodCard"
                      }
                      onClick={() => {
                        setMethod(item.id);
                        setError("");
                        setSuccess("");
                      }}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.hint}</span>
                    </button>
                  ))}
                </div>

                {isCardMethod ? (
                  cardReady ? (
                    <CardCheckout
                      key={cardFormKey}
                      amount={price}
                      onSuccess={handleCardSuccess}
                      onError={handleCardError}
                    />
                  ) : (
                    <div className="cardComingSoon">
                      {t("billingPage.cardSoon", {
                        price,
                        name: payeeName,
                      })}
                    </div>
                  )
                ) : (
                  <form onSubmit={handleSubmit} className="paymentForm">
                    <ol className="paySteps">
                      <li>
                        Send ${price} to <strong>{payeeName}</strong> (
                        {payeeDisplay}) with {selectedMethod.label}
                      </li>
                      <li>Upload a clear photo of the receipt</li>
                      <li>Wait for confirmation — Premium then turns on</li>
                    </ol>
                    <div className="paymentFields">
                      <label>
                        {t("billingPage.reference")}
                        <input
                          type="text"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                          placeholder={t("billingPage.referencePlaceholder")}
                        />
                      </label>
                      <label className={`uploadBox ${proof ? "hasFile" : ""}`}>
                        {t("billingPage.receipt")}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            setProof(e.target.files?.[0] || null)
                          }
                        />
                        <span className="uploadDrop">
                          <span className="uploadIcon" aria-hidden="true" />
                          <span>
                            <strong>
                              {proof
                                ? t("billingPage.changeReceipt")
                                : t("billingPage.chooseReceipt")}
                            </strong>
                            <em>
                              {proof
                                ? proof.name
                                : t("billingPage.receiptHint")}
                            </em>
                          </span>
                        </span>
                      </label>
                    </div>
                    <button
                      type="submit"
                      className="primaryBtn submitBtn"
                      disabled={saving}
                    >
                      {saving
                        ? t("billingPage.submitting")
                        : t("billingPage.submit")}
                    </button>
                  </form>
                )}
              </section>
            </>
          ) : null}

          <section className="historyPanel">
            <div className="historyHeader">
              <h3>{t("billingPage.history")}</h3>
              <p className="muted">
                {t("billingPage.transactions", { count: payments.length })}
              </p>
            </div>
            {payments.length === 0 ? (
              <p className="muted emptyHistory">
                {t("billingPage.noPayments")}
              </p>
            ) : (
              <div className="historyTable">
                {payments.map((payment) => (
                  <div key={payment.id} className="historyRow">
                    <div>
                      <strong>${payment.amount}</strong>
                      <span>{payment.method}</span>
                    </div>
                    <div className="historyRight">
                      <span
                        className={`statusPill ${String(
                          payment.status || ""
                        ).toLowerCase()}`}
                      >
                        {payment.status}
                      </span>
                      <small>{formatDate(payment.createdAt)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default BillingPage;
