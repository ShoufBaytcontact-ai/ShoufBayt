import { useCallback, useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import { listingRequestApi } from "../../lib/services";
import OwnerProposals from "../../components/ownerProposals/ownerProposals";
import "../listPage/listpage.scss";
import "./offersPage.scss";

function OffersPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useContext(AuthContext);
  const role = String(currentUser?.role || "").toUpperCase();
  const isAgentOrAdmin = role === "AGENT" || role === "ADMIN";

  const [listingRequests, setListingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await listingRequestApi.mine();
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.requests)
        ? res.data.requests
        : [];
      setListingRequests(list);
    } catch (err) {
      setError(err.response?.data?.message || t("profile.requests.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login", { replace: true });
      return;
    }

    if (isAgentOrAdmin) {
      navigate("/agent", { replace: true });
      return;
    }

    loadRequests();
  }, [currentUser, isAgentOrAdmin, loadRequests, navigate]);

  const handleAccept = async (requestId, proposalId) => {
    try {
      setWorkingId(proposalId);
      setMessage("");
      setError("");
      const res = await listingRequestApi.acceptProposal(requestId, proposalId);
      setMessage(t("profile.requests.success.accepted"));
      await loadRequests();
      if (res.data?.property?.id) {
        setTimeout(() => navigate(`/properties/${res.data.property.id}`), 800);
      }
    } catch (err) {
      setError(err.response?.data?.message || t("profile.requests.errors.accept"));
    } finally {
      setWorkingId("");
    }
  };

  const handleReject = async (requestId, proposalId) => {
    try {
      setWorkingId(proposalId);
      setMessage("");
      setError("");
      await listingRequestApi.rejectProposal(requestId, proposalId);
      setMessage(t("profile.requests.success.rejected"));
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || t("profile.requests.errors.reject"));
    } finally {
      setWorkingId("");
    }
  };

  const handleCancel = async (requestId) => {
    try {
      setWorkingId(requestId);
      setError("");
      await listingRequestApi.cancel(requestId);
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || t("profile.requests.errors.cancel"));
    } finally {
      setWorkingId("");
    }
  };

  if (!currentUser || isAgentOrAdmin) {
    return null;
  }

  return (
    <main className="offersPage pageFade">
      <section className="listHero">
        <div>
          <p className="listEyebrow">{t("nav.offers")}</p>
          <h1>{t("profile.requests.pickTitle")}</h1>
        </div>
        <Link to="/request-listing" className="createListingBtn">
          {t("profile.dashboard.requestListing")}
        </Link>
      </section>

      <OwnerProposals
        requests={listingRequests}
        loading={loading}
        workingId={workingId}
        message={message}
        error={error}
        onAccept={handleAccept}
        onReject={handleReject}
        onCancel={handleCancel}
      />
    </main>
  );
}

export default OffersPage;
