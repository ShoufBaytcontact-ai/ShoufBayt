import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./agentDetailsPage.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SocketContext } from "../../context/SocketContext.jsx";
import PageState from "../../components/pageState/pageState";

function AgentDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { currentUser } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const messageEndRef = useRef(null);
  const messagesBoxRef = useRef(null);

  const [agent, setAgent] = useState(null);
  const [chat, setChat] = useState(null);
  const [text, setText] = useState("");

  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const chatId = chat?.id;

  const scrollToBottom = useCallback(() => {
    const messagesBox = messagesBoxRef.current;

    if (messagesBox) {
      messagesBox.scrollTop = messagesBox.scrollHeight;
      return;
    }

    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
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

  useEffect(() => {
    scrollToBottom();
  }, [chat?.messages, scrollToBottom]);

  const markChatAsRead = useCallback(async (selectedChatId) => {
    if (!selectedChatId) {
      return;
    }

    try {
      await apiRequest.put(`/chats/read/${selectedChatId}`);
    } catch (err) {
      console.log("READ CHAT ERROR:", err);
    }
  }, []);

  const handleStartChat = async () => {
    setError("");

    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (!agent?.userId) {
      setError("This agent account is not connected correctly.");
      return;
    }

    if (String(currentUser.id) === String(agent.userId)) {
      setError("You cannot chat with yourself.");
      return;
    }

    if (chatLoading) {
      return;
    }

    try {
      setChatLoading(true);

      const chatRes = await apiRequest.post("/chats", {
        receiverId: agent.userId,
      });

      const fullChatRes = await apiRequest.get(`/chats/${chatRes.data.id}`);

      const openedChat = {
        ...fullChatRes.data,
        receiver: {
          id: agent.userId,
          username: agent.name || agent.username || "Agent",
          avatar: agent.image || agent.avatar || "/no-avatar.png",
        },
      };

      setChat(openedChat);
      await markChatAsRead(openedChat.id);
    } catch (err) {
      console.log("START AGENT CHAT ERROR:", err);
      setError(err.response?.data?.message || "Failed to start chat.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    const cleanText = text.trim();

    if (!cleanText || !chat || sending) {
      return;
    }

    try {
      setSending(true);
      setError("");

      const res = await apiRequest.post("/messages", {
        chatId: chat.id,
        text: cleanText,
      });

      setChat((prev) => ({
        ...prev,
        messages: [...(prev?.messages || []), res.data],
        lastMessage: cleanText,
      }));

      socket?.emit("newMessage", {
        data: res.data,
        receiverId: agent?.userId,
      });

      setText("");
    } catch (err) {
      console.log("SEND AGENT MESSAGE ERROR:", err);
      setError(err.response?.data?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!socket || !chatId) {
      return;
    }

    const handleIncomingMessage = async (data) => {
      if (data.chatId !== chatId) {
        return;
      }

      setChat((prev) => ({
        ...prev,
        messages: [...(prev?.messages || []), data],
        lastMessage: data.text,
      }));

      await markChatAsRead(chatId);
    };

    socket.on("getMessage", handleIncomingMessage);

    return () => {
      socket.off("getMessage", handleIncomingMessage);
    };
  }, [socket, chatId, markChatAsRead]);

  const formatPrice = (price) => {
    const numberPrice = Number(price);

    if (!Number.isFinite(numberPrice)) {
      return "$0";
    }

    return `$${numberPrice.toLocaleString()}`;
  };

  const formatDate = (date) => {
    if (!date) {
      return "Just now";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Just now";
    }

    return parsedDate.toLocaleString();
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
            src={agent.image || agent.avatar || "/no-avatar.png"}
            alt={agent.name || "Agent"}
            onError={(e) => {
              e.currentTarget.src = "/no-avatar.png";
            }}
          />
        </div>

        <div className="agentHeroInfo">
          <span className="agentBadge">Verified SmartEstate Agent</span>

          <h1>{agent.name || agent.username || "SmartEstate Agent"}</h1>

          <h3>{agent.title || "Real Estate Agent"}</h3>

          <p>{agent.bio || "Professional SmartEstate real estate agent."}</p>

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
              <b>{agent.posts?.length || agent.properties || 0}</b>
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

          {!agent.posts || agent.posts.length === 0 ? (
            <div className="emptyBox">
              <h3>No Listings Yet</h3>
              <p>This agent has not published any properties yet.</p>
            </div>
          ) : (
            <div className="listingGrid">
              {agent.posts.map((post) => (
                <Link
                  to={`/properties/${post.id}`}
                  className="listingCard"
                  key={post.id}
                >
                  <img
                    src={post.images?.[0] || "/no-image.png"}
                    alt={post.title || "Property"}
                    onError={(e) => {
                      e.currentTarget.src = "/no-image.png";
                    }}
                  />

                  <div className="listingInfo">
                    <h3>{post.title || "Property"}</h3>

                    <p>{post.city || "Unknown city"}</p>

                    <div className="listingMeta">
                      <span>{post.type || "N/A"}</span>
                      <span>{post.property || "N/A"}</span>
                    </div>

                    <b>{formatPrice(post.price)}</b>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="agentChatPanel">
          <div className="sectionTitle">
            <span>Direct Chat</span>
            <h2>Chat With Agent</h2>
            <p>
              Start a direct conversation with{" "}
              {agent.name || agent.username || "this agent"}.
            </p>
          </div>

          {!chat ? (
            <div className="chatStartBox">
              <p>
                Open a private chat with this verified agent to ask about
                listings, visits, pricing, or property details.
              </p>

              <button
                type="button"
                onClick={handleStartChat}
                disabled={chatLoading}
              >
                {chatLoading ? "Opening Chat..." : "Start Chat"}
              </button>
            </div>
          ) : (
            <div className="inlineChat">
              <div className="chatTop">
                <img
                  src={agent.image || agent.avatar || "/no-avatar.png"}
                  alt={agent.name || "Agent"}
                  onError={(e) => {
                    e.currentTarget.src = "/no-avatar.png";
                  }}
                />

                <div>
                  <h3>{agent.name || agent.username || "Agent"}</h3>
                  <span>{agent.title || "Real Estate Agent"}</span>
                </div>
              </div>

              <div className="chatMessages" ref={messagesBoxRef}>
                {!chat.messages || chat.messages.length === 0 ? (
                  <div className="noMessages">
                    <h3>No Messages Yet</h3>
                    <p>Start the conversation by sending a message.</p>
                  </div>
                ) : (
                  chat.messages.map((message) => (
                    <div
                      className={
                        message.userId === currentUser?.id
                          ? "chatBubble own"
                          : "chatBubble"
                      }
                      key={message.id}
                    >
                      <p>{message.text}</p>
                      <span>{formatDate(message.createdAt)}</span>
                    </div>
                  ))
                )}

                <div ref={messageEndRef}></div>
              </div>

              <form className="chatForm" onSubmit={handleSendMessage}>
                <textarea
                  placeholder="Type your message..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={sending}
                ></textarea>

                <button type="submit" disabled={sending || !text.trim()}>
                  {sending ? "Sending..." : "Send"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgentDetailsPage;