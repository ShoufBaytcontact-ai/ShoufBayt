import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import {
  agentInsightsApi,
  agentProfileApi,
  appointmentApi,
  listingRequestApi,
} from "../../lib/services";
import apiRequest from "../../lib/apiRequest";
import StatusBadge from "../../components/statusBadge/statusBadge";
import PhoneField from "../../components/phoneField/PhoneField";
import { isValidPhone } from "../../lib/phoneCountries";
import {
  toApiPropertyStatus,
  toUiPropertyStatus,
} from "../../lib/propertyStatus";
import "./agentDashboardPage.scss";

function getImageUrl(image, fallback = "/no-image.png") {
  const SERVER_URL = (
    process.env.REACT_APP_API_URL || "http://localhost:8800/api"
  ).replace("/api", "");

  const source =
    typeof image === "string"
      ? image
      : image?.url || image?.src || image?.secureUrl || "";

  if (!source) {
    return fallback;
  }

  if (
    source.startsWith("http") ||
    source.startsWith("data:") ||
    source.startsWith("/no-")
  ) {
    return source;
  }

  return `${SERVER_URL}${source.startsWith("/") ? "" : "/"}${source}`;
}

function firstListingImage(item, fallback = "/no-image.png") {
  let images = item?.images;

  if (typeof images === "string") {
    const trimmed = images.trim();
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        images = JSON.parse(trimmed);
      } catch {
        return getImageUrl(trimmed, fallback);
      }
    } else {
      return getImageUrl(trimmed, fallback);
    }
  }

  const first = Array.isArray(images) ? images[0] : images;
  return getImageUrl(first, fallback);
}

function listingId(item) {
  return item?.id || item?._id || "";
}

function normalizeListingRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];

  return rows
    .map((row) => row?.post || row?.property || row)
    .filter((item) => listingId(item))
    .map((item) => ({ ...item, id: listingId(item) }));
}

function unwrapListings(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return normalizeListingRows(payload);
  }

  const nested =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload)
      ? payload.data
      : null;

  const keys = Object.keys(payload);
  const preferred = keys.filter(
    (key) => /post|listing|propert|item/i.test(key) && !/saved/i.test(key)
  );

  const candidates = [
    payload.propertyList,
    payload.userPosts,
    payload.listings,
    payload.posts,
    payload.items,
    ...preferred.map((key) => payload[key]),
    payload.properties,
    Array.isArray(payload.data) ? payload.data : null,
  ];

  for (const rows of candidates) {
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const mapped = rows
      .map((row) => row?.post || row?.property || row)
      .filter((item) => listingId(item))
      .map((item) => ({ ...item, id: listingId(item) }));

    if (mapped.length) {
      return mapped;
    }
  }

  if (nested && nested !== payload) {
    return unwrapListings(nested);
  }

  return [];
}

