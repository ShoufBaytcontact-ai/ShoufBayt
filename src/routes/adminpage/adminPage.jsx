import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./adminPage.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import AdminAgentRequests from "../../components/adminAgentRequests/adminAgentRequests";
import AdminAnalytics from "../../components/adminAnalytics/adminAnalytics";

const initialAgentForm = {
  userId: "",
  name: "",
  title: "",
  phone: "",
  location: "",
  bio: "",
  image: "",
};

function AdminPage() {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [contactMessages, setContactMessages] = useState([]);
  const [agents, setAgents] = useState([]);

  const [activeTab, setActiveTab] = useState("users");

  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [postSearch, setPostSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [propertyFilter, setPropertyFilter] = useState("ALL");

  const [messageSearch, setMessageSearch] = useState("");
  const [messageTypeFilter, setMessageTypeFilter] = useState("ALL");
  const [messageStatusFilter, setMessageStatusFilter] = useState("ALL");

  const [replyForms, setReplyForms] = useState({});
  const [replyLoading, setReplyLoading] = useState("");
  const [aiReplyLoading, setAiReplyLoading] = useState("");

  const [agentForm, setAgentForm] = useState(initialAgentForm);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = currentUser?.role?.toUpperCase() === "ADMIN";

  const fetchAdminData = useCallback(async (firstLoad = false) => {
    try {
      if (firstLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const [statsRes, usersRes, postsRes, messagesRes, agentsRes] =
        await Promise.all([
          apiRequest.get("/admin/stats"),
          apiRequest.get("/admin/users"),
          apiRequest.get("/admin/posts"),
          apiRequest.get("/admin/contact-messages"),
          apiRequest.get("/admin/agents"),
        ]);

      setStats(statsRes.data || {});
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
      setContactMessages(
        Array.isArray(messagesRes.data) ? messagesRes.data : []
      );
      setAgents(Array.isArray(agentsRes.data) ? agentsRes.data : []);
    } catch (err) {
      console.log("ADMIN PAGE ERROR:", err);
      setError(err.response?.data?.message || "Failed to load admin data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!isAdmin) {
      navigate("/profile");
      return;
    }

    fetchAdminData(true);
  }, [currentUser, isAdmin, navigate, fetchAdminData]);

  const filteredUsers = useMemo(() => {
    const search = userSearch.toLowerCase().trim();

    return users.filter((user) => {
      const searchText = `${user.username || ""} ${user.email || ""}`
        .toLowerCase()
        .trim();

      const matchesSearch = searchText.includes(search);
      const matchesRole =
        roleFilter === "ALL" ||
        user.role?.toUpperCase() === roleFilter.toUpperCase();

      return matchesSearch && matchesRole;
    });
  }, [users, userSearch, roleFilter]);

  const filteredPosts = useMemo(() => {
    const search = postSearch.toLowerCase().trim();

    return posts.filter((post) => {
      const searchText = `${post.title || ""} ${post.city || ""} ${
        post.address || ""
      } ${post.user?.username || ""}`
        .toLowerCase()
        .trim();

      const matchesSearch = searchText.includes(search);
      const matchesType = typeFilter === "ALL" || post.type === typeFilter;
      const matchesProperty =
        propertyFilter === "ALL" || post.property === propertyFilter;

      return matchesSearch && matchesType && matchesProperty;
    });
  }, [posts, postSearch, typeFilter, propertyFilter]);

  const filteredContactMessages = useMemo(() => {
    const search = messageSearch.toLowerCase().trim();

    return contactMessages.filter((item) => {
      const searchText = `${item.name || ""} ${item.email || ""} ${
        item.subject || ""
      } ${item.message || ""} ${item.adminReply || ""}`
        .toLowerCase()
        .trim();

      const matchesSearch = searchText.includes(search);
      const matchesType =
        messageTypeFilter === "ALL" || item.type === messageTypeFilter;
      const matchesStatus =
        messageStatusFilter === "ALL" || item.status === messageStatusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [
    contactMessages,
    messageSearch,
    messageTypeFilter,
    messageStatusFilter,
  ]);

  const latestUsers = useMemo(() => {
    return [...users]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);
  }, [users]);

  const latestPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);
  }, [posts]);

  const availableAgentUsers = useMemo(() => {
    return users.filter((user) => user.role?.toUpperCase() === "USER");
  }, [users]);

  const openReportsCount = useMemo(() => {
    return contactMessages.filter((item) => item.status === "OPEN").length;
  }, [contactMessages]);

  const formatDate = (date) => {
    if (!date) {
      return "Unknown date";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Unknown date";
    }

    return parsedDate.toLocaleDateString();
  };

  const formatMoney = (price) => {
    const numberPrice = Number(price);

    if (!Number.isFinite(numberPrice)) {
      return "$0";
    }

    return `$${numberPrice.toLocaleString()}`;
  };

  const handleDeleteUser = async (user) => {
    if (user.id === currentUser?.id) {
      alert("You cannot delete your own admin account.");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${user.username}? This will delete their posts, saved posts, chats, and messages.`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await apiRequest.delete(`/admin/users/${user.id}`);
      await fetchAdminData(false);
    } catch (err) {
      console.log("DELETE USER ERROR:", err);
      alert(err.response?.data?.message || "Failed to delete user");
    }
  };

  const handleDeletePost = async (post) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${post.title}"?`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await apiRequest.delete(`/admin/posts/${post.id}`);
      await fetchAdminData(false);
    } catch (err) {
      console.log("DELETE POST ERROR:", err);
      alert(err.response?.data?.message || "Failed to delete post");
    }
  };

  const handleDeleteContactMessage = async (message) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete this message from ${message.name}?`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await apiRequest.delete(`/admin/contact-messages/${message.id}`);
      await fetchAdminData(false);
    } catch (err) {
      console.log("DELETE CONTACT MESSAGE ERROR:", err);
      alert(err.response?.data?.message || "Failed to delete message");
    }
  };

  const handleRoleChange = async (id, role) => {
    try {
      const res = await apiRequest.put(`/admin/users/${id}/role`, {
        role,
      });

      setUsers((prev) =>
        prev.map((user) =>
          user.id === id ? { ...user, role: res.data.role || role } : user
        )
      );

      await fetchAdminData(false);
    } catch (err) {
      console.log("UPDATE ROLE ERROR:", err);
      alert(err.response?.data?.message || "Failed to update role");
    }
  };

  const handleContactStatusChange = async (id, status) => {
    try {
      const res = await apiRequest.put(`/admin/contact-messages/${id}/status`, {
        status,
      });

      setContactMessages((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(res.data || {}),
                status: res.data?.status || status,
              }
            : item
        )
      );
    } catch (err) {
      console.log("UPDATE MESSAGE STATUS ERROR:", err);
      alert(err.response?.data?.message || "Failed to update message status");
    }
  };

  const handleReplyChange = (id, value) => {
    setReplyForms((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleGenerateAIReply = async (message) => {
    try {
      setAiReplyLoading(message.id);

      const res = await apiRequest.post("/ai/admin-reply", {
        name: message.name,
        email: message.email,
        subject: message.subject,
        message: message.message,
        type: message.type,
        status: message.status,
      });

      setReplyForms((prev) => ({
        ...prev,
        [message.id]: res.data.reply || "",
      }));
    } catch (err) {
      console.log("GENERATE AI REPLY ERROR:", err);
      alert(err.response?.data?.message || "Failed to generate AI reply");
    } finally {
      setAiReplyLoading("");
    }
  };

  const handleSendReply = async (message) => {
    const replyText = replyForms[message.id];

    if (!replyText || !replyText.trim()) {
      alert("Please write a reply first.");
      return;
    }

    try {
      setReplyLoading(message.id);

      const res = await apiRequest.put(
        `/admin/contact-messages/${message.id}/reply`,
        {
          adminReply: replyText.trim(),
          status: "READ",
        }
      );

      setContactMessages((prev) =>
        prev.map((item) => (item.id === message.id ? res.data : item))
      );

      setReplyForms((prev) => ({
        ...prev,
        [message.id]: "",
      }));
    } catch (err) {
      console.log("SEND ADMIN REPLY ERROR:", err);
      alert(err.response?.data?.message || "Failed to send reply");
    } finally {
      setReplyLoading("");
    }
  };

  const handleAgentFormChange = (e) => {
    const { name, value } = e.target;

    setAgentForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateAgent = async (e) => {
    e.preventDefault();

    try {
      await apiRequest.post("/admin/agents", {
        ...agentForm,
        name: agentForm.name.trim(),
        title: agentForm.title.trim(),
        phone: agentForm.phone.trim(),
        location: agentForm.location.trim(),
        bio: agentForm.bio.trim(),
        image: agentForm.image.trim(),
      });

      setAgentForm(initialAgentForm);
      await fetchAdminData(false);
    } catch (err) {
      console.log("CREATE AGENT ERROR:", err);
      alert(err.response?.data?.message || "Failed to create agent");
    }
  };

  const handleRemoveAgent = async (agent) => {
    const confirmRemove = window.confirm(
      `Are you sure you want to remove ${agent.name} from agents? The user account will stay, but role will become USER.`
    );

    if (!confirmRemove) {
      return;
    }

    try {
      await apiRequest.delete(`/admin/agents/${agent.id}`);
      await fetchAdminData(false);
    } catch (err) {
      console.log("REMOVE AGENT ERROR:", err);
      alert(err.response?.data?.message || "Failed to remove agent");
    }
  };

  const handleViewPost = (id) => {
    navigate(`/properties/${id}`);
  };

  const handleEditPost = (id) => {
    navigate(`/posts/edit/${id}`);
  };

  const handleViewAgent = (id) => {
    navigate(`/agents/${id}`);
  };

  if (loading) {
    return (
      <div className="adminPage pageFade">
        <div className="adminStateBox">
          <span></span>
          <h2>Loading Admin Dashboard</h2>
          <p>Please wait while we prepare the website data.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="adminPage pageFade">
        <div className="adminStateBox errorState">
          <h2>Admin Error</h2>
          <p>{error}</p>

          <button type="button" onClick={() => fetchAdminData(true)}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="adminPage pageFade">
      <div className="adminHeader">
        <div>
          <span className="adminBadge">Admin Panel</span>

          <h1>SmartEstate Dashboard</h1>

          <p>
            Control users, properties, agents, reports, contact messages, and
            platform activity from one place.
          </p>
        </div>

        <button
          type="button"
          className="refreshBtn"
          onClick={() => fetchAdminData(false)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      <div className="statsGrid">
        <StatCard label="Total Users" value={stats?.usersCount || users.length} />
        <StatCard label="Total Agents" value={agents.length} />
        <StatCard label="Total Posts" value={stats?.postsCount || posts.length} />
        <StatCard label="Total Chats" value={stats?.chatsCount || 0} />
        <StatCard label="Total Messages" value={stats?.messagesCount || 0} />
        <StatCard label="Saved Posts" value={stats?.savedPostsCount || 0} />
        <StatCard
          label="Contact Messages"
          value={stats?.contactMessagesCount ?? contactMessages.length}
        />
        <StatCard
          label="Open Reports"
          value={stats?.openContactMessagesCount ?? openReportsCount}
        />
      </div>

      <AdminAnalytics
        users={users}
        posts={posts}
        agents={agents}
        contactMessages={contactMessages}
        stats={stats}
      />

      <div className="latestGrid">
        <div className="latestCard">
          <div className="latestHeader">
            <h3>Latest Users</h3>
            <span>{latestUsers.length}</span>
          </div>

          {latestUsers.length > 0 ? (
            latestUsers.map((user) => (
              <div className="latestItem" key={user.id}>
                <img
                  src={user.avatar || "/no-avatar.png"}
                  alt="User avatar"
                  onError={(e) => {
                    e.currentTarget.src = "/no-avatar.png";
                  }}
                />

                <div>
                  <b>{user.username || "User"}</b>
                  <p>{user.email || "No email"}</p>
                </div>

                <span className="latestBadge">{user.role}</span>
              </div>
            ))
          ) : (
            <div className="emptySmall">No latest users.</div>
          )}
        </div>

        <div className="latestCard">
          <div className="latestHeader">
            <h3>Latest Posts</h3>
            <span>{latestPosts.length}</span>
          </div>

          {latestPosts.length > 0 ? (
            latestPosts.map((post) => (
              <div className="latestItem" key={post.id}>
                <img
                  src={post.images?.[0] || "/no-image.png"}
                  alt="Property"
                  onError={(e) => {
                    e.currentTarget.src = "/no-image.png";
                  }}
                />

                <div>
                  <b>{post.title || "Property"}</b>

                  <p>
                    {post.city || "Unknown"} • {formatMoney(post.price)} •{" "}
                    {formatDate(post.createdAt)}
                  </p>
                </div>

                <button type="button" onClick={() => handleViewPost(post.id)}>
                  View
                </button>
              </div>
            ))
          ) : (
            <div className="emptySmall">No latest posts.</div>
          )}
        </div>
      </div>

      <div className="adminTabs">
        <button
          type="button"
          className={activeTab === "users" ? "active" : ""}
          onClick={() => setActiveTab("users")}
        >
          Users
        </button>

        <button
          type="button"
          className={activeTab === "posts" ? "active" : ""}
          onClick={() => setActiveTab("posts")}
        >
          Posts
        </button>

        <button
          type="button"
          className={activeTab === "agents" ? "active" : ""}
          onClick={() => setActiveTab("agents")}
        >
          Agents
        </button>

        <button
          type="button"
          className={activeTab === "agentRequests" ? "active" : ""}
          onClick={() => setActiveTab("agentRequests")}
        >
          Agent Requests
        </button>

        <button
          type="button"
          className={activeTab === "messages" ? "active" : ""}
          onClick={() => setActiveTab("messages")}
        >
          Messages / Reports
        </button>
      </div>

      {activeTab === "users" && (
        <div className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>Users</span>

              <h2>Users Management</h2>

              <p>Search users, change roles, and remove accounts.</p>
            </div>

            <span className="countPill">{filteredUsers.length} users</span>
          </div>

          <div className="filtersGrid">
            <input
              type="text"
              placeholder="Search by username or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">All Roles</option>
              <option value="USER">Users Only</option>
              <option value="AGENT">Agents Only</option>
              <option value="ADMIN">Admins Only</option>
            </select>
          </div>

          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Posts</th>
                  <th>Saved</th>
                  <th>Messages</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="userCell">
                          <img
                            src={user.avatar || "/no-avatar.png"}
                            alt="User avatar"
                            onError={(e) => {
                              e.currentTarget.src = "/no-avatar.png";
                            }}
                          />

                          <span>{user.username || "User"}</span>
                        </div>
                      </td>

                      <td>{user.email || "No email"}</td>

                      <td>
                        <select
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value)
                          }
                          disabled={user.id === currentUser?.id}
                        >
                          <option value="USER">USER</option>
                          <option value="AGENT">AGENT</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>

                      <td>{user._count?.posts || 0}</td>
                      <td>{user._count?.savedPosts || 0}</td>
                      <td>{user._count?.messages || 0}</td>

                      <td>
                        <button
                          type="button"
                          className="dangerBtn"
                          onClick={() => handleDeleteUser(user)}
                          disabled={user.id === currentUser?.id}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7">
                      <div className="emptyState">No users found.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "posts" && (
        <div className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>Posts</span>

              <h2>Posts Management</h2>

              <p>Search, review, open, edit, and delete property listings.</p>
            </div>

            <span className="countPill">{filteredPosts.length} posts</span>
          </div>

          <div className="filtersGrid postFilters">
            <input
              type="text"
              placeholder="Search by title, city, address, or owner..."
              value={postSearch}
              onChange={(e) => setPostSearch(e.target.value)}
            />

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">All Types</option>
              <option value="buy">Buy</option>
              <option value="rent">Rent</option>
            </select>

            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
            >
              <option value="ALL">All Properties</option>
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
              <option value="land">Land</option>
            </select>
          </div>

          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Owner</th>
                  <th>City</th>
                  <th>Price</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredPosts.length > 0 ? (
                  filteredPosts.map((post) => (
                    <tr key={post.id}>
                      <td>
                        <div className="postCell">
                          <img
                            src={post.images?.[0] || "/no-image.png"}
                            alt="Property"
                            onError={(e) => {
                              e.currentTarget.src = "/no-image.png";
                            }}
                          />

                          <span>{post.title || "Property"}</span>
                        </div>
                      </td>

                      <td>{post.user?.username || "Unknown"}</td>
                      <td>{post.city || "Unknown"}</td>
                      <td>{formatMoney(post.price)}</td>

                      <td>
                        <span className="miniBadge">{post.type || "N/A"}</span>
                      </td>

                      <td>
                        <span className="miniBadge">
                          {post.property || "N/A"}
                        </span>
                      </td>

                      <td>
                        <div className="actionGroup">
                          <button
                            type="button"
                            className="viewBtn"
                            onClick={() => handleViewPost(post.id)}
                          >
                            View
                          </button>

                          <button
                            type="button"
                            className="viewBtn"
                            onClick={() => handleEditPost(post.id)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="dangerBtn"
                            onClick={() => handleDeletePost(post)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7">
                      <div className="emptyState">No posts found.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "agents" && (
        <div className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>Agents</span>

              <h2>Agents Management</h2>

              <p>Add real agents from existing users and remove agent access.</p>
            </div>

            <span className="countPill">{agents.length} agents</span>
          </div>

          <form className="agentCreateBox" onSubmit={handleCreateAgent}>
            <h3>Add New Agent Manually</h3>

            <div className="agentFormGrid">
              <select
                name="userId"
                value={agentForm.userId}
                onChange={handleAgentFormChange}
                required
              >
                <option value="">Select existing user</option>

                {availableAgentUsers.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.username} - {user.email}
                  </option>
                ))}
              </select>

              <input
                name="name"
                type="text"
                placeholder="Agent full name"
                value={agentForm.name}
                onChange={handleAgentFormChange}
                required
              />

              <input
                name="title"
                type="text"
                placeholder="Agent title"
                value={agentForm.title}
                onChange={handleAgentFormChange}
                required
              />

              <input
                name="phone"
                type="text"
                placeholder="Phone number"
                value={agentForm.phone}
                onChange={handleAgentFormChange}
                required
              />

              <input
                name="location"
                type="text"
                placeholder="Location"
                value={agentForm.location}
                onChange={handleAgentFormChange}
                required
              />

              <input
                name="image"
                type="text"
                placeholder="Image URL optional"
                value={agentForm.image}
                onChange={handleAgentFormChange}
              />
            </div>

            <textarea
              name="bio"
              placeholder="Agent bio"
              value={agentForm.bio}
              onChange={handleAgentFormChange}
              required
            ></textarea>

            <button type="submit">Add Agent</button>
          </form>

          <div className="agentCardsGrid">
            {agents.length > 0 ? (
              agents.map((agent) => (
                <div className="adminAgentCard" key={agent.id}>
                  <img
                    src={agent.image || "/no-avatar.png"}
                    alt={agent.name || "Agent"}
                    onError={(e) => {
                      e.currentTarget.src = "/no-avatar.png";
                    }}
                  />

                  <div className="adminAgentInfo">
                    <h3>{agent.name}</h3>
                    <p>{agent.title}</p>

                    <div className="agentMiniDetails">
                      <span>
                        <b>Email:</b> {agent.email}
                      </span>

                      <span>
                        <b>Phone:</b> {agent.phone}
                      </span>

                      <span>
                        <b>Location:</b> {agent.location}
                      </span>

                      <span>
                        <b>Listings:</b> {agent.properties}
                      </span>
                    </div>

                    <div className="actionGroup">
                      <button
                        type="button"
                        className="viewBtn"
                        onClick={() => handleViewAgent(agent.id)}
                      >
                        View
                      </button>

                      <button
                        type="button"
                        className="dangerBtn"
                        onClick={() => handleRemoveAgent(agent)}
                      >
                        Remove Agent
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="emptyState">No agents found.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "agentRequests" && (
        <div className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>Requests</span>

              <h2>Agent Requests</h2>

              <p>Review users who requested to become SmartEstate agents.</p>
            </div>
          </div>

          <AdminAgentRequests onRequestUpdated={() => fetchAdminData(false)} />
        </div>
      )}

      {activeTab === "messages" && (
        <div className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>Support</span>

              <h2>Messages / Reports</h2>

              <p>Read feedback, reports, reply to users, and update statuses.</p>
            </div>

            <span className="countPill">
              {filteredContactMessages.length} messages
            </span>
          </div>

          <div className="filtersGrid messageFilters">
            <input
              type="text"
              placeholder="Search by name, email, subject, message, or reply..."
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
            />

            <select
              value={messageTypeFilter}
              onChange={(e) => setMessageTypeFilter(e.target.value)}
            >
              <option value="ALL">All Types</option>
              <option value="MESSAGE">Messages</option>
              <option value="REPORT">Reports</option>
            </select>

            <select
              value={messageStatusFilter}
              onChange={(e) => setMessageStatusFilter(e.target.value)}
            >
              <option value="ALL">All Status</option>
              <option value="OPEN">Open</option>
              <option value="READ">Read</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>

          <div className="messageList">
            {filteredContactMessages.length > 0 ? (
              filteredContactMessages.map((item) => (
                <div className="messageCard" key={item.id}>
                  <div className="messageCardTop">
                    <div>
                      <div className="messageBadges">
                        <span
                          className={`miniBadge ${item.type?.toLowerCase()}`}
                        >
                          {item.type}
                        </span>

                        <span
                          className={`miniBadge ${item.status?.toLowerCase()}`}
                        >
                          {item.status}
                        </span>
                      </div>

                      <h3>{item.subject}</h3>

                      <p>
                        From <b>{item.name}</b> • {item.email} •{" "}
                        {formatDate(item.createdAt)}
                      </p>
                    </div>

                    <div className="messageActions">
                      <select
                        value={item.status}
                        onChange={(e) =>
                          handleContactStatusChange(item.id, e.target.value)
                        }
                      >
                        <option value="OPEN">OPEN</option>
                        <option value="READ">READ</option>
                        <option value="RESOLVED">RESOLVED</option>
                      </select>

                      <button
                        type="button"
                        className="dangerBtn"
                        onClick={() => handleDeleteContactMessage(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="messageBody">{item.message}</div>

                  {item.adminReply && (
                    <div className="adminReplyPreview">
                      <b>Admin Reply</b>

                      <p>{item.adminReply}</p>

                      {item.adminRepliedAt && (
                        <span>
                          Replied on {formatDate(item.adminRepliedAt)}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="adminReplyForm">
                    <label>Reply to user</label>

                    <textarea
                      placeholder="Write an admin reply..."
                      value={replyForms[item.id] || ""}
                      onChange={(e) =>
                        handleReplyChange(item.id, e.target.value)
                      }
                    ></textarea>

                    <div className="replyActions">
                      <button
                        type="button"
                        className="aiReplyBtn"
                        onClick={() => handleGenerateAIReply(item)}
                        disabled={
                          aiReplyLoading === item.id ||
                          replyLoading === item.id
                        }
                      >
                        {aiReplyLoading === item.id
                          ? "Generating..."
                          : "Generate AI Reply"}
                      </button>

                      <button
                        type="button"
                        className="viewBtn"
                        onClick={() => handleSendReply(item)}
                        disabled={
                          replyLoading === item.id ||
                          aiReplyLoading === item.id
                        }
                      >
                        {replyLoading === item.id ? "Sending..." : "Send Reply"}
                      </button>

                      <button
                        type="button"
                        className="viewBtn"
                        onClick={() =>
                          handleContactStatusChange(item.id, "RESOLVED")
                        }
                      >
                        Mark Resolved
                      </button>
                    </div>
                  </div>

                  {item.user && (
                    <div className="linkedUser">
                      Linked account: <b>{item.user.username}</b> (
                      {item.user.email})
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="emptyState">No messages found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="statCard">
      <span>{label}</span>
      <h2>{value}</h2>
    </div>
  );
}

export default AdminPage;