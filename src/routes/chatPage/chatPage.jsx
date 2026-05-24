import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./chatPage.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SocketContext } from "../../context/SocketContext.jsx";

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
    </svg>
  );
}

function ChatPage() {
  const { currentUser } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const navigate = useNavigate();
  const location = useLocation();

  const selectedChatId = location.state?.chatId || "";

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");

  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [openingChatId, setOpeningChatId] = useState("");
  const [error, setError] = useState("");

  const messagesBoxRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  const getReceiver = useCallback(
    (chat) => {
      if (!chat) {
        return null;
      }

      if (chat.receiver) {
        return chat.receiver;
      }

      if (Array.isArray(chat.users)) {
        return chat.users.find((user) => user.id !== currentUser?.id) || null;
      }

      return null;
    },
    [currentUser?.id]
  );

  const formatTime = (date) => {
    if (!date) {
      return "";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return parsedDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date) => {
    if (!date) {
      return "";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return parsedDate.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  };

  const isUnread = useCallback(
    (chat) => {
      if (!currentUser?.id) {
        return false;
      }

      return !(chat.seenBy || []).includes(currentUser.id);
    },
    [currentUser?.id]
  );

  const scrollToBottom = useCallback(() => {
    const box = messagesBoxRef.current;

    if (!box || !shouldAutoScrollRef.current) {
      return;
    }

    box.scrollTop = box.scrollHeight;
  }, []);

  const handleMessagesScroll = () => {
    const box = messagesBoxRef.current;

    if (!box) {
      return;
    }

    const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 120;
  };

  const markChatAsRead = useCallback(
    async (chatId) => {
      if (!chatId || !currentUser?.id) {
        return;
      }

      try {
        await apiRequest.put(`/chats/read/${chatId}`);

        setChats((prev) =>
          prev.map((item) =>
            item.id === chatId
              ? {
                  ...item,
                  seenBy: [...new Set([...(item.seenBy || []), currentUser.id])],
                }
              : item
          )
        );
      } catch (err) {
        console.log("READ CHAT ERROR:", err);
      }
    },
    [currentUser?.id]
  );

  const handleOpenChat = useCallback(
    async (chat) => {
      if (!chat || !currentUser?.id || openingChatId === chat.id) {
        return;
      }

      try {
        shouldAutoScrollRef.current = true;

        setActiveChat(chat);
        setOpeningChatId(chat.id);
        setLoadingMessages(true);
        setError("");

        const res = await apiRequest.get(`/chats/${chat.id}`);

        const loadedMessages = Array.isArray(res.data?.messages)
          ? res.data.messages
          : [];

        setActiveChat({
          ...chat,
          ...res.data,
          receiver: getReceiver(chat) || getReceiver(res.data),
        });

        setMessages(loadedMessages);
        await markChatAsRead(chat.id);
      } catch (err) {
        console.log("OPEN CHAT ERROR:", err);
        setError(err.response?.data?.message || "Failed to open chat.");
      } finally {
        setLoadingMessages(false);
        setOpeningChatId("");
      }
    },
    [currentUser?.id, openingChatId, getReceiver, markChatAsRead]
  );

  const fetchChats = useCallback(async () => {
    if (!currentUser?.id) {
      return;
    }

    try {
      setLoadingChats(true);
      setError("");

      const res = await apiRequest.get("/chats");
      const chatList = Array.isArray(res.data) ? res.data : [];

      setChats(chatList);

      if (selectedChatId) {
        const selectedChat = chatList.find((chat) => chat.id === selectedChatId);

        if (selectedChat) {
          await handleOpenChat(selectedChat);
        }
      }
    } catch (err) {
      console.log("LOAD CHATS ERROR:", err);
      setError(err.response?.data?.message || "Failed to load chats.");
    } finally {
      setLoadingChats(false);
    }
  }, [currentUser?.id, selectedChatId, handleOpenChat]);

  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    fetchChats();
  }, [currentUser, navigate, fetchChats]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!socket || !currentUser?.id) {
      return;
    }

    const receiveMessage = async (data) => {
      if (!data?.chatId) {
        return;
      }

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === data.chatId
            ? {
                ...chat,
                lastMessage: data.text,
                seenBy:
                  activeChat?.id === data.chatId
                    ? [currentUser.id]
                    : chat.seenBy || [],
              }
            : chat
        )
      );

      if (activeChat?.id !== data.chatId) {
        return;
      }

      setMessages((prev) => {
        const exists = prev.some((message) => message.id === data.id);

        if (exists) {
          return prev;
        }

        return [...prev, data];
      });

      await markChatAsRead(data.chatId);
    };

    socket.on("getMessage", receiveMessage);

    return () => {
      socket.off("getMessage", receiveMessage);
    };
  }, [socket, activeChat?.id, currentUser?.id, markChatAsRead]);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    const text = messageText.trim();

    if (!text || !activeChat || sending || !currentUser?.id) {
      return;
    }

    try {
      setSending(true);
      setError("");
      setMessageText("");
      shouldAutoScrollRef.current = true;

      const res = await apiRequest.post("/messages", {
        chatId: activeChat.id,
        text,
      });

      const newMessage = {
        ...res.data,
        chatId: res.data?.chatId || activeChat.id,
      };

      setMessages((prev) => {
        const exists = prev.some((message) => message.id === newMessage.id);

        if (exists) {
          return prev;
        }

        return [...prev, newMessage];
      });

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                lastMessage: text,
                seenBy: [currentUser.id],
              }
            : chat
        )
      );

      const receiver = getReceiver(activeChat);
      const receiverId =
        receiver?.id ||
        activeChat.userIDs?.find((userId) => userId !== currentUser.id);

      socket?.emit("newMessage", {
        receiverId,
        data: newMessage,
      });
    } catch (err) {
      console.log("SEND MESSAGE ERROR:", err);
      setError(err.response?.data?.message || "Failed to send message.");
      setMessageText(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chatPage pageFade">
      <section className="chatHeader">
        <div>
          <span>Messages</span>

          <h1>Real-Time Chat</h1>

          <p>Talk directly with property owners, buyers, renters, and agents.</p>
        </div>

        <div className="chatHeaderIcon">
          <ChatIcon />
        </div>
      </section>

      <div className="chatContainer">
        <aside className="chatSidebar">
          <div className="sidebarTop">
            <div>
              <span>Inbox</span>
              <h2>Conversations</h2>
            </div>

            <strong>{chats.length}</strong>
          </div>

          {loadingChats ? (
            <div className="chatSkeletonList">
              <div></div>
              <div></div>
              <div></div>
            </div>
          ) : chats.length > 0 ? (
            <div className="chatList">
              {chats.map((chat) => {
                const receiver = getReceiver(chat);
                const unread = isUnread(chat);
                const active = activeChat?.id === chat.id;

                return (
                  <button
                    type="button"
                    key={chat.id}
                    className={
                      active
                        ? "chatListItem active"
                        : unread
                        ? "chatListItem unread"
                        : "chatListItem"
                    }
                    onClick={() => handleOpenChat(chat)}
                    disabled={openingChatId === chat.id}
                  >
                    <img
                      src={receiver?.avatar || "/no-avatar.png"}
                      alt={receiver?.username || "Receiver"}
                      onError={(e) => {
                        e.currentTarget.src = "/no-avatar.png";
                      }}
                    />

                    <div className="chatListInfo">
                      <div className="chatListTop">
                        <h3>{receiver?.username || "User"}</h3>
                        {unread && <span className="unreadDot"></span>}
                      </div>

                      <p>{chat.lastMessage || "No messages yet"}</p>

                      {chat.createdAt && <small>{formatDate(chat.createdAt)}</small>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="emptyChats">
              <span>
                <ChatIcon />
              </span>

              <h3>No conversations</h3>

              <p>Your chats will appear here when you message someone.</p>
            </div>
          )}
        </aside>

        <main className="chatMain">
          {activeChat ? (
            <>
              <div className="chatTopBar">
                <div className="receiverInfo">
                  <img
                    src={getReceiver(activeChat)?.avatar || "/no-avatar.png"}
                    alt={getReceiver(activeChat)?.username || "Receiver"}
                    onError={(e) => {
                      e.currentTarget.src = "/no-avatar.png";
                    }}
                  />

                  <div>
                    <h2>{getReceiver(activeChat)?.username || "User"}</h2>
                    <p>Active conversation</p>
                  </div>
                </div>
              </div>

              <div
                className="messagesBox"
                ref={messagesBoxRef}
                onScroll={handleMessagesScroll}
              >
                {loadingMessages ? (
                  <div className="messagesLoading">Loading messages...</div>
                ) : messages.length > 0 ? (
                  messages.map((message) => (
                    <div
                      className={
                        message.userId === currentUser?.id
                          ? "messageBubble own"
                          : "messageBubble"
                      }
                      key={message.id}
                    >
                      <div className="messageContent">
                        <p>{message.text}</p>
                        <span>{formatTime(message.createdAt)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="emptyMessages">
                    <span>
                      <ChatIcon />
                    </span>

                    <h3>No messages yet</h3>

                    <p>Send a message to start the conversation.</p>
                  </div>
                )}
              </div>

              <form className="messageForm" onSubmit={handleSendMessage}>
                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Write your message..."
                  disabled={sending}
                />

                <button type="submit" disabled={sending || !messageText.trim()}>
                  {sending ? "Sending..." : "Send"}
                </button>
              </form>
            </>
          ) : (
            <div className="noChatSelected">
              <span>
                <ChatIcon />
              </span>

              <h2>Select a Conversation</h2>

              <p>Choose a chat from the left to start messaging.</p>
            </div>
          )}

          {error && <div className="chatError">{error}</div>}
        </main>
      </div>
    </div>
  );
}

export default ChatPage;