function mergeListings(...groups) {
  const seen = new Set();
  const merged = [];

  groups.flat().forEach((item) => {
    const id = listingId(item);
    if (!id || seen.has(id)) return;
    seen.add(id);
    merged.push({ ...item, id });
  });

  return merged;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function leadDetailPath(request) {
  if (request?.id) return `/listing-requests/${request.id}`;
  return "/agent?tab=leads";
}

function AgentDashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { currentUser, updateUser } = useContext(AuthContext);

  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState(
    ["overview", "leads", "listings", "profile"].includes(requestedTab)
      ? requestedTab
      : "overview"
  );
  const [leadFilter, setLeadFilter] = useState("open");
  const [listingFilter, setListingFilter] = useState("all");
  const [leads, setLeads] = useState([]);
  const [listings, setListings] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [visitFilter, setVisitFilter] = useState("upcoming");
  const [rescheduleId, setRescheduleId] = useState("");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [proposingId, setProposingId] = useState("");
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [drafts, setDrafts] = useState({});
  const [visitForm, setVisitForm] = useState({
    propertyId: "",
    scheduledAt: "",
    visitorName: "",
    visitorPhone: "",
    notes: "",
    status: "CONFIRMED",
  });
  const [card, setCard] = useState(null);
  const [cardForm, setCardForm] = useState({
    name: "",
    title: "",
    agencyName: "",
    phone: "",
    location: "",
    bio: "",
    website: "",
  });
  const [cardImage, setCardImage] = useState(null);
  const [cardPreview, setCardPreview] = useState("/no-avatar.png");
  const [cardPreviewUrl, setCardPreviewUrl] = useState("");
  const [savingCard, setSavingCard] = useState(false);

  const role = String(currentUser?.role || "").toUpperCase();

  const formatWhen = (value) => {
    if (!value) return "—";
    try {
      return new Date(value).toLocaleString(
        i18n.language === "ar" ? "ar-LB" : "en-US",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }
      );
    } catch {
      return String(value);
    }
  };

  const applyCard = (nextCard) => {
    setCard(nextCard || null);

    if (cardPreviewUrl) {
      URL.revokeObjectURL(cardPreviewUrl);
      setCardPreviewUrl("");
    }

    if (!nextCard) {
      return;
    }

    setCardForm({
      name: nextCard.name || "",
      title: nextCard.title || "",
      agencyName: nextCard.agencyName || "",
      phone: nextCard.phone || "",
      location: nextCard.location || "",
      bio: nextCard.bio || "",
      website: nextCard.website || "",
    });
    setCardImage(null);
    setCardPreview(
      getImageUrl(nextCard.image || nextCard.avatar, "/no-avatar.png")
    );
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const agentUserId = currentUser?.id || currentUser?._id;

      const [
        leadsRes,
        mineRes,
        profileRes,
        postsRes,
        insightsRes,
        appointmentsRes,
        cardRes,
      ] =
        await Promise.all([
          listingRequestApi.leads().catch((err) => {
            if (err.response?.status === 403) {
              const message = err.response?.data?.message || "";
              const profileMissing = /agent profile required/i.test(message);
              return {
                data: [],
                blocked: !profileMissing,
                message: profileMissing ? "" : message,
              };
            }
            return { data: [], blocked: false, message: "" };
          }),
          apiRequest.get("/agents/me/listings").catch(() => null),
          apiRequest.get("/users/profile/posts").catch(() => null),
          agentUserId
            ? apiRequest
                .get("/posts", {
                  params: {
                    userId: agentUserId,
                    agentId: agentUserId,
                    limit: 50,
                  },
                })
                .catch(() => null)
            : Promise.resolve(null),
          agentInsightsApi.me().catch(() => null),
          appointmentApi.mine().catch(() => ({ data: { items: [] } })),
          agentProfileApi.me().catch(() => null),
        ]);

      if (leadsRes.blocked) {
        setError(leadsRes.message || t("agentHub.errors.premium"));
        setLeads([]);
      } else {
        const rows = Array.isArray(leadsRes.data) ? leadsRes.data : [];
        setLeads(
          rows.filter((invite) => {
            const request = invite?.listingRequest || invite;
            const requesterRole = String(
              request?.requester?.role || ""
            ).toUpperCase();
            return (
              request?.requesterId !== currentUser?.id &&
              requesterRole !== "AGENT"
            );
          })
        );
      }

      setInsights(insightsRes?.data || null);

      const appointmentPayload = appointmentsRes?.data;
      const appointmentItems = Array.isArray(appointmentPayload)
        ? appointmentPayload
        : Array.isArray(appointmentPayload?.items)
          ? appointmentPayload.items
          : [];
      setAppointments(appointmentItems);

      const nextListings = mergeListings(
        unwrapListings(mineRes?.data),
        Array.isArray(profileRes?.data?.userPosts)
          ? profileRes.data.userPosts
          : unwrapListings(profileRes?.data),
        Array.isArray(postsRes?.data?.items)
          ? postsRes.data.items
          : unwrapListings(postsRes?.data),
        Array.isArray(cardRes?.data?.propertyList)
          ? cardRes.data.propertyList
          : unwrapListings(cardRes?.data)
      );
      setListings(nextListings);

      if (nextListings.length && !visitForm.propertyId) {
        setVisitForm((prev) => ({
          ...prev,
          propertyId: nextListings[0].id,
        }));
      }

      applyCard(cardRes?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || t("agentHub.errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (role !== "AGENT" && role !== "ADMIN") {
      navigate("/profile");
      return;
    }

    load();
  }, [currentUser, role, navigate]);

  useEffect(() => {
    const next = searchParams.get("tab");

    if (["overview", "leads", "listings", "visits", "profile"].includes(next)) {
      setTab(next);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (cardPreviewUrl) {
        URL.revokeObjectURL(cardPreviewUrl);
      }
    };
  }, [cardPreviewUrl]);

  const openProposalForm = (request) => {
    const previous =
      (request.proposals || []).find((item) => {
        const status = String(item?.status || "").toUpperCase();
        return status === "REJECTED" || status === "WITHDRAWN";
      }) || (request.proposals || [])[0];
    setDrafts((prev) => ({
      ...prev,
      [request.id]: {
        message: previous?.message || prev[request.id]?.message || "",
        estimatedDays: String(
          previous?.estimatedDays || prev[request.id]?.estimatedDays || "45"
        ),
        commissionPercent: String(
          previous?.commissionPercent ??
            prev[request.id]?.commissionPercent ??
            "2"
        ),
      },
    }));
    setProposingId(request.id);
  };

  const updateDraft = (requestId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [requestId]: {
        message: "",
        estimatedDays: "45",
        commissionPercent: "2",
        ...(prev[requestId] || {}),
        [field]: value,
      },
    }));
  };

  const handlePropose = async (requestId) => {
    const draft = drafts[requestId] || {};
    try {
      setWorkingId(requestId);
      setError("");
      setSuccess("");
      await listingRequestApi.propose(requestId, {
        message: draft.message,
        estimatedDays: draft.estimatedDays,
        commissionPercent: draft.commissionPercent,
      });
      setSuccess(t("agentHub.success.proposed"));
      setProposingId("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t("agentHub.errors.propose"));
    } finally {
      setWorkingId("");
    }
  };

  const handleWithdraw = async (proposalId) => {
    try {
      setWorkingId(proposalId);
      setError("");
      await listingRequestApi.withdrawProposal(proposalId);
      setSuccess(t("agentHub.success.withdrawn"));
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t("agentHub.errors.withdraw"));
    } finally {
      setWorkingId("");
    }
  };

  const handleScheduleVisit = async (e) => {
    e.preventDefault();
    if (
      visitForm.visitorPhone.trim() &&
      !isValidPhone(visitForm.visitorPhone, { allowEmpty: true })
    ) {
      setError(t("phoneField.errors.invalid"));
      return;
    }
    try {
      setWorkingId("visit");
      setError("");
      setSuccess("");
      await appointmentApi.create({
        propertyId: visitForm.propertyId,
        scheduledAt: visitForm.scheduledAt
          ? new Date(visitForm.scheduledAt).toISOString()
          : "",
        visitorName: visitForm.visitorName,
        visitorPhone: visitForm.visitorPhone,
        notes: visitForm.notes,
        status: visitForm.status,
      });
      setSuccess(t("agentHub.success.visitScheduled"));
      setVisitForm((prev) => ({
        ...prev,
        scheduledAt: "",
        visitorName: "",
        visitorPhone: "",
        notes: "",
      }));
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t("agentHub.errors.visit"));
    } finally {
      setWorkingId("");
    }
  };

  const handleVisitStatus = async (id, status) => {
    try {
      setWorkingId(id);
      setError("");
      await appointmentApi.update(id, { status });
      setSuccess(
        t("agentHub.success.visitUpdated", { status: status.toLowerCase() })
      );
      setRescheduleId("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t("agentHub.errors.visitUpdate"));
    } finally {
      setWorkingId("");
    }
  };

  const handleListingStatus = async (propertyId, nextStatus) => {
    try {
      setWorkingId(propertyId);
      setError("");
      setSuccess("");
      const res = await apiRequest.patch(`/posts/${propertyId}/status`, {
        status: toApiPropertyStatus(nextStatus),
      });
      const updatedStatus = res.data?.status || toApiPropertyStatus(nextStatus);
      setListings((prev) =>
        prev.map((item) =>
          item.id === propertyId ? { ...item, status: updatedStatus } : item
        )
      );
      setSuccess(
        updatedStatus === "SOLD"
          ? t("agentHub.success.sold")
          : updatedStatus === "RENTED"
            ? t("agentHub.success.rented")
            : t("agentHub.success.available")
      );
    } catch (err) {
      setError(err.response?.data?.message || t("agentHub.errors.listing"));
    } finally {
      setWorkingId("");
    }
  };

  const handleRescheduleVisit = async (id) => {
    if (!rescheduleAt) {
      setError(t("agentHub.errors.rescheduleMissing"));
      return;
    }

    try {
      setWorkingId(id);
      setError("");
      await appointmentApi.update(id, {
        scheduledAt: new Date(rescheduleAt).toISOString(),
        status: "RESCHEDULED",
      });
      setSuccess(t("agentHub.success.visitRescheduled"));
      setRescheduleId("");
      setRescheduleAt("");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t("agentHub.errors.reschedule"));
    } finally {
      setWorkingId("");
    }
  };

  const now = new Date();

  const isActiveProposal = (proposal) => {
    const status = String(proposal?.status || "").toUpperCase();
    return status === "PENDING" || status === "ACCEPTED";
  };

  const latestProposal = (request) => {
    const list = request?.proposals || [];
    return list.find((item) => isActiveProposal(item)) || list[0];
  };

  const canProposeAgain = (proposal) => !isActiveProposal(proposal);

  const openLeads = useMemo(
    () =>
      leads.filter((invite) =>
        canProposeAgain(latestProposal(invite.listingRequest || {}))
      ),
    [leads]
  );

  const proposedLeads = useMemo(
    () =>
      leads.filter((invite) =>
        isActiveProposal(latestProposal(invite.listingRequest || {}))
      ),
    [leads]
  );

  const visibleLeads = useMemo(() => {
    if (leadFilter === "open") return openLeads;
    if (leadFilter === "proposed") return proposedLeads;
    return leads;
  }, [leadFilter, leads, openLeads, proposedLeads]);

  const visibleListings = useMemo(() => {
    return listings.filter((item) => {
      const ui = toUiPropertyStatus(item.status);
      if (listingFilter === "live") return ui === "available";
      if (listingFilter === "pending") return ui === "pending";
      if (listingFilter === "closed") return ui === "sold" || ui === "rented";
      return true;
    });
  }, [listings, listingFilter]);

  const upcomingVisits = useMemo(
    () =>
      appointments.filter((item) => {
        const when = item.scheduledAt ? new Date(item.scheduledAt) : null;
        return (
          ["PENDING", "CONFIRMED", "RESCHEDULED"].includes(item.status) &&
          when &&
          when >= now
        );
      }),
    [appointments, now]
  );

  const filteredVisits = useMemo(() => {
    return appointments.filter((item) => {
      const when = item.scheduledAt ? new Date(item.scheduledAt) : null;
      if (visitFilter === "pending") return item.status === "PENDING";
      if (visitFilter === "confirmed") return item.status === "CONFIRMED";
      if (visitFilter === "completed") return item.status === "COMPLETED";
      if (visitFilter === "cancelled") return item.status === "CANCELLED";
      if (visitFilter === "upcoming") {
        return (
          ["PENDING", "CONFIRMED", "RESCHEDULED"].includes(item.status) &&
          when &&
          when >= now
        );
      }
      return true;
    });
  }, [appointments, visitFilter, now]);

  const nextVisit = upcomingVisits[0] || null;

  const listingStatusLabel = (item) => {
    const uiStatus = toUiPropertyStatus(item.status);
    if (uiStatus === "sold") return t("agentHub.listings.sold");
    if (uiStatus === "rented") return t("agentHub.listings.rented");
    if (item.status === "PENDING") return t("agentHub.listings.pending");
    return t("agentHub.listings.available");
  };

  const handleCardChange = (e) => {
    const { name, value } = e.target;

    setCardForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCardImageChange = (e) => {
    const selectedImage = e.target.files?.[0];

    if (!selectedImage) {
      return;
    }

    if (!selectedImage.type.startsWith("image/")) {
      setError(t("agentHub.profile.validation.validImage"));
      e.target.value = "";
      return;
    }

    if (selectedImage.size > 5 * 1024 * 1024) {
      setError(t("agentHub.profile.validation.imageSize"));
      e.target.value = "";
      return;
    }

    if (cardPreviewUrl) {
      URL.revokeObjectURL(cardPreviewUrl);
    }

    const nextUrl = URL.createObjectURL(selectedImage);

    setCardImage(selectedImage);
    setCardPreview(nextUrl);
    setCardPreviewUrl(nextUrl);
    setError("");
    e.target.value = "";
  };

  const handleResetCardImage = () => {
    if (cardPreviewUrl) {
      URL.revokeObjectURL(cardPreviewUrl);
    }

    setCardImage(null);
    setCardPreviewUrl("");
    setCardPreview(getImageUrl(card?.image || card?.avatar, "/no-avatar.png"));
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();

    const name = cardForm.name.trim();
    const phone = cardForm.phone.trim();
    const location = cardForm.location.trim();
    const bio = cardForm.bio.trim();

    if (!name || !phone || !location || !bio) {
      setError(t("agentHub.profile.validation.required"));
      return;
    }

    if (name.length < 3) {
      setError(t("agentHub.profile.validation.nameLength"));
      return;
    }

    if (!isValidPhone(phone)) {
      setError(t("phoneField.errors.invalid"));
      return;
    }

    if (location.length < 2) {
      setError(t("agentHub.profile.validation.location"));
      return;
    }

    if (bio.length < 20) {
      setError(t("agentHub.profile.validation.bio"));
      return;
    }

    try {
      setSavingCard(true);
      setError("");
      setSuccess("");

      const formData = new FormData();
      formData.append("name", name);
      formData.append("title", cardForm.title.trim());
      formData.append("agencyName", cardForm.agencyName.trim());
      formData.append("phone", phone);
      formData.append("location", location);
      formData.append("bio", bio);
      formData.append("website", cardForm.website.trim());

      if (cardImage) {
        formData.append("image", cardImage);
      }

      const res = await agentProfileApi.update(formData);
      const nextCard = res.data;

      applyCard(nextCard);

      if (currentUser) {
        updateUser({
          ...currentUser,
          avatar: nextCard.avatar || nextCard.image || currentUser.avatar,
          agentProfile: {
            ...(currentUser.agentProfile || {}),
            id: nextCard.profileId || currentUser.agentProfile?.id,
            name: nextCard.name,
            agencyName: nextCard.agencyName,
            title: nextCard.title,
            phone: nextCard.phone,
            location: nextCard.location,
            bio: nextCard.bio,
            image: nextCard.image,
            website: nextCard.website,
          },
        });
      }

      setSuccess(t("agentHub.success.cardUpdated"));
    } catch (err) {
      setError(err.response?.data?.message || t("agentHub.errors.card"));
    } finally {
      setSavingCard(false);
    }
  };

  if (!currentUser) return null;

  return (
    <main className="agentOffice pageFade">
      <div className="hubToolbar">
        <h1>{t("nav.agentDashboard")}</h1>
        <div className="hubHeroActions">
          <Link to="/newPostPage" className="hubPrimaryBtn">
            {t("agentHub.links.addListing")}
          </Link>
          <Link to="/billing" className="hubGhostBtn">
            {t("agentHub.links.billing")}
          </Link>
          <Link to="/chat" className="hubGhostBtn">
            {t("agentHub.links.messages")}
          </Link>
          <button
            type="button"
            className="hubGhostBtn"
            onClick={() => setTab("profile")}
          >
            {t("agentHub.links.editCard")}
          </button>
        </div>
      </div>

      <div className="hubTabs">
        {[
          ["overview", t("agentHub.tabs.overview")],
          ["leads", `${t("agentHub.tabs.leads")}${leads.length ? ` (${leads.length})` : ""}`],
          ["listings", `${t("agentHub.tabs.listings")}${listings.length ? ` (${listings.length})` : ""}`],
          ["profile", t("agentHub.tabs.profile")],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "isActive" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="hubAlert isError">{error}</div>}
      {success && <div className="hubAlert isSuccess">{success}</div>}

      {loading ? (
        <div className="hubEmpty">{t("agentHub.states.loading")}</div>
      ) : tab === "overview" ? (
        <section className="hubOverview">
          <div className="hubPipeline">
            <p className="hubEyebrow">{t("agentHub.overview.pipeline")}</p>
            <div className="hubPipelineRow">
              <button type="button" onClick={() => { setTab("leads"); setLeadFilter("open"); }}>
                <strong>{openLeads.length}</strong>
                <span>{t("agentHub.overview.stageLeads")}</span>
              </button>
              <button type="button" onClick={() => { setTab("leads"); setLeadFilter("proposed"); }}>
                <strong>{proposedLeads.length}</strong>
                <span>{t("agentHub.overview.stageProposed")}</span>
              </button>
              <button type="button" onClick={() => setTab("listings")}>
                <strong>{listings.length}</strong>
                <span>{t("agentHub.overview.stageListings")}</span>
              </button>
              <button type="button" onClick={() => setTab("profile")}>
                <strong>{card?.name ? "Live" : "—"}</strong>
                <span>{t("agentHub.tabs.profile")}</span>
              </button>
            </div>
          </div>

          <div className="hubDeskGrid">
            <article className="hubDeskCard">
              <p className="hubEyebrow">{t("agentHub.links.messages")}</p>
              <h3>{formatNumber(insights?.inquiries)}</h3>
              <p>{t("agentHub.stats.inquiries")}</p>
              <Link to="/chat" className="hubPrimaryBtn">
                {t("agentHub.links.messages")}
              </Link>
            </article>

            <article className="hubDeskCard">
              <p className="hubEyebrow">{t("agentHub.overview.openLeads")}</p>
              {openLeads.length ? (
                <>
                  <h3>
                    <Link
                      to={leadDetailPath(openLeads[0].listingRequest)}
                      state={{ listingRequest: openLeads[0].listingRequest }}
                    >
                      {openLeads[0].listingRequest?.title || t("agentHub.tabs.leads")}
                    </Link>
                  </h3>
                  <p>
                    {openLeads[0].listingRequest?.city || "—"} · $
                    {Number(openLeads[0].listingRequest?.price || 0).toLocaleString()}
                  </p>
                  <button type="button" className="hubPrimaryBtn" onClick={() => { setTab("leads"); setLeadFilter("open"); }}>
                    {t("agentHub.overview.reviewLeads")}
                  </button>
                </>
              ) : (
                <>
                  <h3>{t("agentHub.overview.noLeads")}</h3>
                  <button type="button" className="hubGhostBtn" onClick={() => setTab("leads")}>
                    {t("agentHub.tabs.leads")}
                  </button>
                </>
              )}
            </article>

            <article className="hubDeskCard">
              <p className="hubEyebrow">{t("agentHub.overview.liveListings")}</p>
              {listings.length ? (
                <>
                  <h3>{listings[0].title || t("agentHub.tabs.listings")}</h3>
                  <p>
                    {listings[0].city || "—"} · $
                    {Number(listings[0].price || 0).toLocaleString()}
                  </p>
                  <button type="button" className="hubGhostBtn" onClick={() => setTab("listings")}>
                    {t("agentHub.tabs.listings")}
                  </button>
                </>
              ) : (
                <>
                  <h3>{t("agentHub.overview.noListings")}</h3>
                  <Link to="/newPostPage" className="hubPrimaryBtn">
                    {t("agentHub.overview.addListing")}
                  </Link>
                </>
              )}
            </article>
          </div>
        </section>
      ) : tab === "leads" ? (
        <section className="hubLeads">
          <div className="hubSubTabs">
            {[
              ["open", t("agentHub.leads.filterOpen")],
              ["proposed", t("agentHub.leads.filterProposed")],
              ["all", t("agentHub.leads.filterAll")],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={leadFilter === id ? "isActive" : ""}
                onClick={() => setLeadFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {visibleLeads.length === 0 ? (
            <div className="hubEmpty">
              <h3>{t("agentHub.leads.empty")}</h3>
              <p>{t("agentHub.leads.emptyHint")}</p>
            </div>
          ) : (
            visibleLeads.map((invite) => {
              const request = invite.listingRequest || {};
              const myProposal = latestProposal(request);
              const draft = drafts[request.id] || {
                message: "",
                estimatedDays: "45",
                commissionPercent: "2",
              };
              const proposalCount = request._count?.proposals ?? 0;
              const listingType = String(
                request.listingType || request.type || ""
              ).toUpperCase();
              const propertyType = String(request.propertyType || "")
                .replace(/_/g, " ")
                .toLowerCase();
              const proposalStatus = String(myProposal?.status || "").toUpperCase();
              const detailPath = leadDetailPath(request);

              return (
                <article key={invite.id} className="leadBrief">
                  <Link
                    className="leadBriefMedia"
                    to={detailPath}
                    state={{ listingRequest: request }}
                  >
                    <img
                      src={getImageUrl(request.images?.[0])}
                      alt=""
                      onError={(e) => {
                        e.currentTarget.src = "/no-image.png";
                      }}
                    />
                    {listingType ? (
                      <span>
                        {listingType === "RENT"
                          ? t("newPost.options.rent")
                          : t("newPost.options.sale")}
                      </span>
                    ) : null}
                  </Link>

                  <div className="leadBriefBody">
                    <p className="leadBriefKicker">
                      {t("agentHub.leads.proposals", { count: proposalCount })}
                      {request.requester?.username
                        ? ` · ${t("agentHub.leads.from")} ${request.requester.username}`
                        : ""}
                    </p>

                    <Link
                      className="leadBriefTitle"
                      to={detailPath}
                      state={{ listingRequest: request }}
                    >
                      {request.title || t("agentHub.tabs.leads")}
                    </Link>

                    <strong className="leadBriefPrice">
                      ${Number(request.price || 0).toLocaleString()}
                    </strong>

                    <p className="leadBriefPlace">
                      {request.city || t("agentHub.leads.noAddress")}
                      {request.address ? ` · ${request.address}` : ""}
                    </p>

                    <ul className="leadBriefFacts">
                      <li>
                        {t("agentHub.leads.beds", { count: request.bedrooms || 0 })}
                      </li>
                      <li>
                        {t("agentHub.leads.baths", { count: request.bathrooms || 0 })}
                      </li>
                      {propertyType ? <li>{propertyType}</li> : null}
                    </ul>

                  {myProposal && isActiveProposal(myProposal) ? (
                    <div className="leadBriefOffer isSent">
                      <div>
                        <span>{t("agentHub.leads.yourProposal")}</span>
                        <b>
                          {myProposal.commissionPercent}% ·{" "}
                          {t("agentHub.leads.daysShort", {
                            count: myProposal.estimatedDays,
                          })}
                        </b>
                      </div>
                      <em data-status={proposalStatus}>
                        {proposalStatus === "PENDING"
                          ? t("agentHub.leads.statusSent")
                          : t("agentHub.leads.statusAccepted")}
                      </em>
                      {proposalStatus === "PENDING" && (
                        <button
                          type="button"
                          className="leadBriefBtn isQuiet"
                          disabled={workingId === myProposal.id}
                          onClick={() => handleWithdraw(myProposal.id)}
                        >
                          {workingId === myProposal.id
                            ? t("agentHub.leads.withdrawing")
                            : t("agentHub.leads.withdraw")}
                        </button>
                      )}
                    </div>
                  ) : proposingId === request.id ? (
                    <div className="leadBriefOffer isForm">
                      <label>
                        {t("agentHub.leads.pitch")}
                        <textarea
                          rows={3}
                          value={draft.message}
                          onChange={(e) =>
                            updateDraft(request.id, "message", e.target.value)
                          }
                          placeholder={t("agentHub.leads.pitchPlaceholder")}
                        />
                      </label>
                      <div className="leadBriefFields">
                        <label>
                          {t("agentHub.leads.days")}
                          <input
                            type="number"
                            min="1"
                            value={draft.estimatedDays}
                            onChange={(e) =>
                              updateDraft(
                                request.id,
                                "estimatedDays",
                                e.target.value
                              )
                            }
                          />
                        </label>
                        <label>
                          {t("agentHub.leads.commission")}
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={draft.commissionPercent}
                            onChange={(e) =>
                              updateDraft(
                                request.id,
                                "commissionPercent",
                                e.target.value
                              )
                            }
                          />
                        </label>
                      </div>
                      <div className="leadBriefActions">
                        <button
                          type="button"
                          className="leadBriefBtn"
                          disabled={workingId === request.id}
                          onClick={() => handlePropose(request.id)}
                        >
                          {workingId === request.id
                            ? t("agentHub.leads.sending")
                            : t("agentHub.leads.send")}
                        </button>
                        <button
                          type="button"
                          className="leadBriefBtn isQuiet"
                          onClick={() => setProposingId("")}
                        >
                          {t("agentHub.leads.hideForm")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="leadBriefOffer">
                      {proposalStatus === "REJECTED" ? (
                        <p>{t("agentHub.leads.declinedHint")}</p>
                      ) : null}
                      <button
                        type="button"
                        className="leadBriefBtn"
                        onClick={() => openProposalForm(request)}
                      >
                        {myProposal
                          ? t("agentHub.leads.proposeAgain")
                          : t("agentHub.leads.propose")}
                      </button>
                    </div>
                  )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : tab === "listings" ? (
        <section className="officeListings">
          <div className="officeListingsHead">
            <div>
              <p className="hubEyebrow">{t("agentHub.tabs.listings")}</p>
              <h2>
                {t("agentHub.listings.title", {
                  defaultValue: "Your listings",
                })}
              </h2>
              <p>
                {t("agentHub.listings.count", {
                  count: listings.length,
                  defaultValue: "{{count}} homes on your desk",
                })}
              </p>
            </div>
            <Link to="/newPostPage" className="hubPrimaryBtn">
              {t("agentHub.links.addListing")}
            </Link>
          </div>

          <div className="hubSubTabs">
            {[
              ["all", t("agentHub.listings.filterAll", { defaultValue: "All" })],
              ["live", t("agentHub.listings.available")],
              ["pending", t("agentHub.listings.pending")],
              ["closed", t("agentHub.listings.filterClosed", { defaultValue: "Closed" })],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={listingFilter === id ? "isActive" : ""}
                onClick={() => setListingFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {visibleListings.length === 0 ? (
            <div className="hubEmpty">
              <h3>
                {listings.length
                  ? t("agentHub.listings.emptyFilter", {
                      defaultValue: "Nothing in this filter.",
                    })
                  : t("agentHub.listings.empty")}
              </h3>
              <p>
                {listings.length
                  ? t("agentHub.listings.emptyFilterHint", {
                      defaultValue: "Try another status, or add a new listing.",
                    })
                  : t("agentHub.listings.emptyHint")}
              </p>
              <Link to="/newPostPage" className="hubPrimaryBtn">
                {t("agentHub.links.addListing")}
              </Link>
            </div>
          ) : (
            <div className="officeListingGrid">
            {visibleListings.map((item) => {
              const uiStatus = toUiPropertyStatus(item.status);
              const listingKind = String(
                item.listingType || item.type || ""
              ).toLowerCase();
              const isRent = listingKind === "rent";
              const cover = firstListingImage(item);
              const beds = item.bedroom ?? item.bedrooms ?? 0;
              const baths = item.bathroom ?? item.bathrooms ?? 0;
              const area =
                item.area ||
                item.size ||
                item.postDetail?.size ||
                item.detail?.area;
              const canClose = uiStatus === "available";
              const canReopen = uiStatus === "sold" || uiStatus === "rented";

              return (
                <article key={item.id} className="officeListing">
                  <Link
                    to={`/properties/${item.id}`}
                    className="officeListingMedia"
                  >
                    <img
                      src={cover}
                      alt={item.title || "Property"}
                      onError={(event) => {
                        event.currentTarget.src = "/no-image.png";
                      }}
                    />
                    <span>
                      {isRent
                        ? t("card.labels.forRent")
                        : t("card.labels.forSale")}
                    </span>
                    <b>${Number(item.price || 0).toLocaleString()}</b>
                  </Link>

                  <div className="officeListingBody">
                    <div className="officeListingTop">
                      <div>
                        <small>{item.city || "—"}</small>
                        <h3>{item.title || t("agentHub.tabs.listings")}</h3>
                        <p>
                          {item.address || t("card.fallback.noAddress")}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>

                    <div className="officeListingMeta">
                      <span>
                        {beds} {t("card.features.bedrooms")}
                      </span>
                      <span>
                        {baths} {t("card.features.bathrooms")}
                      </span>
                      {area ? (
                        <span>
                          {area} {t("card.features.area")}
                        </span>
                      ) : null}
                    </div>

                    <div className="officeListingActions">
                      {item.requestedByUserId ? (
                        <span className="officeOwnerTag">
                          {t("agentHub.listings.ownerManaged")}
                        </span>
                      ) : null}
                      <Link
                        to={`/properties/${item.id}`}
                        className="hubGhostBtn"
                      >
                        {t("agentHub.listings.view")}
                      </Link>
                      <Link
                        to={`/posts/edit/${item.id}`}
                        className="hubGhostBtn"
                      >
                        {t("agentHub.listings.edit", { defaultValue: "Edit" })}
                      </Link>
                      {canClose && (
                        <button
                          type="button"
                          className="hubGhostBtn"
                          disabled={workingId === item.id}
                          onClick={() =>
                            handleListingStatus(
                              item.id,
                              isRent ? "rented" : "sold"
                            )
                          }
                        >
                          {workingId === item.id
                            ? t("agentHub.listings.updating")
                            : isRent
                              ? t("agentHub.listings.markRented")
                              : t("agentHub.listings.markSold")}
                        </button>
                      )}
                      {canReopen && (
                        <button
                          type="button"
                          className="hubGhostBtn"
                          disabled={workingId === item.id}
                          onClick={() =>
                            handleListingStatus(item.id, "available")
                          }
                        >
                          {workingId === item.id
                            ? t("agentHub.listings.updating")
                            : t("agentHub.listings.markAvailable")}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
          )}
        </section>
      ) : tab === "profile" ? (
        <section className="hubCardEditor">
          {!card ? (
            <div className="hubEmpty">{t("agentHub.profile.missing")}</div>
          ) : (
            <form className="hubCardForm" onSubmit={handleSaveCard}>
              <div className="hubCardIntro">
                <p className="hubEyebrow">{t("agentHub.profile.badge")}</p>
                <h2>{t("agentHub.profile.title")}</h2>
                <p>{t("agentHub.profile.description")}</p>
              </div>

              <div className="hubCardPreview">
                <img
                  src={cardPreview}
                  alt={cardForm.name || t("agentHub.profile.title")}
                  onError={(e) => {
                    e.currentTarget.src = "/no-avatar.png";
                  }}
                />
                <div>
                  <p className="hubEyebrow">{t("agentHub.profile.photo")}</p>
                  <div className="hubLeadActions">
                    <label htmlFor="agentCardImage" className="hubGhostBtn">
                      {t("agentHub.profile.chooseImage")}
                    </label>
                    {cardImage && (
                      <button
                        type="button"
                        className="hubGhostBtn"
                        onClick={handleResetCardImage}
                        disabled={savingCard}
                      >
                        {t("agentHub.profile.reset")}
                      </button>
                    )}
                  </div>
                  <input
                    id="agentCardImage"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleCardImageChange}
                    disabled={savingCard}
                    hidden
                  />
                </div>
              </div>

              <div className="hubProposalGrid">
                <label>
                  {t("agentHub.profile.name")}
                  <input
                    name="name"
                    type="text"
                    value={cardForm.name}
                    onChange={handleCardChange}
                    placeholder={t("agentHub.profile.namePlaceholder")}
                    disabled={savingCard}
                    required
                  />
                </label>
                <label>
                  {t("agentHub.profile.jobTitle")}
                  <input
                    name="title"
                    type="text"
                    value={cardForm.title}
                    onChange={handleCardChange}
                    placeholder={t("agentHub.profile.jobTitlePlaceholder")}
                    disabled={savingCard}
                  />
                </label>
                <label>
                  {t("agentHub.profile.agency")}
                  <input
                    name="agencyName"
                    type="text"
                    value={cardForm.agencyName}
                    onChange={handleCardChange}
                    placeholder={t("agentHub.profile.agencyPlaceholder")}
                    disabled={savingCard}
                  />
                </label>
                <label htmlFor="agent-card-phone">
                  {t("agentHub.profile.phone")}
                  <PhoneField
                    id="agent-card-phone"
                    value={cardForm.phone}
                    onChange={(phone) =>
                      setCardForm((prev) => ({
                        ...prev,
                        phone,
                      }))
                    }
                    disabled={savingCard}
                    required
                  />
                </label>
                <label>
                  {t("agentHub.profile.location")}
                  <input
                    name="location"
                    type="text"
                    value={cardForm.location}
                    onChange={handleCardChange}
                    placeholder={t("agentHub.profile.locationPlaceholder")}
                    disabled={savingCard}
                    required
                  />
                </label>
                <label>
                  {t("agentHub.profile.website")}
                  <input
                    name="website"
                    type="text"
                    value={cardForm.website}
                    onChange={handleCardChange}
                    placeholder={t("agentHub.profile.websitePlaceholder")}
                    disabled={savingCard}
                  />
                </label>
              </div>

              <label className="wide">
                {t("agentHub.profile.bio")}
                <textarea
                  name="bio"
                  rows={6}
                  value={cardForm.bio}
                  onChange={handleCardChange}
                  placeholder={t("agentHub.profile.bioPlaceholder")}
                  disabled={savingCard}
                  required
                />
              </label>

              <div className="hubLeadActions">
                <button
                  type="submit"
                  className="hubPrimaryBtn"
                  disabled={savingCard}
                >
                  {savingCard
                    ? t("agentHub.profile.saving")
                    : t("agentHub.profile.save")}
                </button>
                {card.id && (
                  <Link to={`/agents/${card.id}`} className="hubGhostBtn">
                    {t("agentHub.profile.viewPublic")}
                  </Link>
                )}
              </div>
            </form>
          )}
        </section>
      ) : null}
      {false && (
        <div>
          <div className="hubVisitList">
            <div className="hubVisitHead">
              <h2>{t("agentHub.visits.listTitle")}</h2>
              <div className="hubSubTabs">
                {[
                  ["upcoming", t("agentHub.visits.filterUpcoming")],
                  ["pending", t("agentHub.visits.filterPending")],
                  ["confirmed", t("agentHub.visits.filterConfirmed")],
                  ["completed", t("agentHub.visits.filterCompleted")],
                  ["cancelled", t("agentHub.visits.filterCancelled")],
                  ["all", t("agentHub.visits.filterAll")],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={visitFilter === value ? "isActive" : ""}
                    onClick={() => setVisitFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredVisits.length === 0 ? (
              <div className="hubEmpty">{t("agentHub.visits.empty")}</div>
            ) : (
              filteredVisits.map((item) => (
                <article key={item.id} className="hubVisitCard">
                  <div>
                    <strong>{formatWhen(item.scheduledAt)}</strong>
                    <p>
                      {item.property?.title || t("agentHub.tabs.listings")} · {item.status}
                      {item.visitorName ? ` · ${item.visitorName}` : ""}
                      {item.visitorPhone ? ` · ${item.visitorPhone}` : ""}
                    </p>
                    {item.notes ? <small>{item.notes}</small> : null}

                    {rescheduleId === item.id && (
                      <div className="hubReschedule">
                        <input
                          type="datetime-local"
                          value={rescheduleAt}
                          onChange={(e) => setRescheduleAt(e.target.value)}
                        />
                        <button
                          type="button"
                          className="hubPrimaryBtn"
                          disabled={workingId === item.id}
                          onClick={() => handleRescheduleVisit(item.id)}
                        >
                          {t("agentHub.visits.save")}
                        </button>
                        <button
                          type="button"
                          className="hubGhostBtn"
                          onClick={() => {
                            setRescheduleId("");
                            setRescheduleAt("");
                          }}
                        >
                          {t("agentHub.visits.cancel")}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="hubLeadActions">
                    {item.status === "PENDING" && (
                      <button
                        type="button"
                        className="hubGhostBtn"
                        disabled={workingId === item.id}
                        onClick={() => handleVisitStatus(item.id, "CONFIRMED")}
                      >
                        {t("agentHub.visits.confirm")}
                      </button>
                    )}
                    {item.status !== "COMPLETED" &&
                      item.status !== "CANCELLED" && (
                        <>
                          <button
                            type="button"
                            className="hubGhostBtn"
                            disabled={workingId === item.id}
                            onClick={() => {
                              setRescheduleId(item.id);
                              setRescheduleAt("");
                            }}
                          >
                            {t("agentHub.visits.reschedule")}
                          </button>
                          <button
                            type="button"
                            className="hubGhostBtn"
                            disabled={workingId === item.id}
                            onClick={() =>
                              handleVisitStatus(item.id, "COMPLETED")
                            }
                          >
                            {t("agentHub.visits.complete")}
                          </button>
                          <button
                            type="button"
                            className="hubGhostBtn"
                            disabled={workingId === item.id}
                            onClick={() =>
                              handleVisitStatus(item.id, "CANCELLED")
                            }
                          >
                            {t("agentHub.visits.cancel")}
                          </button>
                        </>
                      )}
                  </div>
                </article>
              ))
            )}
          </div>

          <aside className="hubVisitFormCard">
            <p className="hubEyebrow">{t("agentHub.visits.scheduleTitle")}</p>
            <h2>{t("agentHub.visits.scheduleTitle")}</h2>
            <p>{t("agentHub.visits.scheduleText")}</p>

            {listings.length === 0 ? (
              <div className="hubEmpty">{t("agentHub.visits.noListings")}</div>
            ) : (
              <form className="hubVisitForm" onSubmit={handleScheduleVisit}>
                <label>
                  {t("agentHub.visits.property")}
                  <select
                    value={visitForm.propertyId}
                    onChange={(e) =>
                      setVisitForm((prev) => ({
                        ...prev,
                        propertyId: e.target.value,
                      }))
                    }
                    required
                  >
                    {listings.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} · {item.city}
                        {item.requestedByUserId
                          ? ` · ${t("agentHub.visits.ownerManaged")}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("agentHub.visits.datetime")}
                  <input
                    type="datetime-local"
                    value={visitForm.scheduledAt}
                    onChange={(e) =>
                      setVisitForm((prev) => ({
                        ...prev,
                        scheduledAt: e.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  {t("agentHub.visits.visitorName")}
                  <input
                    type="text"
                    value={visitForm.visitorName}
                    onChange={(e) =>
                      setVisitForm((prev) => ({
                        ...prev,
                        visitorName: e.target.value,
                      }))
                    }
                    placeholder={t("agentHub.visits.optional")}
                  />
                </label>
                <label htmlFor="visitor-phone">
                  {t("agentHub.visits.visitorPhone")}
                  <PhoneField
                    id="visitor-phone"
                    value={visitForm.visitorPhone}
                    onChange={(visitorPhone) =>
                      setVisitForm((prev) => ({
                        ...prev,
                        visitorPhone,
                      }))
                    }
                    allowEmpty
                  />
                </label>
                <label>
                  {t("agentHub.visits.status")}
                  <select
                    value={visitForm.status}
                    onChange={(e) =>
                      setVisitForm((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                  >
                    <option value="PENDING">{t("agentHub.visits.pending")}</option>
                    <option value="CONFIRMED">{t("agentHub.visits.confirmed")}</option>
                  </select>
                </label>
                <label className="wide">
                  {t("agentHub.visits.notes")}
                  <textarea
                    rows={3}
                    value={visitForm.notes}
                    onChange={(e) =>
                      setVisitForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder={t("agentHub.visits.notesPlaceholder")}
                  />
                </label>
                <button
                  type="submit"
                  className="hubPrimaryBtn"
                  disabled={workingId === "visit"}
                >
                  {workingId === "visit"
                    ? t("agentHub.visits.scheduling")
                    : t("agentHub.visits.schedule")}
                </button>
              </form>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

export default AgentDashboardPage;
