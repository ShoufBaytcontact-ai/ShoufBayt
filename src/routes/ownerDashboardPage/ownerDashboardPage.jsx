import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import { listingRequestApi, ownerDashboardApi } from "../../lib/services";
import OwnerProposals from "../../components/ownerProposals/ownerProposals";
import "./ownerDashboardPage.scss";

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatStatus(status) {
  const value = String(status || "").toUpperCase();
  if (value === "PUBLISHED") return "Active";
  if (value === "PENDING") return "Pending review";
  if (value === "REJECTED") return "Rejected";
  if (value === "SOLD") return "Sold";
  if (value === "RENTED") return "Rented";
  if (value === "ARCHIVED") return "Archived";
  return value || "Unknown";
}

function formatVisitStatus(status, timeline) {
  const value = String(status || "").toUpperCase();
  if (value === "COMPLETED" || timeline === "completed") return "Completed";
  if (value === "CANCELLED" || timeline === "cancelled") return "Cancelled";
  if (value === "CONFIRMED") return "Confirmed";
  if (value === "RESCHEDULED") return "Rescheduled";
  if (timeline === "past") return "Past";
  return "Upcoming";
}

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

function OwnerDashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [requestWorkingId, setRequestWorkingId] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestError, setRequestError] = useState("");

  const role = String(currentUser?.role || "").toUpperCase();

  const load = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");
      const res = await ownerDashboardApi.me();
      setData(res.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load owner dashboard");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (role === "AGENT") {
      navigate("/agent");
      return;
    }

    load();
  }, [currentUser, role, navigate]);

  const handleAcceptProposal = async (requestId, proposalId) => {
    try {
      setRequestWorkingId(proposalId);
      setRequestMessage("");
      setRequestError("");
      const res = await listingRequestApi.acceptProposal(requestId, proposalId);
      setRequestMessage(t("profile.requests.success.accepted"));
      await load({ silent: true });
      if (res.data?.property?.id) {
        setTimeout(() => navigate(`/properties/${res.data.property.id}`), 800);
      }
    } catch (err) {
      setRequestError(
        err.response?.data?.message || t("profile.requests.errors.accept")
      );
    } finally {
      setRequestWorkingId("");
    }
  };

  const handleRejectProposal = async (requestId, proposalId) => {
    try {
      setRequestWorkingId(proposalId);
      setRequestMessage("");
      setRequestError("");
      await listingRequestApi.rejectProposal(requestId, proposalId);
      setRequestMessage(t("profile.requests.success.rejected"));
      await load({ silent: true });
    } catch (err) {
      setRequestError(
        err.response?.data?.message || t("profile.requests.errors.reject")
      );
    } finally {
      setRequestWorkingId("");
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      setRequestWorkingId(requestId);
      setRequestError("");
      await listingRequestApi.cancel(requestId);
      await load({ silent: true });
    } catch (err) {
      setRequestError(
        err.response?.data?.message || t("profile.requests.errors.cancel")
      );
    } finally {
      setRequestWorkingId("");
    }
  };

  useEffect(() => {
    if (!data?.properties?.length) {
      setSelectedId("");
      return;
    }

    const stillThere = data.properties.some((item) => item.id === selectedId);
    if (!stillThere) {
      setSelectedId(data.properties[0].id);
    }
  }, [data, selectedId]);

  const selected = useMemo(() => {
    if (!data?.properties?.length) return null;
    return (
      data.properties.find((item) => item.id === selectedId) ||
      data.properties[0]
    );
  }, [data, selectedId]);

  if (!currentUser) return null;

  const stats = data?.stats || {};
  const appointments = data?.appointments || [];
  const updates = data?.agentUpdates || [];
  const openRequests = data?.openRequests || [];

  const upcomingAppointments = appointments.filter(
    (item) =>
      ["PENDING", "CONFIRMED", "RESCHEDULED"].includes(item.status) &&
      item.timeline !== "past"
  );
  const completedAppointments = appointments.filter(
    (item) => !upcomingAppointments.some((u) => u.id === item.id)
  );

  return (
    <main className="ownerDashboard pageFade">
      <header className="ownerDashHeader">
        <div>
          <span>Owner</span>
          <h1>Your homes</h1>
          <p>{t("profile.requests.dashboardHint")}</p>
        </div>

        <div className="ownerDashLinks">
          <Link to="/request-listing">Request listing</Link>
          <Link to="/chat">Messages</Link>
          <Link to="/profile">Profile</Link>
        </div>
      </header>

      {error && <div className="ownerAlert error">{error}</div>}

      {loading ? (
        <div className="ownerEmpty">Loading your properties…</div>
      ) : (
        <>
          <section className="ownerStatGrid">
            <article>
              <span>Views</span>
              <strong>{formatNumber(stats.views)}</strong>
              <p>Across your managed listings</p>
            </article>
            <article>
              <span>Interested buyers</span>
              <strong>{formatNumber(stats.interestedBuyers)}</strong>
              <p>People who saved your property</p>
            </article>
            <article>
              <span>Scheduled visits</span>
              <strong>{formatNumber(stats.scheduledVisits)}</strong>
              <p>Upcoming appointments</p>
            </article>
            <article>
              <span>Offers / inquiries</span>
              <strong>{formatNumber(stats.offersReceived)}</strong>
              <p>Buyer conversations on your listings</p>
            </article>
          </section>

          <div className="ownerDashLayout">
            <section className="ownerMainCol">
              {openRequests.length > 0 && (
                <section className="ownerOpenRequests">
                  <div className="ownerSectionHead">
                    <div>
                      <span>{t("profile.tabs.requests")}</span>
                      <h2>{t("profile.requests.pickTitle")}</h2>
                    </div>
                  </div>
                  <OwnerProposals
                    requests={openRequests}
                    loading={false}
                    workingId={requestWorkingId}
                    message={requestMessage}
                    error={requestError}
                    onAccept={handleAcceptProposal}
                    onReject={handleRejectProposal}
                    onCancel={handleCancelRequest}
                  />
                </section>
              )}

              <div className="ownerSectionHead">
                <div>
                  <span>My Property</span>
                  <h2>Listings managed for you</h2>
                </div>
                <p>
                  {stats.propertyCount || 0} total · {stats.activeCount || 0}{" "}
                  active
                </p>
              </div>

              {!data?.properties?.length ? (
                <div className="ownerEmptyCard">
                  <h3>No managed properties yet</h3>
                  <p>
                    Request a listing and choose an agent. Once they publish,
                    progress shows up here.
                  </p>
                  <Link to="/request-listing">Request a listing</Link>
                </div>
              ) : (
                <div className="ownerPropertyList">
                  {data.properties.map((property) => {
                    const active = selected?.id === property.id;
                    return (
                      <button
                        key={property.id}
                        type="button"
                        className={
                          active
                            ? "ownerPropertyCard active"
                            : "ownerPropertyCard"
                        }
                        onClick={() => setSelectedId(property.id)}
                      >
                        <div
                          className="ownerPropertyThumb"
                          style={{
                            backgroundImage: property.images?.[0]
                              ? `url(${property.images[0]})`
                              : undefined,
                          }}
                        />
                        <div className="ownerPropertyMeta">
                          <strong>{property.title}</strong>
                          <span>
                            {property.city} · {formatStatus(property.status)}
                          </span>
                          <p>
                            Managed by:{" "}
                            {property.managedBy?.displayName || "Agent"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selected && (
                <article className="ownerSelectedPanel">
                  <div className="ownerSelectedTop">
                    <div>
                      <span>Selected property</span>
                      <h3>{selected.title}</h3>
                      <p>
                        Status: <strong>{formatStatus(selected.status)}</strong>
                      </p>
                      <p className="ownerStatusHint">
                        Your agent marks this as sold or rented when the deal is done.
                      </p>
                      <p>
                        Managed by:{" "}
                        <strong>
                          {selected.managedBy?.displayName || "Your agent"}
                        </strong>
                      </p>
                    </div>
                    <Link to={`/properties/${selected.id}`}>View listing</Link>
                  </div>

                  <div className="ownerMiniStats">
                    <div>
                      <span>Views</span>
                      <strong>{formatNumber(selected.views)}</strong>
                    </div>
                    <div>
                      <span>Interested</span>
                      <strong>
                        {formatNumber(selected.interestedBuyers)}
                      </strong>
                    </div>
                    <div>
                      <span>Visits</span>
                      <strong>
                        {formatNumber(selected.scheduledVisits)}
                      </strong>
                    </div>
                    <div>
                      <span>Inquiries</span>
                      <strong>
                        {formatNumber(selected.offersReceived)}
                      </strong>
                    </div>
                  </div>
                </article>
              )}
            </section>

            <aside className="ownerSideCol">
              <section className="ownerSideCard">
                <div className="ownerSectionHead">
                  <div>
                    <span>Appointments</span>
                    <h2>Scheduled visits</h2>
                  </div>
                </div>

                {!appointments.length ? (
                  <p className="ownerSideEmpty">
                    No visits yet. After a buyer messages you, your agent can
                    log the viewing here.
                  </p>
                ) : (
                  <>
                    <h3 className="ownerVisitGroupTitle">Upcoming</h3>
                    {!upcomingAppointments.length ? (
                      <p className="ownerSideEmpty">No upcoming visits.</p>
                    ) : (
                      <ul className="ownerAppointmentList">
                        {upcomingAppointments.map((item) => (
                          <li key={item.id}>
                            <div>
                              <strong>{formatWhen(item.scheduledAt)}</strong>
                              <span>
                                {item.property?.title || "Property"} ·{" "}
                                {item.agent?.name || "Agent"}
                              </span>
                              {(item.visitorName || item.visitorPhone) && (
                                <span>
                                  Visitor:{" "}
                                  {[item.visitorName, item.visitorPhone]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              )}
                              {item.notes ? (
                                <span className="ownerVisitNotes">
                                  {item.notes}
                                </span>
                              ) : null}
                            </div>
                            <em
                              className={`visitBadge ${item.timeline || "upcoming"}`}
                            >
                              {formatVisitStatus(item.status, item.timeline)}
                            </em>
                          </li>
                        ))}
                      </ul>
                    )}

                    <h3 className="ownerVisitGroupTitle">Completed / past</h3>
                    {!completedAppointments.length ? (
                      <p className="ownerSideEmpty">No completed visits yet.</p>
                    ) : (
                      <ul className="ownerAppointmentList">
                        {completedAppointments.map((item) => (
                          <li key={item.id}>
                            <div>
                              <strong>{formatWhen(item.scheduledAt)}</strong>
                              <span>
                                {item.property?.title || "Property"} ·{" "}
                                {item.agent?.name || "Agent"}
                              </span>
                              {(item.visitorName || item.visitorPhone) && (
                                <span>
                                  Visitor:{" "}
                                  {[item.visitorName, item.visitorPhone]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              )}
                            </div>
                            <em
                              className={`visitBadge ${item.timeline || "completed"}`}
                            >
                              {formatVisitStatus(item.status, item.timeline)}
                            </em>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>

              <section className="ownerSideCard">
                <div className="ownerSectionHead">
                  <div>
                    <span>Messages</span>
                    <h2>Agent updates</h2>
                  </div>
                  <Link to="/notifications">All alerts</Link>
                </div>

                {!updates.length ? (
                  <p className="ownerSideEmpty">
                    Agent proposals, visit changes, and listing news appear
                    here.
                  </p>
                ) : (
                  <ul className="ownerUpdateList">
                    {updates.map((item) => (
                      <li key={item.id}>
                        <strong>{item.title}</strong>
                        <p>{item.message}</p>
                        <span>{formatWhen(item.createdAt)}</span>
                        {item.link ? (
                          <Link to={item.link}>Open</Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                <Link className="ownerChatCta" to="/chat">
                  Open messages
                </Link>
              </section>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

export default OwnerDashboardPage;
