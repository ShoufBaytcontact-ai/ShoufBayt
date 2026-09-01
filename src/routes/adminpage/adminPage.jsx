import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./adminPage.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageState from "../../components/pageState/pageState";
import AdminAgentRequests from "../../components/adminAgentRequests/adminAgentRequests";
import AdminAnalytics from "../../components/adminAnalytics/adminAnalytics";
import AdminBillingPanel from "../../components/adminBillingPanel/adminBillingPanel";
import PhoneField from "../../components/phoneField/PhoneField";
import { isValidPhone } from "../../lib/phoneCountries";

const initialAgentForm = {
  userId: "",
  name: "",
  title: "",
  phone: "",
  location: "",
  bio: "",
};

function getServerUrl() {
  return (process.env.REACT_APP_API_URL || "http://localhost:8800/api").replace(
    "/api",
    ""
  );
}

function getImageUrl(image, fallback = "/no-avatar.png") {
  if (!image || typeof image !== "string") {
    return fallback;
  }

  if (image.startsWith("http") || image.startsWith("data:")) {
    return image;
  }

  const serverUrl = getServerUrl();

  return `${serverUrl}${image.startsWith("/") ? "" : "/"}${image}`;
}

function AdminPage() {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const previousSnapshotRef = useRef(null);
  const notificationIdRef = useRef(1);
  const bootstrappedRef = useRef(false);
  const tRef = useRef(t);
  tRef.current = t;

  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [contactMessages, setContactMessages] = useState([]);
  const [agents, setAgents] = useState([]);

  const [section, setSection] = useState("desk");
  const [peoplePane, setPeoplePane] = useState("users");
  const [billingPane, setBillingPane] = useState("payments");
  const [supportPane, setSupportPane] = useState("inbox");

  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [postSearch, setPostSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [propertyFilter, setPropertyFilter] = useState("ALL");
  const [listingStatusFilter, setListingStatusFilter] = useState("ALL");
  const [listingActionId, setListingActionId] = useState("");

  const [messageSearch, setMessageSearch] = useState("");
  const [messageTypeFilter, setMessageTypeFilter] = useState("ALL");
  const [messageStatusFilter, setMessageStatusFilter] = useState("ALL");

  const [replyForms, setReplyForms] = useState({});
  const [replyLoading, setReplyLoading] = useState("");
  const [aiReplyLoading, setAiReplyLoading] = useState("");

  const [agentForm, setAgentForm] = useState(initialAgentForm);
  const [agentImageFile, setAgentImageFile] = useState(null);
  const [agentImagePreview, setAgentImagePreview] = useState("");
  const [agentRequestsCount, setAgentRequestsCount] = useState(0);

  const [adminNotifications, setAdminNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = currentUser?.role?.toUpperCase() === "ADMIN";

  const pushAdminNotification = useCallback((type, title, message) => {
    const notification = {
      id: notificationIdRef.current,
      type,
      title,
      message,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      read: false,
      system: false,
    };

    notificationIdRef.current += 1;

    setAdminNotifications((prev) => [notification, ...prev].slice(0, 12));
  }, []);

  const fetchAdminData = useCallback(
    async (firstLoad = false, silent = false) => {
      try {
        if (firstLoad) {
          setLoading(true);
        } else if (!silent) {
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

        const nextStats = statsRes.data || {};
        const nextUsers = Array.isArray(usersRes.data) ? usersRes.data : [];
        const nextPosts = Array.isArray(postsRes.data) ? postsRes.data : [];
        const nextMessages = Array.isArray(messagesRes.data)
          ? messagesRes.data
          : [];
        const nextAgents = Array.isArray(agentsRes.data) ? agentsRes.data : [];

        let nextAgentRequestsCount = 0;

        try {
          const requestsRes = await apiRequest.get("/admin/agent-requests");
          const requests = Array.isArray(requestsRes.data)
            ? requestsRes.data
            : [];

          nextAgentRequestsCount = requests.filter((request) => {
            return (request.status || "PENDING").toUpperCase() === "PENDING";
          }).length;
        } catch (err) {
          nextAgentRequestsCount = Number(
            nextStats.pendingAgentRequestsCount ||
              nextStats.agentRequestsCount ||
              nextStats.pendingRequestsCount ||
              0
          );
        }

        const nextSnapshot = {
          messagesCount: nextMessages.length,
          openMessagesCount: nextMessages.filter(
            (item) => (item.status || "").toUpperCase() === "OPEN"
          ).length,
          agentRequestsCount: nextAgentRequestsCount,
        };

        const previousSnapshot = previousSnapshotRef.current;

        if (previousSnapshot && !firstLoad) {
          if (nextSnapshot.messagesCount > previousSnapshot.messagesCount) {
            const added =
              nextSnapshot.messagesCount - previousSnapshot.messagesCount;

            pushAdminNotification(
              "message",
              tRef.current("admin.notifications.newSupportTitle"),
              tRef.current("admin.notifications.newSupportMessage", {
                count: added,
              })
            );
          }

          if (
            nextSnapshot.agentRequestsCount >
            previousSnapshot.agentRequestsCount
          ) {
            const added =
              nextSnapshot.agentRequestsCount -
              previousSnapshot.agentRequestsCount;

            pushAdminNotification(
              "request",
              tRef.current("admin.notifications.newAgentRequestTitle"),
              tRef.current("admin.notifications.newAgentRequestMessage", {
                count: added,
              })
            );
          }
        }

        previousSnapshotRef.current = nextSnapshot;

        setStats(nextStats);
        setUsers(nextUsers);
        setPosts(nextPosts);
        setContactMessages(nextMessages);
        setAgents(nextAgents);
        setAgentRequestsCount(nextAgentRequestsCount);
      } catch (err) {
        console.log("ADMIN PAGE ERROR:", err);
        setError(
          err.response?.data?.message || tRef.current("admin.errors.loadData")
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pushAdminNotification]
  );

  useEffect(() => {
  return () => {
    if (agentImagePreview) {
      URL.revokeObjectURL(agentImagePreview);
    }
  };
}, [agentImagePreview]);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!isAdmin) {
      navigate("/profile");
      return;
    }

    if (bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;
    fetchAdminData(true);
  }, [currentUser, isAdmin, navigate, fetchAdminData]);

  useEffect(() => {
    if (!currentUser || !isAdmin) {
      return undefined;
    }

    const interval = setInterval(() => {
      fetchAdminData(false, true);
    }, 30000);

    return () => clearInterval(interval);
  }, [currentUser, isAdmin, fetchAdminData]);

  const unreadNotifications = useMemo(() => {
    return adminNotifications.filter((item) => !item.read).length;
  }, [adminNotifications]);

  const openMessagesCount = useMemo(() => {
    return contactMessages.filter((item) => {
      return (item.status || "").toUpperCase() === "OPEN";
    }).length;
  }, [contactMessages]);

  const reportMessagesCount = useMemo(() => {
    return contactMessages.filter((item) => {
      return (item.type || "").toUpperCase() === "REPORT";
    }).length;
  }, [contactMessages]);

  const pendingListingsFromList = posts.filter(
    (post) => String(post.status || "").toUpperCase() === "PENDING"
  ).length;
  const pendingListingsCount = Number(
    stats?.pendingPropertiesCount ?? pendingListingsFromList
  );

  const notificationBellCount = useMemo(() => {
    return (
      agentRequestsCount +
      openMessagesCount +
      unreadNotifications +
      pendingListingsCount
    );
  }, [
    agentRequestsCount,
    openMessagesCount,
    unreadNotifications,
    pendingListingsCount,
  ]);

  const notificationItems = useMemo(() => {
    const systemItems = [];

    if (agentRequestsCount > 0) {
      systemItems.push({
        id: "system-agent-requests",
        type: "request",
        title: t("admin.notifications.pendingAgentRequests"),
        message: t("admin.notifications.pendingAgentRequestsMessage", {
          count: agentRequestsCount,
        }),
        time: t("admin.notifications.now"),
        read: false,
        system: true,
        actionSection: "unlock",
      });
    }

    if (openMessagesCount > 0) {
      systemItems.push({
        id: "system-open-messages",
        type: "message",
        title: t("admin.notifications.newMessagesReports"),
        message: t("admin.notifications.newMessagesReportsMessage", {
          count: openMessagesCount,
        }),
        time: t("admin.notifications.now"),
        read: false,
        system: true,
        actionSection: "support",
        actionPane: "inbox",
      });
    }

    if (pendingListingsCount > 0) {
      systemItems.push({
        id: "system-pending-listings",
        type: "post",
        title: t("admin.notifications.pendingListings"),
        message: t("admin.notifications.pendingListingsMessage", {
          count: pendingListingsCount,
        }),
        time: t("admin.notifications.now"),
        read: false,
        system: true,
        actionSection: "listings",
      });
    }

    return [...systemItems, ...adminNotifications];
  }, [
    agentRequestsCount,
    openMessagesCount,
    pendingListingsCount,
    adminNotifications,
    t,
  ]);

  const markNotificationsRead = () => {
    setAdminNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        read: true,
      }))
    );
  };

  const handleNotificationToggle = () => {
    setShowNotifications((prev) => !prev);
    markNotificationsRead();
  };

  const openSection = (nextSection, pane) => {
    setSection(nextSection);

    if (nextSection === "people" && pane) {
      setPeoplePane(pane);
    }

    if (nextSection === "billing" && pane) {
      setBillingPane(pane);
    }

    if (nextSection === "support" && pane) {
      setSupportPane(pane === "live" ? "inbox" : pane);
    }

    setShowNotifications(false);
  };

  const handleNotificationClick = (notification) => {
    if (notification.actionSection === "listings") {
      setListingStatusFilter("PENDING");
    }

    if (notification.actionSection) {
      openSection(notification.actionSection, notification.actionPane);
    }

    markNotificationsRead();
  };

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

    const matches = posts.filter((post) => {
      const searchText = `${post.title || ""} ${post.city || ""} ${
        post.address || ""
      } ${post.user?.username || ""}`
        .toLowerCase()
        .trim();

      const listingKind = String(post.listingType || post.type || "").toLowerCase();
      const category = String(
        post.propertyType || post.property || ""
      ).toLowerCase();
      const status = String(post.status || "").toUpperCase();

      const matchesSearch = searchText.includes(search);
      const matchesType =
        typeFilter === "ALL" ||
        listingKind === typeFilter ||
        (typeFilter === "buy" && listingKind === "sale");
      const matchesProperty =
        propertyFilter === "ALL" || category === propertyFilter;
      const matchesStatus =
        listingStatusFilter === "ALL" || status === listingStatusFilter;

      return matchesSearch && matchesType && matchesProperty && matchesStatus;
    });

    return [...matches].sort((a, b) => {
      const aPending = String(a.status || "").toUpperCase() === "PENDING";
      const bPending = String(b.status || "").toUpperCase() === "PENDING";
      if (aPending === bPending) return 0;
      return aPending ? -1 : 1;
    });
  }, [posts, postSearch, typeFilter, propertyFilter, listingStatusFilter]);

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

  const formatDate = (date) => {
    if (!date) {
      return t("admin.fallback.unknownDate");
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return t("admin.fallback.unknownDate");
    }

    return parsedDate.toLocaleDateString(
      i18n.language === "ar" ? "ar-LB" : "en-US"
    );
  };

  const formatMoney = (price) => {
    const numberPrice = Number(price);

    if (!Number.isFinite(numberPrice)) {
      return "$0";
    }

    return `$${numberPrice.toLocaleString()}`;
  };

  const getMessageStatusLabel = (status) => {
    const value = (status || "OPEN").toUpperCase();

    if (value === "OPEN") return t("admin.messageStatus.new");
    if (value === "READ") return t("admin.messageStatus.inReview");
    if (value === "RESOLVED") return t("admin.messageStatus.answered");

    return value.replace("_", " ");
  };

  const getMessageStatusClass = (status) => {
    const value = (status || "OPEN").toUpperCase();

    if (value === "OPEN") return "new";
    if (value === "READ") return "in-review";
    if (value === "RESOLVED") return "answered";

    return "new";
  };

  const formatType = (value) => {
    if (!value) {
      return t("admin.fallback.na");
    }

    return t(`admin.values.${value}`, { defaultValue: value });
  };

  const handleDeleteUser = async (user) => {
    if (user.id === currentUser?.id) {
      alert(t("admin.alerts.cannotDeleteSelf"));
      return;
    }

    const confirmDelete = window.confirm(
      t("admin.confirms.deleteUser", {
        username: user.username || t("admin.fallback.user"),
      })
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await apiRequest.delete(`/admin/users/${user.id}`);
      await fetchAdminData(false);
    } catch (err) {
      console.log("DELETE USER ERROR:", err);
      alert(err.response?.data?.message || t("admin.errors.deleteUser"));
    }
  };

  const handleDeletePost = async (post) => {
    const confirmDelete = window.confirm(
      t("admin.confirms.deletePost", {
        title: post.title || t("admin.fallback.property"),
      })
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await apiRequest.delete(`/admin/posts/${post.id}`);
      await fetchAdminData(false);
    } catch (err) {
      console.log("DELETE POST ERROR:", err);
      alert(err.response?.data?.message || t("admin.errors.deletePost"));
    }
  };

  const handleDeleteContactMessage = async (message) => {
    const confirmDelete = window.confirm(
      t("admin.confirms.deleteMessage", {
        name: message.name || t("admin.fallback.user"),
      })
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await apiRequest.delete(`/admin/contact-messages/${message.id}`);
      await fetchAdminData(false);
    } catch (err) {
      console.log("DELETE CONTACT MESSAGE ERROR:", err);
      alert(err.response?.data?.message || t("admin.errors.deleteMessage"));
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
      alert(err.response?.data?.message || t("admin.errors.updateRole"));
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

      await fetchAdminData(false, true);
    } catch (err) {
      console.log("UPDATE MESSAGE STATUS ERROR:", err);
      alert(err.response?.data?.message || t("admin.errors.updateMessageStatus"));
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
      alert(err.response?.data?.message || t("admin.errors.generateAIReply"));
    } finally {
      setAiReplyLoading("");
    }
  };

  const handleSendReply = async (message) => {
    const replyText = replyForms[message.id];

    if (!replyText || !replyText.trim()) {
      alert(t("admin.alerts.writeReplyFirst"));
      return;
    }

    try {
      setReplyLoading(message.id);

      const res = await apiRequest.put(
        `/admin/contact-messages/${message.id}/reply`,
        {
          adminReply: replyText.trim(),
          status: "RESOLVED",
        }
      );

      setContactMessages((prev) =>
        prev.map((item) => (item.id === message.id ? res.data : item))
      );

      setReplyForms((prev) => ({
        ...prev,
        [message.id]: "",
      }));

      pushAdminNotification(
        "reply",
        t("admin.notifications.replySentTitle"),
        t("admin.notifications.replySentMessage", {
          name: message.name || t("admin.fallback.user"),
        })
      );

      await fetchAdminData(false, true);
    } catch (err) {
      console.log("SEND ADMIN REPLY ERROR:", err);
      alert(err.response?.data?.message || t("admin.errors.sendReply"));
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

const handleAgentImageChange = (e) => {
  const file = e.target.files?.[0];

  if (!file) {
    setAgentImageFile(null);
    setAgentImagePreview("");
    return;
  }

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    alert("Only JPG, JPEG, PNG, or WEBP images are allowed.");
    e.target.value = "";
    setAgentImageFile(null);
    setAgentImagePreview("");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("Image size must be less than 5MB.");
    e.target.value = "";
    setAgentImageFile(null);
    setAgentImagePreview("");
    return;
  }

  setAgentImageFile(file);
  setAgentImagePreview(URL.createObjectURL(file));
};

  const handleCreateAgent = async (e) => {
    e.preventDefault();

    if (!isValidPhone(agentForm.phone)) {
      alert(t("phoneField.errors.invalid"));
      return;
    }

    try {
      const formData = new FormData();

      formData.append("userId", agentForm.userId);
      formData.append("name", agentForm.name.trim());
      formData.append("title", agentForm.title.trim());
      formData.append("phone", agentForm.phone.trim());
      formData.append("location", agentForm.location.trim());
      formData.append("bio", agentForm.bio.trim());

      if (agentImageFile) {
        formData.append("image", agentImageFile);
      }

      await apiRequest.post("/admin/agents", formData);
setAgentForm(initialAgentForm);
setAgentImageFile(null);
setAgentImagePreview("");
e.target.reset();
      pushAdminNotification(
        "agent",
        t("admin.notifications.agentAddedTitle"),
        t("admin.notifications.agentAddedMessage")
      );

      await fetchAdminData(false);
    } catch (err) {
      console.log("CREATE AGENT ERROR:", err);
      alert(err.response?.data?.message || t("admin.errors.createAgent"));
    }
  };

  const handleRemoveAgent = async (agent) => {
    const confirmRemove = window.confirm(
      t("admin.confirms.removeAgent", {
        name: agent.name || t("admin.fallback.agent"),
      })
    );

    if (!confirmRemove) {
      return;
    }

    try {
      await apiRequest.delete(`/admin/agents/${agent.id}`);

      pushAdminNotification(
        "agent",
        t("admin.notifications.agentRemovedTitle"),
        t("admin.notifications.agentRemovedMessage", {
          name: agent.name || t("admin.fallback.agent"),
        })
      );

      await fetchAdminData(false);
    } catch (err) {
      console.log("REMOVE AGENT ERROR:", err);
      alert(err.response?.data?.message || t("admin.errors.removeAgent"));
    }
  };

  const handleViewPost = (id) => {
    navigate(`/properties/${id}`);
  };

  const handleEditPost = (id) => {
    navigate(`/posts/edit/${id}`);
  };

  const handleListingStatus = async (post, status) => {
    let rejectionReason = "";

    if (status === "REJECTED") {
      rejectionReason = window.prompt(
        t("admin.posts.prompts.rejectReason", {
          title: post.title || t("admin.fallback.property"),
        }),
        ""
      );

      if (rejectionReason === null) {
        return;
      }

      if (!String(rejectionReason).trim()) {
        alert(t("admin.posts.alerts.reasonRequired"));
        return;
      }
    }

    try {
      setListingActionId(`${post.id}:${status}`);
      await apiRequest.patch(`/admin/properties/${post.id}/status`, {
        status,
        rejectionReason: String(rejectionReason).trim(),
      });

      setPosts((prev) =>
        prev.map((item) =>
          item.id === post.id
            ? {
                ...item,
                status,
                rejectionReason: status === "REJECTED" ? rejectionReason : null,
              }
            : item
        )
      );

      pushAdminNotification(
        "post",
        status === "PUBLISHED"
          ? t("admin.notifications.listingApprovedTitle")
          : t("admin.notifications.listingRejectedTitle"),
        status === "PUBLISHED"
          ? t("admin.notifications.listingApprovedMessage", {
              title: post.title || t("admin.fallback.property"),
            })
          : t("admin.notifications.listingRejectedMessage", {
              title: post.title || t("admin.fallback.property"),
            })
      );
    } catch (err) {
      alert(err.response?.data?.message || t("admin.errors.updateListingStatus"));
    } finally {
      setListingActionId("");
    }
  };

  const handleViewAgent = (id) => {
    navigate(`/agents/${id}`);
  };

  const pendingPaymentsCount = Number(stats?.pendingPaymentsCount || 0);
  const pendingReportsCount = Number(stats?.pendingReportsCount || 0);
  const unlockQueue = agentRequestsCount;
  const supportQueue = openMessagesCount + pendingReportsCount;
  const billingQueue = pendingPaymentsCount;

  if (loading) {
    return (
      <main className="adminPage pageFade">
        <PageState
          type="loading"
          title={t("admin.loading.title")}
          message={t("admin.loading.message")}
        />
      </main>
    );
  }

  if (error) {
    return (
      <main className="adminPage pageFade">
        <PageState
          type="error"
          title={t("admin.errorState.title")}
          message={error}
          buttonText={t("admin.buttons.tryAgain")}
          onClick={() => fetchAdminData(true)}
        />
      </main>
    );
  }

  const navItems = [
    { id: "desk", label: t("admin.tabs.desk") },
    { id: "people", label: t("admin.tabs.people"), count: 0 },
    { id: "listings", label: t("admin.tabs.listings"), count: pendingListingsCount },
    { id: "unlock", label: t("admin.tabs.unlock"), count: unlockQueue },
    { id: "billing", label: t("admin.tabs.billing"), count: billingQueue },
    { id: "support", label: t("admin.tabs.support"), count: supportQueue },
  ];

  return (
    <main className="adminPage pageFade">
      <div className="adminToastStack">
        {adminNotifications.slice(0, 3).map((notification) => (
          <div
            className={`adminToast ${notification.type}`}
            key={notification.id}
          >
            <strong>{notification.title}</strong>
            <p>{notification.message}</p>
          </div>
        ))}
      </div>

      <header className="adminHero">
        <div>
          <p className="adminEyebrow">{t("admin.header.badge")}</p>
        </div>

        <div className="adminHeroActions">
          <div className="adminNotificationBox">
            <button
              type="button"
              className={
                notificationBellCount > 0
                  ? "adminGhostBtn isHot"
                  : "adminGhostBtn"
              }
              onClick={handleNotificationToggle}
            >
              {t("admin.notifications.title")}
              {notificationBellCount > 0 && (
                <em>{notificationBellCount > 99 ? "99+" : notificationBellCount}</em>
              )}
            </button>

            {showNotifications && (
              <div className="adminNotificationDropdown">
                <div className="notificationDropdownHeader">
                  <h3>{t("admin.notifications.title")}</h3>
                  <button type="button" onClick={() => setAdminNotifications([])}>
                    {t("admin.notifications.clear")}
                  </button>
                </div>

                {notificationItems.length > 0 ? (
                  notificationItems.map((notification) => (
                    <button
                      type="button"
                      className={`notificationItem ${notification.type} ${
                        notification.system ? "system" : ""
                      }`}
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <strong>{notification.title}</strong>
                      <p>{notification.message}</p>
                      <span>{notification.time}</span>
                    </button>
                  ))
                ) : (
                  <div className="notificationEmpty">
                    {t("admin.notifications.empty")}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            className="adminPrimaryBtn"
            onClick={() => fetchAdminData(false)}
            disabled={refreshing}
          >
            {refreshing
              ? t("admin.buttons.refreshing")
              : t("admin.buttons.refreshData")}
          </button>
        </div>
      </header>

      <nav className="adminTabs" aria-label={t("admin.header.badge")}>
        {navItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={section === item.id ? "isActive" : ""}
            onClick={() => openSection(item.id)}
          >
            {item.label}
            {item.count > 0 ? <span>{item.count}</span> : null}
          </button>
        ))}
      </nav>

      {section === "desk" && (
        <>
          <section className="adminQueues">
            <button type="button" onClick={() => openSection("unlock")}>
              <span>{t("admin.desk.unlock")}</span>
              <strong>{unlockQueue}</strong>
              <p>{t("admin.desk.unlockHint")}</p>
            </button>
            <button type="button" onClick={() => openSection("billing", "payments")}>
              <span>{t("admin.desk.payments")}</span>
              <strong>{billingQueue}</strong>
              <p>{t("admin.desk.paymentsHint")}</p>
            </button>
            <button type="button" onClick={() => openSection("support", "inbox")}>
              <span>{t("admin.desk.support")}</span>
              <strong>{openMessagesCount}</strong>
              <p>{t("admin.desk.supportHint")}</p>
            </button>
            <button type="button" onClick={() => openSection("support", "reports")}>
              <span>{t("admin.desk.reports")}</span>
              <strong>{pendingReportsCount}</strong>
              <p>{t("admin.desk.reportsHint")}</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setListingStatusFilter("PENDING");
                openSection("listings");
              }}
            >
              <span>{t("admin.desk.listings")}</span>
              <strong>{pendingListingsCount}</strong>
              <p>{t("admin.desk.listingsHint")}</p>
            </button>
          </section>

          <section className="adminSnapshot">
            <div>
              <span>{t("admin.stats.totalUsers")}</span>
              <strong>{Number(stats?.usersCount ?? users.length)}</strong>
            </div>
            <div>
              <span>{t("admin.stats.totalAgents")}</span>
              <strong>{Number(stats?.agentsCount ?? agents.length)}</strong>
            </div>
            <div>
              <span>{t("admin.stats.totalPosts")}</span>
              <strong>{Number(stats?.postsCount ?? posts.length)}</strong>
            </div>
            <div>
              <span>{t("admin.stats.subscriptions")}</span>
              <strong>{Number(stats?.subscriptionsCount ?? 0)}</strong>
            </div>
          </section>

          <section className="latestGrid">
            <div className="latestCard">
              <div className="latestHeader">
                <h3>{t("admin.overview.latestUsers")}</h3>
                <span>{latestUsers.length}</span>
              </div>

              {latestUsers.length > 0 ? (
                latestUsers.map((user) => (
                  <div className="latestItem" key={user.id}>
                    <img
                      src={getImageUrl(user.avatar)}
                      alt={t("admin.alt.userAvatar")}
                      onError={(e) => {
                        e.currentTarget.src = "/no-avatar.png";
                      }}
                    />

                    <div>
                      <b>{user.username || t("admin.fallback.user")}</b>
                      <p>{user.email || t("admin.fallback.noEmail")}</p>
                    </div>

                    <span className="latestBadge">{user.role}</span>
                  </div>
                ))
              ) : (
                <div className="emptySmall">
                  {t("admin.overview.noLatestUsers")}
                </div>
              )}
            </div>

            <div className="latestCard">
              <div className="latestHeader">
                <h3>{t("admin.overview.latestPosts")}</h3>
                <span>{latestPosts.length}</span>
              </div>

              {latestPosts.length > 0 ? (
                latestPosts.map((post) => (
                  <div className="latestItem" key={post.id}>
                    <img
                      src={getImageUrl(post.images?.[0], "/no-image.png")}
                      alt={t("admin.alt.property")}
                      onError={(e) => {
                        e.currentTarget.src = "/no-image.png";
                      }}
                    />

                    <div>
                      <b>{post.title || t("admin.fallback.property")}</b>
                      <p>
                        {post.city || t("admin.fallback.unknown")} •{" "}
                        {formatMoney(post.price)} • {formatDate(post.createdAt)}
                      </p>
                    </div>

                    <button type="button" onClick={() => handleViewPost(post.id)}>
                      {t("admin.buttons.view")}
                    </button>
                  </div>
                ))
              ) : (
                <div className="emptySmall">
                  {t("admin.overview.noLatestPosts")}
                </div>
              )}
            </div>
          </section>

          <AdminAnalytics
            users={users}
            posts={posts}
            agents={agents}
            contactMessages={contactMessages}
            stats={stats}
          />
        </>
      )}

      {section === "people" && (
        <nav className="adminSubTabs">
          <button
            type="button"
            className={peoplePane === "users" ? "isActive" : ""}
            onClick={() => setPeoplePane("users")}
          >
            {t("admin.tabs.users")}
          </button>
          <button
            type="button"
            className={peoplePane === "agents" ? "isActive" : ""}
            onClick={() => setPeoplePane("agents")}
          >
            {t("admin.tabs.agents")}
          </button>
        </nav>
      )}

      {section === "people" && peoplePane === "users" && (
        <section className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>{t("admin.users.badge")}</span>
              <h2>{t("admin.users.title")}</h2>
              <p>{t("admin.users.description")}</p>
            </div>

            <span className="countPill">
              {t("admin.users.count", { count: filteredUsers.length })}
            </span>
          </div>

          <div className="filtersGrid">
            <input
              type="text"
              placeholder={t("admin.users.searchPlaceholder")}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">{t("admin.users.allRoles")}</option>
              <option value="USER">{t("admin.users.usersOnly")}</option>
              <option value="AGENT">{t("admin.users.agentsOnly")}</option>
              <option value="ADMIN">{t("admin.users.adminsOnly")}</option>
            </select>
          </div>

          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>{t("admin.users.table.user")}</th>
                  <th>{t("admin.users.table.email")}</th>
                  <th>{t("admin.users.table.role")}</th>
                  <th>{t("admin.users.table.posts")}</th>
                  <th>{t("admin.users.table.saved")}</th>
                  <th>{t("admin.users.table.messages")}</th>
                  <th>{t("admin.users.table.actions")}</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="userCell">
                          <img
                            src={getImageUrl(user.avatar)}
                            alt={t("admin.alt.userAvatar")}
                            onError={(e) => {
                              e.currentTarget.src = "/no-avatar.png";
                            }}
                          />

                          <span>{user.username || t("admin.fallback.user")}</span>
                        </div>
                      </td>

                      <td>{user.email || t("admin.fallback.noEmail")}</td>

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
                          {t("admin.buttons.delete")}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7">
                      <div className="emptyState">{t("admin.users.noUsers")}</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {section === "listings" && (
        <section className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>{t("admin.posts.badge")}</span>
              <h2>{t("admin.posts.title")}</h2>
              <p>{t("admin.posts.description")}</p>
            </div>

            <span className="countPill">
              {t("admin.posts.count", { count: filteredPosts.length })}
            </span>
          </div>

          <div className="filtersGrid postFilters">
            <input
              type="text"
              placeholder={t("admin.posts.searchPlaceholder")}
              value={postSearch}
              onChange={(e) => setPostSearch(e.target.value)}
            />

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="ALL">{t("admin.posts.allTypes")}</option>
              <option value="buy">{t("admin.values.buy")}</option>
              <option value="rent">{t("admin.values.rent")}</option>
            </select>

            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
            >
              <option value="ALL">{t("admin.posts.allProperties")}</option>
              <option value="apartment">{t("admin.values.apartment")}</option>
              <option value="house">{t("admin.values.house")}</option>
              <option value="land">{t("admin.values.land")}</option>
            </select>

            <select
              value={listingStatusFilter}
              onChange={(e) => setListingStatusFilter(e.target.value)}
            >
              <option value="ALL">{t("admin.posts.allStatuses")}</option>
              <option value="PENDING">{t("admin.posts.status.pending")}</option>
              <option value="PUBLISHED">{t("admin.posts.status.published")}</option>
              <option value="REJECTED">{t("admin.posts.status.rejected")}</option>
              <option value="SOLD">{t("admin.posts.status.sold")}</option>
              <option value="RENTED">{t("admin.posts.status.rented")}</option>
            </select>
          </div>

          <div className="tableWrapper">
            <table>
              <thead>
                <tr>
                  <th>{t("admin.posts.table.property")}</th>
                  <th>{t("admin.posts.table.owner")}</th>
                  <th>{t("admin.posts.table.city")}</th>
                  <th>{t("admin.posts.table.price")}</th>
                  <th>{t("admin.posts.table.type")}</th>
                  <th>{t("admin.posts.table.category")}</th>
                  <th>{t("admin.posts.table.status")}</th>
                  <th>{t("admin.posts.table.actions")}</th>
                </tr>
              </thead>

              <tbody>
                {filteredPosts.length > 0 ? (
                  filteredPosts.map((post) => (
                    <tr key={post.id}>
                      <td>
                        <div className="postCell">
                          <img
                            src={getImageUrl(post.images?.[0], "/no-image.png")}
                            alt={t("admin.alt.property")}
                            onError={(e) => {
                              e.currentTarget.src = "/no-image.png";
                            }}
                          />

                          <span>{post.title || t("admin.fallback.property")}</span>
                        </div>
                      </td>

                      <td>{post.user?.username || t("admin.fallback.unknown")}</td>
                      <td>{post.city || t("admin.fallback.unknown")}</td>
                      <td>{formatMoney(post.price)}</td>

                      <td>
                        <span className="miniBadge">
                          {formatType(
                            String(
                              post.listingType || post.type || ""
                            ).toLowerCase() === "sale"
                              ? "buy"
                              : String(post.listingType || post.type || "").toLowerCase()
                          )}
                        </span>
                      </td>

                      <td>
                        <span className="miniBadge">
                          {formatType(
                            String(post.propertyType || post.property || "").toLowerCase()
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`miniBadge ${(
                            post.status || "PENDING"
                          ).toLowerCase()}`}
                        >
                          {t(
                            `admin.posts.status.${String(
                              post.status || "PENDING"
                            ).toLowerCase()}`,
                            {
                              defaultValue: post.status || "PENDING",
                            }
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="actionGroup">
                          <button
                            type="button"
                            className="viewBtn"
                            onClick={() => handleViewPost(post.id)}
                          >
                            {t("admin.buttons.view")}
                          </button>

                          <button
                            type="button"
                            className="viewBtn"
                            onClick={() => handleEditPost(post.id)}
                          >
                            {t("admin.buttons.edit")}
                          </button>

                          {["PENDING", "REJECTED"].includes(
                            String(post.status || "").toUpperCase()
                          ) && (
                            <button
                              type="button"
                              className="viewBtn"
                              disabled={Boolean(listingActionId)}
                              onClick={() =>
                                handleListingStatus(post, "PUBLISHED")
                              }
                            >
                              {listingActionId === `${post.id}:PUBLISHED`
                                ? t("admin.buttons.working")
                                : String(post.status || "").toUpperCase() ===
                                    "REJECTED"
                                  ? t("admin.buttons.approveAgain")
                                  : t("admin.buttons.approve")}
                            </button>
                          )}

                          {["PENDING", "PUBLISHED"].includes(
                            String(post.status || "").toUpperCase()
                          ) && (
                            <button
                              type="button"
                              className="dangerBtn"
                              disabled={Boolean(listingActionId)}
                              onClick={() =>
                                handleListingStatus(post, "REJECTED")
                              }
                            >
                              {listingActionId === `${post.id}:REJECTED`
                                ? t("admin.buttons.working")
                                : String(post.status || "").toUpperCase() ===
                                    "PUBLISHED"
                                  ? t("admin.buttons.rejectApproved")
                                  : t("admin.buttons.reject")}
                            </button>
                          )}

                          <button
                            type="button"
                            className="dangerBtn"
                            onClick={() => handleDeletePost(post)}
                          >
                            {t("admin.buttons.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8">
                      <div className="emptyState">{t("admin.posts.noPosts")}</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {section === "people" && peoplePane === "agents" && (
        <section className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>{t("admin.agents.badge")}</span>
              <h2>{t("admin.agents.title")}</h2>
              <p>{t("admin.agents.description")}</p>
            </div>

            <span className="countPill">
              {t("admin.agents.count", { count: agents.length })}
            </span>
          </div>

       <form className="agentCreateBox" onSubmit={handleCreateAgent}>
  <div className="agentCreateHeader">
    <div>
      <span className="agentCreateBadge">
        {t("admin.agents.manualSetup", {
          defaultValue: "Manual Agent Setup",
        })}
      </span>

      <h3>{t("admin.agents.addNewAgent")}</h3>

      <p>
        {t("admin.agents.addNewAgentDescription", {
          defaultValue:
            "Select an existing user, complete their professional profile, and upload a clear agent profile picture.",
        })}
      </p>
    </div>

    <div className="agentCreateIcon">
      <span>AG</span>
    </div>
  </div>

  <div className="agentCreateBody">
    <div className="agentUploadCard">
     <div className={agentImagePreview ? "agentUploadPreview hasImage" : "agentUploadPreview"}>
  {agentImagePreview ? (
    <img src={agentImagePreview} alt="Agent preview" />
  ) : (
    <span>Photo</span>
  )}
</div>
      <div className="agentUploadInfo">
        <h4>
          {t("admin.agents.profilePicture", {
            defaultValue: "Profile Picture",
          })}
        </h4>

        <p>
          {agentImageFile
            ? agentImageFile.name
            : t("admin.agents.uploadImageHint", {
                defaultValue: "Upload JPG, PNG, JPEG, or WEBP image.",
              })}
        </p>
      </div>

      <input
        id="agentImageUpload"
        className="agentFileInput"
        name="image"
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleAgentImageChange}
      />

      <label htmlFor="agentImageUpload" className="agentUploadBtn">
        {agentImageFile
          ? t("admin.agents.changePhoto", {
              defaultValue: "Change Photo",
            })
          : t("admin.agents.choosePhoto", {
              defaultValue: "Choose Photo",
            })}
      </label>
    </div>

    <div className="agentFieldsPanel">
      <div className="agentFormGrid">
        <div className="agentField full">
          <label>
            {t("admin.agents.userAccount", {
              defaultValue: "User Account",
            })}
          </label>

          <select
            name="userId"
            value={agentForm.userId}
            onChange={handleAgentFormChange}
            required
          >
            <option value="">{t("admin.agents.selectExistingUser")}</option>

            {availableAgentUsers.map((user) => (
              <option value={user.id} key={user.id}>
                {user.username} - {user.email}
              </option>
            ))}
          </select>
        </div>

        <div className="agentField">
          <label>
            {t("admin.agents.nameLabel", {
              defaultValue: "Full Name",
            })}
          </label>

          <input
            name="name"
            type="text"
            placeholder={t("admin.agents.agentFullName")}
            value={agentForm.name}
            onChange={handleAgentFormChange}
            required
          />
        </div>

        <div className="agentField">
          <label>
            {t("admin.agents.titleLabel", {
              defaultValue: "Professional Title",
            })}
          </label>

          <input
            name="title"
            type="text"
            placeholder={t("admin.agents.agentTitle")}
            value={agentForm.title}
            onChange={handleAgentFormChange}
            required
          />
        </div>

        <div className="agentField">
          <label htmlFor="admin-agent-phone">
            {t("admin.agents.phoneLabel", {
              defaultValue: "Phone Number",
            })}
          </label>

          <PhoneField
            id="admin-agent-phone"
            value={agentForm.phone}
            onChange={(phone) =>
              setAgentForm((prev) => ({
                ...prev,
                phone,
              }))
            }
            required
          />
        </div>

        <div className="agentField">
          <label>
            {t("admin.agents.locationLabel", {
              defaultValue: "Location",
            })}
          </label>

          <input
            name="location"
            type="text"
            placeholder={t("admin.agents.location")}
            value={agentForm.location}
            onChange={handleAgentFormChange}
            required
          />
        </div>
      </div>

      <div className="agentField bioField">
        <label>
          {t("admin.agents.bioLabel", {
            defaultValue: "Professional Bio",
          })}
        </label>

        <textarea
          name="bio"
          placeholder={t("admin.agents.agentBio")}
          value={agentForm.bio}
          onChange={handleAgentFormChange}
          required
        ></textarea>
      </div>
    </div>
  </div>

  <div className="agentCreateFooter">
    <p>
      {t("admin.agents.addAgentNote", {
        defaultValue:
          "The selected user will be upgraded to an agent after submission.",
      })}
    </p>

    <button type="submit">{t("admin.agents.addAgent")}</button>
  </div>
</form>

          <div className="agentCardsGrid">
            {agents.length > 0 ? (
              agents.map((agent) => (
                <div className="adminAgentCard" key={agent.id}>
                  <img
                    src={getImageUrl(agent.image)}
                    alt={agent.name || t("admin.fallback.agent")}
                    onError={(e) => {
                      e.currentTarget.src = "/no-avatar.png";
                    }}
                  />

                  <div className="adminAgentInfo">
                    <h3>{agent.name}</h3>
                    <p>{agent.title}</p>

                    <div className="agentMiniDetails">
                      <span>
                        <b>{t("admin.agents.email")}:</b>{" "}
                        {agent.email || t("admin.fallback.noEmail")}
                      </span>

                      <span>
                        <b>{t("admin.agents.phone")}:</b>{" "}
                        {agent.phone || t("admin.fallback.noPhone")}
                      </span>

                      <span>
                        <b>{t("admin.agents.locationLabel")}:</b>{" "}
                        {agent.location || t("admin.fallback.noLocation")}
                      </span>

                      <span>
                        <b>{t("admin.agents.listings")}:</b>{" "}
                        {agent.properties || 0}
                      </span>
                    </div>

                    <div className="actionGroup">
                      <button
                        type="button"
                        className="viewBtn"
                        onClick={() => handleViewAgent(agent.id)}
                      >
                        {t("admin.buttons.view")}
                      </button>

                      <button
                        type="button"
                        className="dangerBtn"
                        onClick={() => handleRemoveAgent(agent)}
                      >
                        {t("admin.agents.removeAgent")}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="emptyState">{t("admin.agents.noAgents")}</div>
            )}
          </div>
        </section>
      )}

      {section === "unlock" && (
        <section className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>{t("admin.agentRequests.badge")}</span>
              <h2>{t("admin.agentRequests.title")}</h2>
              <p>{t("admin.agentRequests.description")}</p>
            </div>

            <span className="countPill">
              {t("admin.agentRequests.pending", { count: agentRequestsCount })}
            </span>
          </div>

          <AdminAgentRequests onRequestUpdated={() => fetchAdminData(false)} />
        </section>
      )}

      {section === "support" && (
        <nav className="adminSubTabs">
          <button
            type="button"
            className={supportPane === "inbox" ? "isActive" : ""}
            onClick={() => setSupportPane("inbox")}
          >
            {t("admin.tabs.messagesReports")}
            {openMessagesCount > 0 ? <span>{openMessagesCount}</span> : null}
          </button>
          <button
            type="button"
            className={supportPane === "reports" ? "isActive" : ""}
            onClick={() => setSupportPane("reports")}
          >
            {t("admin.tabs.propertyReports")}
            {pendingReportsCount > 0 ? <span>{pendingReportsCount}</span> : null}
          </button>
        </nav>
      )}

      {section === "support" && supportPane === "inbox" && (
        <section className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>{t("admin.messages.badge")}</span>
              <h2>{t("admin.messages.title")}</h2>
              <p>{t("admin.messages.description")}</p>
            </div>

            <span className="countPill">
              {t("admin.messages.count", {
                count: filteredContactMessages.length,
              })}
            </span>
          </div>

          <div className="messageSummaryGrid">
            <div>
              <strong>{contactMessages.length}</strong>
              <span>{t("admin.messages.totalMessages")}</span>
            </div>

            <div>
              <strong>{openMessagesCount}</strong>
              <span>{t("admin.messages.new")}</span>
            </div>

            <div>
              <strong>{reportMessagesCount}</strong>
              <span>{t("admin.messages.reports")}</span>
            </div>
          </div>

          <div className="filtersGrid messageFilters">
            <input
              type="text"
              placeholder={t("admin.messages.searchPlaceholder")}
              value={messageSearch}
              onChange={(e) => setMessageSearch(e.target.value)}
            />

            <select
              value={messageTypeFilter}
              onChange={(e) => setMessageTypeFilter(e.target.value)}
            >
              <option value="ALL">{t("admin.messages.allTypes")}</option>
              <option value="MESSAGE">{t("admin.messages.messages")}</option>
              <option value="REPORT">{t("admin.messages.reports")}</option>
            </select>

            <select
              value={messageStatusFilter}
              onChange={(e) => setMessageStatusFilter(e.target.value)}
            >
              <option value="ALL">{t("admin.messages.allStatus")}</option>
              <option value="OPEN">{t("admin.messageStatus.new")}</option>
              <option value="READ">{t("admin.messageStatus.inReview")}</option>
              <option value="RESOLVED">
                {t("admin.messageStatus.answered")}
              </option>
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
                          className={`miniBadge ${(
                            item.type || "message"
                          ).toLowerCase()}`}
                        >
                          {item.type === "REPORT"
                            ? t("admin.messages.report")
                            : t("admin.messages.message")}
                        </span>

                        <span
                          className={`miniBadge ${getMessageStatusClass(
                            item.status
                          )}`}
                        >
                          {getMessageStatusLabel(item.status)}
                        </span>
                      </div>

                      <h3>{item.subject}</h3>

                      <p>
                        {t("admin.messages.from")} <b>{item.name}</b> •{" "}
                        {item.email} • {formatDate(item.createdAt)}
                      </p>
                    </div>

                    <div className="messageActions">
                      <select
                        value={item.status || "OPEN"}
                        onChange={(e) =>
                          handleContactStatusChange(item.id, e.target.value)
                        }
                      >
                        <option value="OPEN">
                          {t("admin.messageStatus.new")}
                        </option>
                        <option value="READ">
                          {t("admin.messageStatus.inReview")}
                        </option>
                        <option value="RESOLVED">
                          {t("admin.messageStatus.answered")}
                        </option>
                      </select>

                      <button
                        type="button"
                        className="dangerBtn"
                        onClick={() => handleDeleteContactMessage(item)}
                      >
                        {t("admin.buttons.delete")}
                      </button>
                    </div>
                  </div>

                  <div className="messageBody">{item.message}</div>

                  {item.adminReply && (
                    <div className="adminReplyPreview">
                      <b>{t("admin.messages.adminReply")}</b>

                      <p>{item.adminReply}</p>

                      {item.adminRepliedAt && (
                        <span>
                          {t("admin.messages.repliedOn")}{" "}
                          {formatDate(item.adminRepliedAt)}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="adminReplyForm">
                    <label>{t("admin.messages.replyToUser")}</label>

                    <textarea
                      placeholder={t("admin.messages.replyPlaceholder")}
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
                          ? t("admin.buttons.generating")
                          : t("admin.buttons.generateAIReply")}
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
                        {replyLoading === item.id
                          ? t("admin.buttons.sending")
                          : t("admin.buttons.sendReply")}
                      </button>

                      <button
                        type="button"
                        className="viewBtn"
                        onClick={() =>
                          handleContactStatusChange(item.id, "RESOLVED")
                        }
                      >
                        {t("admin.buttons.markAnswered")}
                      </button>
                    </div>
                  </div>

                  {item.user && (
                    <div className="linkedUser">
                      {t("admin.messages.linkedAccount")}:{" "}
                      <b>{item.user.username}</b> ({item.user.email})
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="emptyState">{t("admin.messages.noMessages")}</div>
            )}
          </div>
        </section>
      )}

      {section === "billing" && (
        <nav className="adminSubTabs">
          <button
            type="button"
            className={billingPane === "payments" ? "isActive" : ""}
            onClick={() => setBillingPane("payments")}
          >
            {t("admin.tabs.payments")}
            {billingQueue > 0 ? <span>{billingQueue}</span> : null}
          </button>
          <button
            type="button"
            className={billingPane === "subscriptions" ? "isActive" : ""}
            onClick={() => setBillingPane("subscriptions")}
          >
            {t("admin.tabs.subscriptions")}
          </button>
        </nav>
      )}

      {section === "billing" && billingPane === "payments" && (
        <section className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>{t("admin.tabs.payments", { defaultValue: "Payments" })}</span>
              <h2>{t("admin.tabs.payments")}</h2>
              <p>{t("admin.desk.paymentsHint")}</p>
            </div>
          </div>
          <AdminBillingPanel section="payments" />
        </section>
      )}

      {section === "billing" && billingPane === "subscriptions" && (
        <section className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>
                {t("admin.tabs.subscriptions", { defaultValue: "Subscriptions" })}
              </span>
              <h2>{t("admin.tabs.subscriptions")}</h2>
              <p>{t("admin.desk.subscriptionsHint")}</p>
            </div>
          </div>
          <AdminBillingPanel section="subscriptions" />
        </section>
      )}

      {section === "support" && supportPane === "reports" && (
        <section className="adminSection">
          <div className="sectionHeader">
            <div>
              <span>
                {t("admin.tabs.propertyReports", {
                  defaultValue: "Property Reports",
                })}
              </span>
              <h2>Listing reports</h2>
              <p>Review user reports on suspicious or incorrect listings.</p>
            </div>
          </div>
          <AdminBillingPanel section="reports" />
        </section>
      )}
    </main>
  );
}

export default AdminPage;