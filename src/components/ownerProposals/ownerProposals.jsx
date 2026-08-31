import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./ownerProposals.scss";

function getImageUrl(image) {
  const SERVER_URL = (
    process.env.REACT_APP_API_URL || "http://localhost:8800/api"
  ).replace("/api", "");

  if (!image || typeof image !== "string") {
    return "/no-avatar.png";
  }

  if (image.startsWith("http") || image.startsWith("data:")) {
    return image;
  }

  return `${SERVER_URL}${image.startsWith("/") ? "" : "/"}${image}`;
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function getAgent(proposal) {
  const profile = proposal?.agentProfile || {};
  return {
    name: profile.name || profile.user?.username || "",
    photo: profile.image || profile.user?.avatar || "",
    userId: profile.userId || profile.user?.id || "",
    verified: Boolean(profile.isVerified),
  };
}

function isOpenRequest(status) {
  const value = String(status || "").toUpperCase();
  return value === "OPEN" || value === "PENDING";
}

export default function OwnerProposals({
  requests,
  loading,
  workingId,
  message,
  error,
  onAccept,
  onReject,
  onCancel,
}) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState(null);
  const waitingRef = useRef(false);

  useEffect(() => {
    if (waitingRef.current && !workingId) {
      waitingRef.current = false;
      setDialog(null);
    }
  }, [workingId]);

  useEffect(() => {
    if (!dialog) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !workingId) {
        setDialog(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [dialog, workingId]);

  const closeDialog = () => {
    if (workingId) return;
    setDialog(null);
  };

  const openDialog = (type, request, proposal) => {
    if (workingId) return;
    setDialog({ type, request, proposal });
  };

  const submitDialog = () => {
    if (!dialog) return;
    waitingRef.current = true;

    if (dialog.type === "accept") {
      onAccept(dialog.request.id, dialog.proposal.id);
      return;
    }

    if (dialog.type === "reject") {
      onReject?.(dialog.request.id, dialog.proposal.id);
      return;
    }

    onCancel(dialog.request.id);
  };

  const dialogAgent = dialog?.proposal ? getAgent(dialog.proposal) : null;
  const dialogAgentName = dialogAgent?.name || t("profile.requests.agent");
  const dialogBusy = Boolean(workingId);
  const dialogIsDanger = dialog?.type === "reject" || dialog?.type === "cancel";

  if (loading) {
    return <p className="ownerOffersState">{t("profile.requests.loading")}</p>;
  }

  return (
    <div className="ownerOffers">
      {message && <p className="ownerOffersNotice">{message}</p>}
      {error && <p className="ownerOffersNotice isError">{error}</p>}

      {requests.length === 0 ? (
        <div className="ownerOffersEmpty">
          <h3>{t("profile.requests.emptyTitle")}</h3>
          <p>{t("profile.requests.emptyText")}</p>
          <Link to="/request-listing">{t("profile.dashboard.requestListing")}</Link>
        </div>
      ) : (
        requests.map((request) => {
          const proposals = request.proposals || [];
          const pending = proposals.filter(
            (proposal) => String(proposal.status || "").toUpperCase() === "PENDING"
          );
          const open = isOpenRequest(request.status);
          const waiting = open && pending.length === 0;

          return (
            <article key={request.id} className="ownerOfferCard">
              <header>
                <div>
                  <strong>{request.title}</strong>
                  <span>
                    {request.city} · {formatMoney(request.price)}
                  </span>
                </div>
                <em>
                  {waiting
                    ? t("profile.requests.stateWaiting")
                    : open
                      ? t("profile.requests.stateChoose")
                      : t("profile.requests.stateDone")}
                </em>
              </header>

              {waiting && (
                <p className="ownerOffersHint">
                  {t("profile.requests.waitingHint")}
                </p>
              )}

              {pending.length > 0 && (
                <div className="ownerOfferList">
                  {pending.map((proposal) => {
                    const agent = getAgent(proposal);
                    const agentName = agent.name || t("profile.requests.agent");

                    return (
                      <div key={proposal.id} className="ownerOfferItem">
                        <img
                          src={getImageUrl(agent.photo)}
                          alt={agentName}
                          onError={(event) => {
                            event.currentTarget.src = "/no-avatar.png";
                          }}
                        />

                        <div className="ownerOfferCopy">
                          <b>
                            {agentName}
                            {agent.verified && (
                              <small>{t("profile.requests.verified")}</small>
                            )}
                          </b>
                          <p>
                            {t("profile.requests.commission", {
                              percent: proposal.commissionPercent,
                            })}
                            {proposal.estimatedDays ? (
                              <>
                                {" · "}
                                {t("profile.requests.days", {
                                  count: proposal.estimatedDays,
                                })}
                              </>
                            ) : null}
                          </p>
                          {proposal.message && <span>{proposal.message}</span>}
                          {agent.userId && (
                            <Link to={`/agents/${agent.userId}`}>
                              {t("profile.requests.viewAgent")}
                            </Link>
                          )}
                        </div>

                        <div className="ownerOfferBtns">
                          <button
                            type="button"
                            disabled={Boolean(workingId)}
                            onClick={() => openDialog("accept", request, proposal)}
                          >
                            {workingId === proposal.id
                              ? t("profile.requests.working")
                              : t("profile.requests.accept")}
                          </button>
                          {onReject && (
                            <button
                              type="button"
                              className="isReject"
                              disabled={Boolean(workingId)}
                              onClick={() => openDialog("reject", request, proposal)}
                            >
                              {workingId === proposal.id
                                ? t("profile.requests.working")
                                : t("profile.requests.reject")}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="ownerOfferActions">
                {request.propertyId && (
                  <Link to={`/properties/${request.propertyId}`}>
                    {t("profile.requests.openListing")}
                  </Link>
                )}
                {open && (
                  <button
                    type="button"
                    className="isGhost"
                    disabled={Boolean(workingId)}
                    onClick={() => openDialog("cancel", request)}
                  >
                    {t("profile.requests.cancel")}
                  </button>
                )}
              </div>
            </article>
          );
        })
      )}

      {dialog && (
        <div
          className="ownerOfferDialogOverlay"
          onClick={closeDialog}
          role="presentation"
        >
          <div
            className={`ownerOfferDialog ${dialogIsDanger ? "isDanger" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ownerOfferDialogTitle"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="ownerOfferDialogClose"
              onClick={closeDialog}
              disabled={dialogBusy}
              aria-label={t("profile.requests.dialog.close")}
            >
              ×
            </button>

            {dialogAgent && (
              <div className="ownerOfferDialogAgent">
                <img
                  src={getImageUrl(dialogAgent.photo)}
                  alt={dialogAgentName}
                  onError={(event) => {
                    event.currentTarget.src = "/no-avatar.png";
                  }}
                />
                <div>
                  <b>
                    {dialogAgentName}
                    {dialogAgent.verified && (
                      <small>{t("profile.requests.verified")}</small>
                    )}
                  </b>
                  {dialog.proposal && (
                    <span>
                      {t("profile.requests.commission", {
                        percent: dialog.proposal.commissionPercent,
                      })}
                      {dialog.proposal.estimatedDays ? (
                        <>
                          {" · "}
                          {t("profile.requests.days", {
                            count: dialog.proposal.estimatedDays,
                          })}
                        </>
                      ) : null}
                    </span>
                  )}
                </div>
              </div>
            )}

            <h3 id="ownerOfferDialogTitle">
              {t(`profile.requests.dialog.${dialog.type}Title`)}
            </h3>
            <p>
              {t(`profile.requests.dialog.${dialog.type}Text`, {
                name: dialogAgentName,
                title: dialog.request.title,
              })}
            </p>

            <div className="ownerOfferDialogActions">
              <button
                type="button"
                className="isGhost"
                onClick={closeDialog}
                disabled={dialogBusy}
              >
                {t("profile.requests.dialog.back")}
              </button>
              <button
                type="button"
                className={dialogIsDanger ? "isDanger" : ""}
                onClick={submitDialog}
                disabled={dialogBusy}
              >
                {dialogBusy
                  ? t("profile.requests.working")
                  : dialog.type === "accept"
                    ? t("profile.requests.dialog.confirmAccept")
                    : dialog.type === "reject"
                      ? t("profile.requests.dialog.confirmReject")
                      : t("profile.requests.dialog.confirmCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
