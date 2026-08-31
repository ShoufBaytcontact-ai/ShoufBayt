import { useCallback, useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./agentDetailsPage.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageState from "../../components/pageState/pageState";
import ReviewsPanel from "../../components/reviewsPanel/reviewsPanel";
import Card from "../../components/card/card";

function normalizeId(id) {
  return String(id || "").trim();
}

function getId(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "object") {
    return normalizeId(value.id || value._id || value.userId);
  }

  return normalizeId(value);
}

function getCurrentUserId(currentUser) {
  return (
    getId(currentUser) ||
    getId(currentUser?.user) ||
    getId(currentUser?.data) ||
    getId(currentUser?.userInfo) ||
    getId(currentUser?.profile)
  );
}

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

function AgentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { currentUser } = useContext(AuthContext);
  const currentUserId = getCurrentUserId(currentUser);

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState("");
  const [reviewStats, setReviewStats] = useState({ average: 0, count: 0 });

  const handleReviewStats = useCallback((stats) => {
    setReviewStats({
      average: Number(stats?.average) || 0,
      count: Number(stats?.count) || 0,
    });
  }, []);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await apiRequest.get(`/agents/${id}`);
        setAgent(res.data);
      } catch (err) {
        console.log("LOAD AGENT ERROR:", err);
        setError(err.response?.data?.message || "Failed to load agent.");
      } finally {
        setLoading(false);
      }
    };

    fetchAgent();
  }, [id]);

  const handleStartChat = async () => {
    setError("");

    if (!currentUserId) {
      navigate("/login");
      return;
    }

    const receiverId = normalizeId(agent?.userId);

    if (!receiverId) {
      setError("This agent account is not connected correctly.");
      return;
    }

    if (receiverId === currentUserId) {
      setError("You cannot chat with yourself.");
      return;
    }

    if (chatLoading) {
      return;
    }

    try {
      setChatLoading(true);

      const res = await apiRequest.post("/chats", {
        receiverId,
      });

      const chatId = normalizeId(res.data?.id || res.data?._id);

      if (!chatId) {
        throw new Error("Could not create or open chat.");
      }

      navigate("/chat", {
        state: {
          chatId,
          openChatNow: Date.now(),
        },
      });
    } catch (err) {
      console.log("START AGENT CHAT ERROR:", err);
      setError(err.response?.data?.message || "Failed to start chat.");
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="agentDetailsPage pageFade">
        <PageState
          type="loading"
          title="Loading Agent"
          message="Please wait while we load this agent profile."
        />
      </div>
    );
  }

  if (error && !agent) {
    return (
      <div className="agentDetailsPage pageFade">
        <PageState
          type="error"
          title="Agent Not Available"
          message={error}
          buttonText="Back to Agents"
          buttonLink="/agents"
        />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="agentDetailsPage pageFade">
        <PageState
          type="empty"
          title="Agent Not Found"
          message="This agent profile does not exist or may have been removed."
          buttonText="Back to Agents"
          buttonLink="/agents"
        />
      </div>
    );
  }

  return (
    <div className="agentDetailsPage pageFade">
      <div className="agentHero">
        <div className="agentImageBox">
          <img
            src={getImageUrl(agent.image || agent.avatar)}
            alt={agent.name || "Agent"}
            onError={(e) => {
              e.currentTarget.src = "/no-avatar.png";
            }}
          />
        </div>

        <div className="agentHeroInfo">
          <p className="agentBadge">Verified ShoufBayt Agent</p>

          <h1>{agent.name || agent.username || "ShoufBayt Agent"}</h1>

          <h3>{agent.title || "Real Estate Agent"}</h3>
          {agent.agencyName ? (
            <p className="agentAgency">{agent.agencyName}</p>
          ) : null}

          {agent.profileId && (
            <a href="#agent-reviews" className="agentRating">
              {reviewStats.count > 0 ? (
                <>
                  <b>{reviewStats.average.toFixed(1)}</b>
                  <span>
                    {reviewStats.count}{" "}
                    {reviewStats.count === 1 ? "review" : "reviews"}
                  </span>
                </>
              ) : (
                <span>Leave a review</span>
              )}
            </a>
          )}

          <p>{agent.bio || "Professional ShoufBayt real estate agent."}</p>

          <div className="agentInfoGrid">
            <div>
              <span>Location</span>
              <b>{agent.location || "No location"}</b>
            </div>

            <div>
              <span>Phone</span>
              <b>{agent.phone || "No phone"}</b>
            </div>

            <div>
              <span>Email</span>
              <b>{agent.email || "No email"}</b>
            </div>

            <div>
              <span>Active Listings</span>
              <b>
                {(agent.propertyList || agent.posts || []).length ||
                  agent.properties ||
                  0}
              </b>
            </div>
          </div>

          <div className="heroActions">
            <button
              type="button"
              onClick={handleStartChat}
              disabled={chatLoading}
            >
              {chatLoading ? "Opening Chat..." : "Contact Agent"}
            </button>

            <Link to="/agents">Back to Agents</Link>
          </div>

          {error && <p className="agentError">{error}</p>}
        </div>
      </div>

      <div className="agentContent">
        <div className="agentListings">
          <div className="sectionTitle">
            <span>Listings</span>
            <h2>Agent Listings</h2>
            <p>Real properties published by this agent.</p>
          </div>

          {!(agent.propertyList || agent.posts)?.length ? (
            <div className="emptyBox">
              <h3>No Listings Yet</h3>
              <p>This agent has not published any properties yet.</p>
            </div>
          ) : (
            <div className="listingGrid">
              {(agent.propertyList || agent.posts).map((post) => (
                <Card key={post.id} item={post} />
              ))}
            </div>
          )}
        </div>

        {agent.profileId && (
          <aside id="agent-reviews" className="agentReviews">
            <div className="sectionTitle">
              <span>Reviews</span>
              <h2>Client reviews</h2>
              <p>What people say about this agent.</p>
            </div>

            <ReviewsPanel
              mode="agent"
              targetId={agent.profileId}
              embedded
              onStats={handleReviewStats}
              canWrite={currentUserId !== normalizeId(agent.userId)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

export default AgentDetailsPage;