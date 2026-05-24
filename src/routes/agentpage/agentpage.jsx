  import { useCallback, useEffect, useMemo, useState } from "react";
  import { Link } from "react-router-dom";
  import "./agentpage.scss";
  import apiRequest from "../../lib/apiRequest";
  import PageState from "../../components/pageState/pageState";
  import AgentRequestBox from "../../components/agentBoxRequest/agentBoxRequest";

  function AgentIcon() {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }

  function ListingIcon() {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M4 21V10.5L12 4l8 6.5V21" />
        <path d="M9 21v-7h6v7" />
        <path d="M7 21h10" />
      </svg>
    );
  }

  function VerifiedIcon() {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M20 7 10 17l-5-5" />
      </svg>
    );
  }

  function AgentPage() {
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");

    const fetchAgents = useCallback(async (firstLoad = false) => {
      try {
        if (firstLoad) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const res = await apiRequest.get("/agents");
        setAgents(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.log("LOAD AGENTS ERROR:", err);
        setError(err.response?.data?.message || "Failed to load agents.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    }, []);

    useEffect(() => {
      fetchAgents(true);
    }, [fetchAgents]);

    const totalListings = useMemo(() => {
      return agents.reduce((total, agent) => {
        return total + Number(agent.properties || agent.posts?.length || 0);
      }, 0);
    }, [agents]);

    return (
      <div className="agentPage pageFade">
        <section className="agentHero">
          <div className="agentHeroContent">
            <span className="heroBadge">SmartEstate Agents</span>

            <h1>Work With Verified Real Estate Professionals</h1>

            <p>
              Connect with trusted SmartEstate agents who help users find, rent,
              buy, list, and manage properties with confidence.
            </p>

            <div className="heroActions">
              <Link to="/list">Explore Properties</Link>

              <button
                type="button"
                onClick={() => fetchAgents(false)}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing..." : "Refresh Agents"}
              </button>
            </div>
          </div>

          <div className="agentHeroStats">
            <div>
              <span>
                <AgentIcon />
              </span>

              <strong>{agents.length}</strong>
              <small>Verified Agents</small>
            </div>

            <div>
              <span>
                <ListingIcon />
              </span>

              <strong>{totalListings}</strong>
              <small>Active Listings</small>
            </div>
          </div>
        </section>

        <AgentRequestBox />

        {loading ? (
          <PageState
            type="loading"
            title="Loading Agents"
            message="Please wait while we load verified SmartEstate agents."
          />
        ) : error ? (
          <PageState
            type="error"
            title="Failed to Load Agents"
            message={error}
            buttonText="Try Again"
            onClick={() => fetchAgents(true)}
          />
        ) : agents.length === 0 ? (
          <PageState
            type="empty"
            title="No Agents Found"
            message="No approved agent accounts exist yet. Users can request to become agents, and admins can approve them from the admin dashboard."
          />
        ) : (
          <section className="agentSection">
            <div className="sectionHeader">
              <div>
                <span>Verified Team</span>

                <h2>Meet Our Agents</h2>

                <p>
                  Choose an agent to view their profile, listings, and contact
                  options.
                </p>
              </div>

              <strong>{agents.length}</strong>
            </div>

            <div className="agentContainer">
              {agents.map((agent) => {
                const agentName = agent.name || agent.username || "SmartEstate Agent";
                const agentTitle = agent.title || "Real Estate Agent";
                const agentImage =
                  agent.image || agent.avatar || "/no-avatar.png";
                const agentListings =
                  Number(agent.properties || agent.posts?.length || 0) || 0;

                return (
                  <article className="agentCard" key={agent.id}>
                    <div className="agentImageBox">
                      <img
                        src={agentImage}
                        alt={agentName}
                        onError={(e) => {
                          e.currentTarget.src = "/no-avatar.png";
                        }}
                      />

                      <div className="verifiedBadge">
                        <VerifiedIcon />
                        <span>Verified</span>
                      </div>
                    </div>

                    <div className="agentInfo">
                      <div className="agentTop">
                        <div>
                          <h2>{agentName}</h2>
                          <h3>{agentTitle}</h3>
                        </div>

                        <span className="agentRole">{agent.role || "AGENT"}</span>
                      </div>

                      <p className="agentBio">
                        {agent.bio || "Professional SmartEstate real estate agent."}
                      </p>

                      <div className="details">
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
                          <span>Listings</span>
                          <b>
                            {agentListings} active listing
                            {agentListings === 1 ? "" : "s"}
                          </b>
                        </div>
                      </div>

                      <Link to={`/agents/${agent.id}`} className="agentButton">
                        View Agent & Chat
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="whyAgents">
          <div>
            <span>Why Agents Matter</span>

            <h2>Why Work With Our Agents?</h2>
          </div>

          <p>
            Our agents provide trusted support, property guidance, and fast
            communication. They help users choose the right property, understand
            listing details, schedule visits, and connect with property owners.
          </p>
        </section>
      </div>
    );
  }

  export default AgentPage;