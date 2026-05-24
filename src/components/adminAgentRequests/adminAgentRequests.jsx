import { useCallback, useEffect, useMemo, useState } from "react";
import "./adminAgentRequests.scss";
import apiRequest from "../../lib/apiRequest";

function AdminAgentRequests({ onRequestUpdated }) {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");

  const getRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const url =
        filter === "ALL"
          ? "/admin/agent-requests"
          : `/admin/agent-requests?status=${filter}`;

      const res = await apiRequest.get(url);

      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("GET AGENT REQUESTS ERROR:", err);
      setError(err.response?.data?.message || "Failed to load agent requests");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    getRequests();
  }, [getRequests]);

  const requestStats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((item) => item.status === "PENDING").length,
      approved: requests.filter((item) => item.status === "APPROVED").length,
      rejected: requests.filter((item) => item.status === "REJECTED").length,
    };
  }, [requests]);

  const refreshEverything = async () => {
    await getRequests();

    if (onRequestUpdated) {
      await onRequestUpdated();
    }
  };

  const handleApprove = async (request) => {
    const confirmApprove = window.confirm(
      `Approve ${request.name} as a verified agent?`
    );

    if (!confirmApprove) {
      return;
    }

    try {
      setActionLoading(request.id);

      await apiRequest.put(`/admin/agent-requests/${request.id}/approve`, {
        adminNote: "Approved by admin",
      });

      await refreshEverything();
    } catch (err) {
      console.log("APPROVE REQUEST ERROR:", err);
      alert(err.response?.data?.message || "Failed to approve request");
    } finally {
      setActionLoading("");
    }
  };

  const handleReject = async (request) => {
    const adminNote = window.prompt(
      `Why are you rejecting ${request.name}'s request?`
    );

    if (adminNote === null) {
      return;
    }

    try {
      setActionLoading(request.id);

      await apiRequest.put(`/admin/agent-requests/${request.id}/reject`, {
        adminNote: adminNote.trim() || "Rejected by admin",
      });

      await refreshEverything();
    } catch (err) {
      console.log("REJECT REQUEST ERROR:", err);
      alert(err.response?.data?.message || "Failed to reject request");
    } finally {
      setActionLoading("");
    }
  };

  const getRequestImage = (request) => {
    return request.image || request.user?.avatar || "/no-avatar.png";
  };

  return (
    <section className="adminAgentRequests">
      <div className="adminAgentHeader">
        <div>
          <span>Admin Review</span>

          <h2>Agent Requests</h2>

          <p>
            Review users who want to become verified SmartEstate agents.
            Approving a request creates an agent profile and changes the user
            role to AGENT.
          </p>
        </div>

        <div className="adminAgentCount">
          <strong>{requestStats.total}</strong>
          <small>Total</small>
        </div>
      </div>

      <div className="agentRequestStats">
        <div>
          <strong>{requestStats.pending}</strong>
          <span>Pending</span>
        </div>

        <div>
          <strong>{requestStats.approved}</strong>
          <span>Approved</span>
        </div>

        <div>
          <strong>{requestStats.rejected}</strong>
          <span>Rejected</span>
        </div>
      </div>

      <div className="agentRequestFilters">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((item) => (
          <button
            type="button"
            key={item}
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
          >
            {item === "ALL" ? "All" : item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="adminAgentState">Loading agent requests...</div>
      ) : error ? (
        <div className="adminAgentState errorState">{error}</div>
      ) : requests.length === 0 ? (
        <div className="adminAgentState">No agent requests found.</div>
      ) : (
        <div className="requestTable">
          {requests.map((request) => (
            <div className="requestRow" key={request.id}>
              <div className="requestUser">
                <img
                  src={getRequestImage(request)}
                  alt={request.name || "Agent request"}
                  onError={(e) => {
                    e.currentTarget.src = "/no-avatar.png";
                  }}
                />

                <div>
                  <h3>{request.name || "Unknown Agent"}</h3>
                  <p>{request.user?.email || "No email"}</p>
                  <small>@{request.user?.username || "unknown"}</small>
                </div>
              </div>

              <div className="requestInfo">
                <div>
                  <span>Title</span>
                  <b>{request.title || "No title"}</b>
                </div>

                <div>
                  <span>Phone</span>
                  <b>{request.phone || "No phone"}</b>
                </div>

                <div>
                  <span>Location</span>
                  <b>{request.location || "No location"}</b>
                </div>
              </div>

              <div className="requestBio">
                <span>Bio</span>

                <p>{request.bio || "No bio provided."}</p>

                {request.message && (
                  <>
                    <span>Message</span>
                    <p>{request.message}</p>
                  </>
                )}

                {request.adminNote && (
                  <>
                    <span>Admin Note</span>
                    <p>{request.adminNote}</p>
                  </>
                )}
              </div>

              <div
                className={`requestStatus ${
                  request.status ? request.status.toLowerCase() : "pending"
                }`}
              >
                {request.status || "PENDING"}
              </div>

              <div className="requestActions">
                {request.status === "PENDING" ? (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading === request.id}
                      onClick={() => handleApprove(request)}
                    >
                      {actionLoading === request.id ? "Working..." : "Approve"}
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading === request.id}
                      className="rejectBtn"
                      onClick={() => handleReject(request)}
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <span>Processed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default AdminAgentRequests;