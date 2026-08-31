import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./chatPage.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SocketContext } from "../../context/SocketContext.jsx";
import { useNotificationStore } from "../../lib/notificationStore";
import {
  renderSafeMessageText,
  resolveMediaUrl,
} from "../../lib/chatSafeContent.js";

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15a3.2 3.2 0 0 0 3.2-3.2V7a3.2 3.2 0 0 0-6.4 0v4.8A3.2 3.2 0 0 0 12 15Z" />
      <path d="M6.8 11.8a5.2 5.2 0 0 0 10.4 0" />
      <path d="M12 17v3.2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M9 7V5.4A1.4 1.4 0 0 1 10.4 4h3.2A1.4 1.4 0 0 1 15 5.4V7" />
      <path d="M7.2 7 8 19.2A1.6 1.6 0 0 0 9.6 20.6h4.8a1.6 1.6 0 0 0 1.6-1.4L17 7" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="1.4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.2 12 20 5.2 14.4 20l-2.2-6.2L4.2 12Z" />
    </svg>
  );
}

const MAX_VOICE_SECONDS = 300;

const VOICE_BARS = [
  8, 14, 10, 18, 12, 22, 16, 9, 20, 13, 24, 11, 17, 21, 8, 19, 14, 23, 10, 16,
  12, 18, 9, 15,
];

let activeVoiceAudio = null;

function formatVoiceClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function pickVoiceRecorderType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function VoiceNotePlayer({ src, label }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!src) {
      return undefined;
    }

    const audio = new Audio();
    audio.preload = "metadata";
    audio.muted = false;
    audio.volume = 1;
    audio.src = src;
    audioRef.current = audio;

    const sync = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const nextCurrent = audio.currentTime || 0;
      setDuration(nextDuration);
      setCurrent(nextCurrent);
      setProgress(nextDuration > 0 ? nextCurrent / nextDuration : 0);
    };

    const onPlay = () => {
      if (activeVoiceAudio && activeVoiceAudio !== audio) {
        activeVoiceAudio.pause();
      }
      activeVoiceAudio = audio;
      setPlaying(true);
    };

    const onPause = () => {
      setPlaying(false);
      if (activeVoiceAudio === audio) {
        activeVoiceAudio = null;
      }
    };

    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrent(0);
      audio.currentTime = 0;
      if (activeVoiceAudio === audio) {
        activeVoiceAudio = null;
      }
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("loadedmetadata", sync);

    return () => {
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("loadedmetadata", sync);
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      if (activeVoiceAudio === audio) {
        activeVoiceAudio = null;
      }
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (playing) {
      audio.pause();
      return;
    }

    audio.muted = false;
    audio.volume = 1;
    audio.play().catch(() => {});
  };

  const seek = (event) => {
    const audio = audioRef.current;
    const track = event.currentTarget;
    if (!audio || !track || !duration) {
      return;
    }

    const rect = track.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width)
    );
    audio.currentTime = ratio * duration;
  };

  if (!src) {
    return null;
  }

  return (
    <div className={playing ? "voiceNote isPlaying" : "voiceNote"}>
      <button
        type="button"
        className={playing ? "voicePlayBtn playing" : "voicePlayBtn"}
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
            <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5-11-6.5Z" />
          </svg>
        )}
      </button>

      <div className="voiceNoteBody">
        <button
          type="button"
          className="voiceWaveTrack"
          onClick={seek}
          aria-label={label}
        >
          {VOICE_BARS.map((height, index) => {
            const filled = index / VOICE_BARS.length <= progress;
            return (
              <span
                key={`${height}-${index}`}
                className={filled ? "filled" : ""}
                style={{ height: `${height}px` }}
              />
            );
          })}
        </button>

        <div className="voiceNoteMeta">
          <strong>{label}</strong>
          <em>
            {formatVoiceClock(playing || current > 0 ? current : duration)}
          </em>
        </div>
      </div>
    </div>
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

function getUserId(user) {
  return getId(user);
}

function getChatId(chat) {
  return normalizeId(chat?.id || chat?._id);
}

function getMessageId(message) {
  return normalizeId(message?.id || message?._id);
}

function getMessageSenderId(message) {
  return (
    getId(message?.userId) ||
    getId(message?.senderId) ||
    getId(message?.user) ||
    getId(message?.sender) ||
    getId(message?.from) ||
    getId(message?.fromId)
  );
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    ...user,
    id: getUserId(user),
  };
}

function getPersonName(user, fallback = "") {
  return (
    user?.agentProfile?.name ||
    user?.username ||
    fallback
  );
}

function getPersonAvatar(user) {
  return user?.agentProfile?.image || user?.avatar;
}

function isAgentUser(user) {
  return String(user?.role || "").toUpperCase() === "AGENT";
}

function normalizeChat(chat) {
  if (!chat) {
    return null;
  }

  const id = getChatId(chat);

  const userIDs = Array.isArray(chat.userIDs)
    ? chat.userIDs.map((item) => normalizeId(item)).filter(Boolean)
    : Array.isArray(chat.users)
    ? chat.users.map((user) => getUserId(user)).filter(Boolean)
    : [];

  return {
    ...chat,
    id,
    _id: id,
    userIDs,
    users: Array.isArray(chat.users)
      ? chat.users.map((user) => normalizeUser(user)).filter(Boolean)
      : chat.users,
    receiver: chat.receiver ? normalizeUser(chat.receiver) : chat.receiver,
    receivers: Array.isArray(chat.receivers)
      ? chat.receivers.map((user) => normalizeUser(user)).filter(Boolean)
      : chat.receivers,
    receiverId: normalizeId(chat.receiverId),
    seenBy: Array.isArray(chat.seenBy)
      ? chat.seenBy.map((item) => normalizeId(item)).filter(Boolean)
      : [],
    unreadCount: Number(chat.unreadCount) || 0,
  };
}

function normalizeMessage(message, fallbackChatId = "", fallbackUserId = "") {
  if (!message) {
    return null;
  }

  const senderId = getMessageSenderId(message) || normalizeId(fallbackUserId);
  const deletedForEveryone =
    Boolean(message.deletedForEveryone) || message.mediaKind === "deleted";
  const mediaUrl = deletedForEveryone
    ? null
    : message.mediaUrl || message.image || null;
  const mediaKind = deletedForEveryone
    ? "deleted"
    : message.mediaKind || (message.image || message.mediaUrl ? "image" : null);

  return {
    ...message,
    id: getMessageId(message),
    _id: getMessageId(message),
    chatId: normalizeId(message.chatId || message.chatID || fallbackChatId),
    userId: senderId,
    senderId,
    receiverId: normalizeId(message.receiverId),
    text: deletedForEveryone ? "" : message.text || "",
    image: mediaKind === "image" ? mediaUrl : null,
    mediaUrl,
    mediaKind,
    mediaName: deletedForEveryone ? null : message.mediaName || null,
    mediaMime: deletedForEveryone ? null : message.mediaMime || null,
    deletedForEveryone,
    createdAt: message.createdAt || new Date().toISOString(),
  };
}
function getOtherUserIdFromChat(chat, senderId) {
  const normalizedChat = normalizeChat(chat);
  const cleanSenderId = normalizeId(senderId);

  if (!normalizedChat || !cleanSenderId) {
    return "";
  }

  if (normalizedChat.receiverId && normalizedChat.receiverId !== cleanSenderId) {
    return normalizedChat.receiverId;
  }

  if (
    normalizedChat.receiver &&
    getUserId(normalizedChat.receiver) &&
    getUserId(normalizedChat.receiver) !== cleanSenderId
  ) {
    return getUserId(normalizedChat.receiver);
  }

  if (Array.isArray(normalizedChat.userIDs)) {
    const otherUserId = normalizedChat.userIDs.find((userId) => {
      const id = normalizeId(userId);
      return id && id !== cleanSenderId;
    });

    if (otherUserId) {
      return normalizeId(otherUserId);
    }
  }

  if (Array.isArray(normalizedChat.users)) {
    const otherUser = normalizedChat.users.find((user) => {
      const id = getUserId(user);
      return id && id !== cleanSenderId;
    });

    if (otherUser) {
      return getUserId(otherUser);
    }
  }

  return "";
}
function getLoggedUserIdFromChat(chat, currentUserId) {
  const normalizedChat = normalizeChat(chat);
  const cleanCurrentUserId = normalizeId(currentUserId);
  const receiverId = normalizeId(normalizedChat?.receiverId);

  if (!normalizedChat) {
    return cleanCurrentUserId;
  }

  if (Array.isArray(normalizedChat.userIDs) && receiverId) {
    const loggedUserId = normalizedChat.userIDs.find((userId) => {
      const id = normalizeId(userId);
      return id && id !== receiverId;
    });

    if (loggedUserId) {
      return normalizeId(loggedUserId);
    }
  }

  if (cleanCurrentUserId) {
    return cleanCurrentUserId;
  }

  return "";
}

function ChatPage() {
  const { currentUser } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);
  const { t, i18n } = useTranslation();

  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const currentUserId = getCurrentUserId(currentUser);
  const selectedChatId = normalizeId(
    params.chatId ||
      new URLSearchParams(location.search).get("chatId") ||
      location.state?.chatId
  );
  const openChatNow = location.state?.openChatNow || "";

  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]);

  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [showUserPicker, setShowUserPicker] = useState(false);

  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [openingChatId, setOpeningChatId] = useState("");
  const [startingChatUserId, setStartingChatUserId] = useState("");
  const [error, setError] = useState("");
  const [menuMessageId, setMenuMessageId] = useState("");
  const [deletingMessageId, setDeletingMessageId] = useState("");

  const messagesBoxRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordStreamRef = useRef(null);
  const voiceActionRef = useRef("preview");
  const voiceDraftUrlRef = useRef("");
  const recordSecondsRef = useRef(0);
  const shouldAutoScrollRef = useRef(true);
  const openingChatIdRef = useRef("");
  const chatsRef = useRef([]);
  const activeChatRef = useRef(null);
  const activeChatIdRef = useRef("");
  const lastSelectedOpenKeyRef = useRef("");
  const processedSocketMessagesRef = useRef(new Set());

  useEffect(() => {
    if (!menuMessageId) {
      return undefined;
    }

    const closeMenu = () => setMenuMessageId("");
    document.addEventListener("click", closeMenu);

    return () => {
      document.removeEventListener("click", closeMenu);
    };
  }, [menuMessageId]);

  useEffect(() => {
    chatsRef.current = chats;

    if (loadingChats) {
      return;
    }

    if (error && chats.length === 0) {
      return;
    }

    const total = chats.reduce(
      (sum, chat) => sum + (Number(chat.unreadCount) || 0),
      0
    );
    useNotificationStore.getState().setMessages(total);
  }, [chats, loadingChats, error]);

  useEffect(() => {
    activeChatRef.current = activeChat;
    activeChatIdRef.current = getChatId(activeChat);
  }, [activeChat]);

  const usersById = useMemo(() => {
    const map = new Map();

    users.forEach((user) => {
      const userId = getUserId(user);

      if (userId) {
        map.set(userId, user);
      }
    });

    return map;
  }, [users]);

  const getReceiver = useCallback(
    (chat) => {
      const normalizedChat = normalizeChat(chat);

      if (!normalizedChat || !currentUserId) {
        return null;
      }

      const directReceiver = normalizedChat.receiver
        ? normalizeUser(normalizedChat.receiver)
        : null;

      if (
        directReceiver &&
        getUserId(directReceiver) &&
        getUserId(directReceiver) !== currentUserId
      ) {
        return directReceiver;
      }

      if (
        normalizedChat.receiverId &&
        normalizedChat.receiverId !== currentUserId
      ) {
        if (usersById.has(normalizedChat.receiverId)) {
          return usersById.get(normalizedChat.receiverId);
        }

        return {
          id: normalizedChat.receiverId,
          username: t("chatPage.fallback.user"),
          avatar: "/no-avatar.png",
        };
      }

      if (Array.isArray(normalizedChat.users)) {
        const receiver =
          normalizedChat.users.find((user) => {
            const userId = getUserId(user);
            return userId && userId !== currentUserId;
          }) || null;

        if (receiver) {
          return receiver;
        }
      }

      if (Array.isArray(normalizedChat.userIDs)) {
        const receiverId = normalizedChat.userIDs.find((userId) => {
          const id = normalizeId(userId);
          return id && id !== currentUserId;
        });

        if (receiverId && usersById.has(receiverId)) {
          return usersById.get(receiverId);
        }

        if (receiverId) {
          return {
            id: receiverId,
            username: t("chatPage.fallback.user"),
            avatar: "/no-avatar.png",
          };
        }
      }

      return null;
    },
    [currentUserId, usersById, t]
  );

  const getReceivers = useCallback(
    (chat) => {
      const normalizedChat = normalizeChat(chat);

      if (!normalizedChat || !currentUserId) {
        return [];
      }

      if (Array.isArray(normalizedChat.receivers) && normalizedChat.receivers.length) {
        return normalizedChat.receivers
          .map((user) => normalizeUser(user))
          .filter((user) => getUserId(user) && getUserId(user) !== currentUserId);
      }

      if (Array.isArray(normalizedChat.users) && normalizedChat.users.length) {
        return normalizedChat.users
          .map((user) => normalizeUser(user))
          .filter((user) => getUserId(user) && getUserId(user) !== currentUserId);
      }

      const receiver = getReceiver(normalizedChat);
      return receiver ? [receiver] : [];
    },
    [currentUserId, getReceiver]
  );

  const getChatTitle = useCallback(
    (chat) => {
      const receivers = getReceivers(chat);

      if (!receivers.length) {
        return t("chatPage.fallback.user");
      }

      return receivers
        .map((user) => getPersonName(user, t("chatPage.fallback.user")))
        .join(" & ");
    },
    [getReceivers, t]
  );

  const formatTime = (date) => {
    if (!date) {
      return "";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return parsedDate.toLocaleTimeString(
      i18n.language === "ar" ? "ar-LB" : "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  const formatDate = (date) => {
    if (!date) {
      return "";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return parsedDate.toLocaleDateString(
      i18n.language === "ar" ? "ar-LB" : "en-US",
      {
        month: "short",
        day: "numeric",
      }
    );
  };

  const isUnread = useCallback((chat) => {
    return Number(chat?.unreadCount) > 0;
  }, []);

  const unreadCount = useMemo(() => {
    return chats.filter((chat) => isUnread(chat)).length;
  }, [chats, isUnread]);

  const filteredChats = useMemo(() => {
    const search = chatSearch.toLowerCase().trim();

    return [...chats]
      .filter((chat) => {
        const receivers = getReceivers(chat);
        const text = `${getChatTitle(chat)} ${receivers
          .map((user) => `${user?.email || ""} ${user?.role || ""}`)
          .join(" ")} ${chat.lastMessage || ""}`
          .toLowerCase()
          .trim();

        return text.includes(search);
      })
      .sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || 0);
        const dateB = new Date(b.updatedAt || b.createdAt || 0);

        return dateB - dateA;
      });
  }, [chats, chatSearch, getReceivers, getChatTitle]);

  const filteredUsers = useMemo(() => {
    const search = userSearch.toLowerCase().trim();

    return users
      .filter((user) => isAgentUser(user))
      .filter((user) => getUserId(user) !== currentUserId)
      .filter((user) => {
        const text = `${getPersonName(user)} ${user.username || ""} ${
          user.email || ""
        } ${user.agentProfile?.agencyName || ""}`
          .toLowerCase()
          .trim();

        return text.includes(search);
      })
      .sort((a, b) => {
        const nameA = String(getPersonName(a) || a.email || "").toLowerCase();
        const nameB = String(getPersonName(b) || b.email || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [users, userSearch, currentUserId]);

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

    const distanceFromBottom =
      box.scrollHeight - box.scrollTop - box.clientHeight;

    shouldAutoScrollRef.current = distanceFromBottom < 120;
  };

  const markChatAsRead = useCallback(
    async (chatId) => {
      if (!chatId || !currentUserId) {
        return;
      }

      try {
        await apiRequest.put(`/chats/read/${chatId}`);

        setChats((prev) =>
          prev.map((item) =>
            getChatId(item) === chatId
              ? {
                  ...item,
                  unreadCount: 0,
                  seenBy: [...new Set([...(item.seenBy || []), currentUserId])],
                }
              : item
          )
        );
      } catch (err) {
        console.log("READ CHAT ERROR:", err);
      }
    },
    [currentUserId]
  );

  const mergeChatIntoList = useCallback((incomingChat, incomingMessage = null) => {
    const normalizedChat = normalizeChat(incomingChat);

    if (!normalizedChat?.id) {
      return;
    }

    setChats((prev) => {
      const existing = prev.find((chat) => getChatId(chat) === normalizedChat.id);
      const incomingSenderId = getMessageSenderId(incomingMessage);
      const isOwnIncoming =
        incomingSenderId && incomingSenderId === currentUserId;
      const isActiveChat = getChatId(activeChatRef.current) === normalizedChat.id;

      let unreadCount = Number(normalizedChat.unreadCount);
      if (!Number.isFinite(unreadCount)) {
        unreadCount = Number(existing?.unreadCount) || 0;
      }

      if (incomingMessage) {
        if (isActiveChat || isOwnIncoming) {
          unreadCount = 0;
        } else {
          const fromApi = Number(normalizedChat.unreadCount);
          unreadCount =
            Number.isFinite(fromApi) && fromApi > 0
              ? fromApi
              : (Number(existing?.unreadCount) || 0) + 1;
        }
      }

      const updatedChat = normalizeChat({
        ...existing,
        ...normalizedChat,
        unreadCount,
        lastMessage:
          incomingMessage?.text ||
          incomingMessage?.mediaName ||
          normalizedChat.lastMessage ||
          normalizedChat.messages?.[normalizedChat.messages.length - 1]?.text ||
          existing?.lastMessage ||
          "",
        updatedAt:
          incomingMessage?.createdAt ||
          normalizedChat.updatedAt ||
          normalizedChat.createdAt ||
          new Date().toISOString(),
      });

      if (existing) {
        return prev.map((chat) =>
          getChatId(chat) === normalizedChat.id ? updatedChat : chat
        );
      }

      return [updatedChat, ...prev];
    });
  }, [currentUserId]);

  const handleOpenChat = useCallback(
    async (chat) => {
      const chatId = getChatId(chat);

      if (!chat || !chatId || !currentUserId) {
        return;
      }

      if (openingChatIdRef.current === chatId) {
        return;
      }

      try {
        shouldAutoScrollRef.current = true;
        openingChatIdRef.current = chatId;

        const normalizedChat = normalizeChat(chat);

        setActiveChat(normalizedChat);
        setOpeningChatId(chatId);
        setLoadingMessages(true);
        setError("");
        setMenuMessageId("");

        const res = await apiRequest.get(`/chats/${chatId}`);

        const responseChat = normalizeChat(res.data);

        const loadedMessages = Array.isArray(res.data?.messages)
          ? res.data.messages
              .map((message) => normalizeMessage(message, chatId))
              .filter(Boolean)
          : [];

        const fullChat = normalizeChat({
          ...normalizedChat,
          ...responseChat,
          receiver: getReceiver(normalizedChat) || getReceiver(responseChat),
        });

        setActiveChat(fullChat);
        setMessages(loadedMessages);
        mergeChatIntoList(fullChat);

        await markChatAsRead(chatId);
      } catch (err) {
        console.log("OPEN CHAT ERROR:", err);
        setError(err.response?.data?.message || t("chatPage.errors.openChat"));
      } finally {
        openingChatIdRef.current = "";
        setLoadingMessages(false);
        setOpeningChatId("");
      }
    },
    [currentUserId, getReceiver, markChatAsRead, mergeChatIntoList, t]
  );

  const fetchChats = useCallback(async () => {
    if (!currentUserId) {
      return;
    }

    try {
      setLoadingChats(true);
      setError("");

      const res = await apiRequest.get("/chats");

      const chatList = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.chats)
        ? res.data.chats
        : [];

      setChats(chatList.map((chat) => normalizeChat(chat)).filter(Boolean));
    } catch (err) {
      console.log("LOAD CHATS ERROR:", err);
      setError(err.response?.data?.message || t("chatPage.errors.loadChats"));
    } finally {
      setLoadingChats(false);
    }
  }, [currentUserId, t]);

  const fetchUsers = useCallback(async () => {
    if (!currentUserId) {
      return;
    }

    try {
      setLoadingUsers(true);

      const res = await apiRequest.get("/users?role=AGENT");

      const userList = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.users)
        ? res.data.users
        : [];

      const uniqueUsersMap = new Map();

      userList.forEach((user) => {
        const normalizedUser = normalizeUser(user);
        const userId = getUserId(normalizedUser);

        if (userId && userId !== currentUserId && isAgentUser(normalizedUser)) {
          uniqueUsersMap.set(userId, normalizedUser);
        }
      });

      setUsers(Array.from(uniqueUsersMap.values()));
    } catch (err) {
      console.log("LOAD USERS ERROR:", err);
      setError(err.response?.data?.message || t("chatPage.errors.loadUsers"));
    } finally {
      setLoadingUsers(false);
    }
  }, [currentUserId, t]);

  useEffect(() => {
    if (!currentUserId) {
      navigate("/login");
      return;
    }

    fetchChats();
    fetchUsers();
  }, [currentUserId, navigate, fetchChats, fetchUsers]);

  useEffect(() => {
    if (!socket || !currentUserId) {
      return undefined;
    }

    const receiveMessage = async (data) => {
      const normalizedMessage = normalizeMessage(data);
      const incomingChatId = normalizeId(normalizedMessage?.chatId);
      const incomingMessageId = getMessageId(normalizedMessage);

      if (!incomingChatId) {
        return;
      }

      const processKey =
        incomingMessageId ||
        `${incomingChatId}-${normalizedMessage.senderId}-${normalizedMessage.text}-${normalizedMessage.createdAt}`;

      if (processedSocketMessagesRef.current.has(processKey)) {
        return;
      }

      processedSocketMessagesRef.current.add(processKey);

      let fetchedChat = null;

      try {
        const chatRes = await apiRequest.get(`/chats/${incomingChatId}`);
        fetchedChat = normalizeChat(chatRes.data);
      } catch (err) {
        console.log("FETCH REALTIME CHAT ERROR:", err);
      }

      if (fetchedChat?.id) {
        mergeChatIntoList(fetchedChat, normalizedMessage);
      } else {
        mergeChatIntoList({ id: incomingChatId }, normalizedMessage);
      }

      const activeChatId = activeChatIdRef.current;

      if (activeChatId === incomingChatId) {
        shouldAutoScrollRef.current = true;

        setMessages((prev) => {
          const exists = prev.some((message) => {
            const prevId = getMessageId(message);
            const nextId = getMessageId(normalizedMessage);

            return prevId && nextId && prevId === nextId;
          });

          if (exists) {
            return prev;
          }

          return [...prev, normalizedMessage];
        });

        await markChatAsRead(incomingChatId);
        return;
      }
    };

    socket.on("getMessage", receiveMessage);

    const receiveDeletedMessage = (payload) => {
      const incomingChatId = normalizeId(payload?.chatId);
      const incomingMessageId = normalizeId(payload?.messageId);
      const scope = String(payload?.scope || "").toLowerCase();

      if (!incomingMessageId) {
        return;
      }

      if (incomingChatId && incomingChatId !== activeChatIdRef.current) {
        return;
      }

      if (scope === "me") {
        setMessages((prev) =>
          prev.filter((message) => getMessageId(message) !== incomingMessageId)
        );
        return;
      }

      if (scope === "everyone") {
        setMessages((prev) =>
          prev.map((message) =>
            getMessageId(message) === incomingMessageId
              ? normalizeMessage({
                  ...message,
                  deletedForEveryone: true,
                  text: "",
                  image: null,
                  mediaUrl: null,
                  mediaKind: "deleted",
                  mediaName: null,
                })
              : message
          )
        );
      }
    };

    socket.on("messageDeleted", receiveDeletedMessage);

    return () => {
      socket.off("getMessage", receiveMessage);
      socket.off("messageDeleted", receiveDeletedMessage);
    };
  }, [socket, currentUserId, markChatAsRead, mergeChatIntoList]);

  useEffect(() => {
    const openSelectedChat = async () => {
      if (!selectedChatId || !currentUserId) {
        return;
      }

      const openKey = `${selectedChatId}-${openChatNow || "default"}`;

      if (lastSelectedOpenKeyRef.current === openKey) {
        return;
      }

      try {
        shouldAutoScrollRef.current = true;
        setError("");

        let selectedChat = chatsRef.current.find((chat) => {
          return getChatId(chat) === selectedChatId;
        });

        if (!selectedChat) {
          const res = await apiRequest.get(`/chats/${selectedChatId}`);
          selectedChat = normalizeChat(res.data);
        }

        if (selectedChat?.id) {
          await handleOpenChat(selectedChat);
          lastSelectedOpenKeyRef.current = openKey;
        }
      } catch (err) {
        console.log("AUTO OPEN SELECTED CHAT ERROR:", err);
        setError(
          err.response?.data?.message || t("chatPage.errors.openSelectedChat")
        );
      }
    };

    openSelectedChat();
  }, [selectedChatId, openChatNow, currentUserId, handleOpenChat, t]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const findExistingChatWithUser = useCallback(
    (userId) => {
      const normalizedUserId = normalizeId(userId);

      return chatsRef.current.find((chat) => {
        if (chat?.propertyId) {
          return false;
        }

        const receivers = getReceivers(chat);

        return (
          receivers.length === 1 &&
          getUserId(receivers[0]) === normalizedUserId
        );
      });
    },
    [getReceivers]
  );

  const handleStartConversation = async (user) => {
    const userId = getUserId(user);

    if (!user || !userId || !currentUserId || startingChatUserId === userId) {
      return;
    }

    if (userId === currentUserId) {
      return;
    }

    try {
      setStartingChatUserId(userId);
      setError("");
      shouldAutoScrollRef.current = true;

      const existingChat = findExistingChatWithUser(userId);

      if (existingChat) {
        setShowUserPicker(false);
        setUserSearch("");
        await handleOpenChat(existingChat);
        return;
      }

      const res = await apiRequest.post("/chats", {
        receiverId: userId,
        userId,
      });

      const createdChat = normalizeChat(res.data?.chat || res.data);

      if (!createdChat?.id) {
        throw new Error(t("chatPage.errors.chatNotCreated"));
      }

      const createdReceiver = normalizeUser(createdChat.receiver);

      const chatToOpen = normalizeChat({
        ...createdChat,
        receiver:
          getUserId(createdReceiver) &&
          getUserId(createdReceiver) !== currentUserId
            ? createdReceiver
            : normalizeUser(user),
        users: createdChat.users || [
          normalizeUser(currentUser),
          normalizeUser(user),
        ],
        userIDs: createdChat.userIDs || [currentUserId, userId],
        seenBy: createdChat.seenBy || [currentUserId],
      });

      mergeChatIntoList(chatToOpen);

      setShowUserPicker(false);
      setUserSearch("");
      await handleOpenChat(chatToOpen);
    } catch (err) {
      console.log("START CHAT ERROR:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          t("chatPage.errors.startConversation")
      );
    } finally {
      setStartingChatUserId("");
    }
  };

const appendLocalMessage = (activeChatId, newMessage, previewText) => {
  setMessages((prev) => {
    const exists = prev.some((message) => {
      const prevId = getMessageId(message);
      const nextId = getMessageId(newMessage);
      return prevId && nextId && prevId === nextId;
    });

    if (exists) {
      return prev;
    }

    return [...prev, newMessage];
  });

  mergeChatIntoList(
    normalizeChat({
      ...activeChat,
      lastMessage: previewText,
      updatedAt: newMessage.createdAt || new Date().toISOString(),
      seenBy: [currentUserId],
    }),
    newMessage
  );
};

const clearVoiceDraft = () => {
  if (voiceDraftUrlRef.current) {
    URL.revokeObjectURL(voiceDraftUrlRef.current);
    voiceDraftUrlRef.current = "";
  }
  setVoiceDraft(null);
};

const stopRecordStream = () => {
  recordStreamRef.current?.getTracks().forEach((track) => track.stop());
  recordStreamRef.current = null;
};

const resetVoiceSession = () => {
  voiceActionRef.current = "discard";
  const recorder = mediaRecorderRef.current;
  if (recorder && recorder.state !== "inactive") {
    try {
      recorder.stop();
    } catch (err) {
      console.log("VOICE STOP ERROR:", err);
    }
  }
  mediaRecorderRef.current = null;
  audioChunksRef.current = [];
  stopRecordStream();
  setRecording(false);
  setRecordSeconds(0);
  clearVoiceDraft();
};

const handleSendMessage = async (e) => {
  e.preventDefault();

  if (voiceDraft) {
    await handleSendVoiceDraft();
    return;
  }

  const text = messageText.trim();
  const activeChatId = getChatId(activeChat);

  if (!text || !activeChat || !activeChatId || sending || !currentUserId) {
    return;
  }

  try {
    setSending(true);
    setError("");
    setMessageText("");
    shouldAutoScrollRef.current = true;

    const res = await apiRequest.post("/messages", {
      chatId: activeChatId,
      text,
    });

    const newMessage = normalizeMessage(
      {
        ...res.data,
        chatId: res.data?.chatId || activeChatId,
      },
      activeChatId,
      currentUserId
    );

    appendLocalMessage(activeChatId, newMessage, text);
  } catch (err) {
    console.log("SEND MESSAGE ERROR:", err);
    setError(err.response?.data?.message || t("chatPage.errors.sendMessage"));
    setMessageText(text);
  } finally {
    setSending(false);
  }
};

const handleSendMedia = async (file, mediaKind, caption = "") => {
  const activeChatId = getChatId(activeChat);

  if (!file || !activeChat || !activeChatId || sending || !currentUserId) {
    return;
  }

  try {
    setSending(true);
    setError("");
    shouldAutoScrollRef.current = true;

    const formData = new FormData();
    formData.append("chatId", activeChatId);
    formData.append("mediaKind", mediaKind);
    formData.append("file", file);
    if (caption.trim()) {
      formData.append("text", caption.trim());
    }

    const res = await apiRequest.post("/messages", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    const newMessage = normalizeMessage(
      {
        ...res.data,
        chatId: res.data?.chatId || activeChatId,
      },
      activeChatId,
      currentUserId
    );

    const preview =
      mediaKind === "voice"
        ? "Voice note"
        : mediaKind === "file"
        ? `File: ${file.name || "attachment"}`
        : "Image";

    appendLocalMessage(activeChatId, newMessage, caption.trim() || preview);
    setMessageText("");
    return true;
  } catch (err) {
    console.log("SEND MEDIA ERROR:", err);
    setError(err.response?.data?.message || t("chatPage.errors.sendAttachment"));
    return false;
  } finally {
    setSending(false);
  }
};

const handleSendVoiceDraft = async () => {
  if (!voiceDraft?.blob || sending) {
    return;
  }

  const file = new File([voiceDraft.blob], `voice-${Date.now()}.webm`, {
    type: "audio/webm",
  });

  const sent = await handleSendMedia(file, "voice");
  if (sent) {
    clearVoiceDraft();
  }
};

const handleClearChat = async () => {
  const activeChatId = getChatId(activeChat);
  if (!activeChatId || clearing) return;

  const confirmed = window.confirm(t("chatPage.confirms.clearChat"));
  if (!confirmed) return;

  try {
    setClearing(true);
    setError("");
    await apiRequest.post(`/chats/${activeChatId}/clear`);
    setMessages([]);
    mergeChatIntoList(
      normalizeChat({
        ...activeChat,
        lastMessage: "",
        messages: [],
      })
    );
  } catch (err) {
    setError(err.response?.data?.message || t("chatPage.errors.clearChat"));
  } finally {
    setClearing(false);
  }
};

const handleDeleteMessage = async (message, scope) => {
  const messageId = getMessageId(message);
  const activeChatId = getChatId(activeChat);

  if (!messageId || !activeChatId || deletingMessageId) {
    return;
  }

  if (scope === "everyone") {
    const confirmed = window.confirm(
      t("chatPage.confirms.deleteForEveryone")
    );
    if (!confirmed) {
      return;
    }
  }

  try {
    setDeletingMessageId(messageId);
    setError("");

    await apiRequest.delete(`/chats/${activeChatId}/messages/${messageId}`, {
      params: { scope },
    });

    if (scope === "me") {
      setMessages((prev) =>
        prev.filter((item) => getMessageId(item) !== messageId)
      );
    } else {
      setMessages((prev) =>
        prev.map((item) =>
          getMessageId(item) === messageId
            ? normalizeMessage({
                ...item,
                deletedForEveryone: true,
                text: "",
                image: null,
                mediaUrl: null,
                mediaKind: "deleted",
                mediaName: null,
              })
            : item
        )
      );
    }

    setMenuMessageId("");
  } catch (err) {
    setError(err.response?.data?.message || t("chatPage.errors.deleteMessage"));
  } finally {
    setDeletingMessageId("");
  }
};

const handlePickAttachment = () => {
  fileInputRef.current?.click();
};

const handleAttachmentSelected = async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;

  const mime = String(file.type || "").toLowerCase();
  let kind = "file";
  if (mime.startsWith("image/")) kind = "image";
  if (mime.startsWith("audio/")) kind = "voice";

  await handleSendMedia(file, kind);
};

const startVoiceRecording = async () => {
  if (recording || sending || voiceDraft) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    const mimeType = pickVoiceRecorderType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    audioChunksRef.current = [];
    mediaRecorderRef.current = recorder;
    recordStreamRef.current = stream;
    voiceActionRef.current = "preview";

    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recordStreamRef.current = null;
      mediaRecorderRef.current = null;

      const action = voiceActionRef.current;
      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];

      if (action !== "preview") {
        return;
      }

      const blob = new Blob(chunks, {
        type: mimeType || recorder.mimeType || "audio/webm",
      });

      if (!blob.size) {
        setError(t("chatPage.errors.voiceTooShort"));
        return;
      }

      if (voiceDraftUrlRef.current) {
        URL.revokeObjectURL(voiceDraftUrlRef.current);
      }

      const url = URL.createObjectURL(blob);
      voiceDraftUrlRef.current = url;
      setVoiceDraft({
        url,
        blob,
        duration: Math.max(recordSecondsRef.current, 1),
      });
    };

    recorder.start();
    setRecording(true);
    setRecordSeconds(0);
    recordSecondsRef.current = 0;
    setError("");
  } catch (err) {
    console.log("VOICE RECORD ERROR:", err);
    stopRecordStream();
    setError(t("chatPage.errors.microphone"));
  }
};

const stopVoiceRecording = () => {
  const tooShort = recordSecondsRef.current < 1;
  voiceActionRef.current = tooShort ? "discard" : "preview";
  const recorder = mediaRecorderRef.current;
  if (!recorder || recorder.state === "inactive") {
    setRecording(false);
    if (tooShort) {
      setError(t("chatPage.errors.voiceTooShort"));
    }
    return;
  }
  recorder.stop();
  setRecording(false);
  if (tooShort) {
    setError(t("chatPage.errors.voiceTooShort"));
  }
};

const cancelVoiceRecording = () => {
  voiceActionRef.current = "discard";
  const recorder = mediaRecorderRef.current;
  if (recorder && recorder.state !== "inactive") {
    try {
      recorder.stop();
    } catch (err) {
      console.log("VOICE CANCEL ERROR:", err);
    }
  } else {
    stopRecordStream();
    mediaRecorderRef.current = null;
  }
  audioChunksRef.current = [];
  setRecording(false);
  setRecordSeconds(0);
};

const discardVoiceDraft = () => {
  if (recording) {
    cancelVoiceRecording();
  }
  clearVoiceDraft();
};

useEffect(() => {
  if (!recording) {
    return undefined;
  }

  recordSecondsRef.current = 0;
  setRecordSeconds(0);
  const started = Date.now();
  const timer = setInterval(() => {
    const secs = Math.floor((Date.now() - started) / 1000);
    recordSecondsRef.current = secs;
    setRecordSeconds(secs);
    if (secs < MAX_VOICE_SECONDS) {
      return;
    }
    voiceActionRef.current = "preview";
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    setRecording(false);
  }, 200);

  return () => clearInterval(timer);
}, [recording]);

  const closeActiveChat = () => {
    resetVoiceSession();
    setActiveChat(null);
    setMessages([]);
    setMessageText("");
  };

  const activeReceivers = getReceivers(activeChat);
  const activeReceiver =
    activeReceivers.find((user) => isAgentUser(user)) ||
    activeReceivers[0] ||
    getReceiver(activeChat);
  const activeChatTitle = getChatTitle(activeChat);
  const isGroupChat = activeReceivers.length > 1;

  return (
    <main className="chatPage pageFade">
      <section className="chatHero">
        <div>
          <p className="chatEyebrow">{t("chatPage.hero.badge")}</p>
          <h1>{t("chatPage.hero.title")}</h1>
          <p>{t("chatPage.hero.description")}</p>
        </div>
      </section>

      <div className="chatStats">
        <div>
          <span>{t("chatPage.hero.totalConversations")}</span>
          <strong>{chats.length}</strong>
        </div>
        <div>
          <span>{t("chatPage.hero.unreadChats")}</span>
          <strong>{unreadCount}</strong>
        </div>
      </div>

      {error && <div className="chatError">{error}</div>}

      <section className={activeChat ? "chatShell hasActiveChat" : "chatShell"}>
        <aside className="chatSidebar">
          <div className="sidebarHeader">
            <div>
              <span>{t("chatPage.sidebar.badge")}</span>
              <h2>{t("chatPage.sidebar.title")}</h2>
            </div>

            <strong>{filteredChats.length}</strong>
          </div>

          <div className="startConversationBox">
            <button
              type="button"
              className="startConversationBtn"
              onClick={() => {
                setShowUserPicker((prev) => !prev);

                if (!showUserPicker && users.length === 0) {
                  fetchUsers();
                }
              }}
            >
              <span>+</span>
              {t("chatPage.sidebar.startNewConversation")}
            </button>

            {showUserPicker && (
              <div className="userPickerPanel">
                <div className="userPickerHeader">
                  <div>
                    <strong>{t("chatPage.userPicker.title")}</strong>
                    <p>{t("chatPage.userPicker.description")}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserPicker(false);
                      setUserSearch("");
                    }}
                  >
                    ×
                  </button>
                </div>

                <input
                  className="userPickerSearch"
                  type="text"
                  placeholder={t("chatPage.userPicker.searchPlaceholder")}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  autoFocus
                />

                <div className="userPickerList">
                  {loadingUsers ? (
                    <div className="userPickerState">
                      {t("chatPage.userPicker.loading")}
                    </div>
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => {
                      const userId = getUserId(user);
                      const existingChat = findExistingChatWithUser(userId);

                      return (
                        <button
                          type="button"
                          className="userPickerItem"
                          key={userId}
                          disabled={startingChatUserId === userId}
                          onClick={() => handleStartConversation(user)}
                        >
                          <img
                            src={getImageUrl(getPersonAvatar(user))}
                            alt={getPersonName(user, t("chatPage.fallback.user"))}
                            onError={(e) => {
                              e.currentTarget.src = "/no-avatar.png";
                            }}
                          />

                          <div>
                            <strong>
                              {getPersonName(user, t("chatPage.fallback.user"))}
                            </strong>
                            <p>
                              {user.agentProfile?.agencyName ||
                                user.username ||
                                t("chatPage.fallback.user")}
                            </p>
                          </div>

                          <span>
                            {startingChatUserId === userId
                              ? t("chatPage.userPicker.opening")
                              : existingChat
                              ? t("chatPage.userPicker.open")
                              : t("chatPage.userPicker.new")}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="userPickerState">
                      {t("chatPage.userPicker.noUsers")}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="chatSearchBox">
            <input
              type="text"
              placeholder={t("chatPage.sidebar.searchPlaceholder")}
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
            />
          </div>

          {loadingChats ? (
            <div className="chatSkeletonList">
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          ) : filteredChats.length > 0 ? (
            <div className="chatList">
              {filteredChats.map((chat) => {
                const chatId = getChatId(chat);
                const receivers = getReceivers(chat);
                const receiver =
                  receivers.find((user) => isAgentUser(user)) ||
                  receivers[0] ||
                  getReceiver(chat);
                const unread = isUnread(chat);
                const active = getChatId(activeChat) === chatId;

                return (
                  <button
                    type="button"
                    key={chatId}
                    className={
                      active
                        ? "chatListItem active"
                        : unread
                        ? "chatListItem unread"
                        : "chatListItem"
                    }
                    onClick={() => handleOpenChat(chat)}
                    disabled={openingChatId === chatId}
                  >
                    <img
                      src={getImageUrl(getPersonAvatar(receiver))}
                      alt={getChatTitle(chat)}
                      onError={(e) => {
                        e.currentTarget.src = "/no-avatar.png";
                      }}
                    />

                    <div className="chatListInfo">
                      <div className="chatListTop">
                        <h3>
                          {getChatTitle(chat)}
                        </h3>

                        {unread && <span className="unreadDot"></span>}
                      </div>

                      <p>
                        {chat.lastMessage || t("chatPage.sidebar.noMessagesYet")}
                      </p>

                      {(chat.updatedAt || chat.createdAt) && (
                        <small>
                          {formatDate(chat.updatedAt || chat.createdAt)}
                        </small>
                      )}
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

              <h3>{t("chatPage.emptyChats.title")}</h3>

              <p>{t("chatPage.emptyChats.message")}</p>
            </div>
          )}
        </aside>

        <section className="chatMain">
          {activeChat ? (
            <>
              <div className="chatTopBar">
                <div className="receiverInfo">
                  <button
                    type="button"
                    className="backToInboxBtn"
                    onClick={closeActiveChat}
                  >
                    {t("chatPage.chatMain.backToInbox")}
                  </button>
                  <img
                    src={getImageUrl(getPersonAvatar(activeReceiver))}
                    alt={activeChatTitle || t("chatPage.fallback.receiver")}
                    onError={(e) => {
                      e.currentTarget.src = "/no-avatar.png";
                    }}
                  />

                  <div>
                    <h2>
                      {activeChatTitle || t("chatPage.fallback.user")}
                    </h2>

                    <p>
                      {isGroupChat
                        ? t("chatPage.fallback.listingInquiry", {
                            defaultValue: "Listing inquiry",
                          })
                        : t("chatPage.chatMain.activeConversation")}
                    </p>
                  </div>
                </div>

                <div className="chatTopActions">
                  <button
                    type="button"
                    className="clearChatBtn"
                    onClick={handleClearChat}
                    disabled={clearing || sending}
                  >
                    {clearing
                      ? t("chatPage.chatMain.clearing")
                      : t("chatPage.chatMain.clearChat")}
                  </button>
                  <span className="chatStatusPill">
                    {t("chatPage.chatMain.secureChat")}
                  </span>
                </div>
              </div>

              <div
                className="messagesBox"
                ref={messagesBoxRef}
                onScroll={handleMessagesScroll}
              >
                {loadingMessages ? (
                  <div className="messagesLoading">
                    {t("chatPage.chatMain.loadingMessages")}
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((message, index) => {
                const senderId = normalizeId(getMessageSenderId(message));

const loggedUserId = getLoggedUserIdFromChat(activeChat, currentUserId);

const ownMessage =
  senderId &&
  loggedUserId &&
  senderId === loggedUserId;

                    const senderUser =
                      message.sender ||
                      message.user ||
                      (Array.isArray(activeChat?.users)
                        ? activeChat.users.find(
                            (user) => getUserId(user) === senderId
                          )
                        : null);
                    const senderName = getPersonName(
                      senderUser,
                      t("chatPage.fallback.user")
                    );

                    const deletedForEveryone =
                      Boolean(message.deletedForEveryone) ||
                      message.mediaKind === "deleted";
                    const hasText = !deletedForEveryone && Boolean(message.text);
                    const hasImage =
                      !deletedForEveryone &&
                      message.mediaKind === "image" &&
                      Boolean(
                        resolveMediaUrl(message.mediaUrl || message.image)
                      );
                    const hasVoice =
                      !deletedForEveryone &&
                      message.mediaKind === "voice" &&
                      Boolean(resolveMediaUrl(message.mediaUrl));
                    const hasFile =
                      !deletedForEveryone &&
                      message.mediaKind === "file" &&
                      Boolean(resolveMediaUrl(message.mediaUrl));
                    const mediaOnly =
                      !deletedForEveryone &&
                      !hasText &&
                      (hasImage || hasVoice || hasFile);
                    const canDeleteEveryone =
                      (ownMessage ||
                        String(currentUser?.role || "").toUpperCase() ===
                          "ADMIN") &&
                      !deletedForEveryone;
                    const messageId = getMessageId(message);
                    const menuOpen = menuMessageId === messageId;
                    const bubbleClass = [
                      "messageBubble",
                      ownMessage ? "own" : "",
                      hasVoice ? "voice" : "",
                      hasImage ? "image" : "",
                      deletedForEveryone ? "deleted" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <div
                        className={bubbleClass}
                        key={
                          messageId ||
                          `${message.createdAt || "message"}-${index}`
                        }
                      >
                        <div
                          className={
                            mediaOnly
                              ? "messageContent mediaOnly"
                              : "messageContent"
                          }
                        >
                          <div className="messageTools">
                            <button
                              type="button"
                              className="messageMenuBtn"
                              disabled={deletingMessageId === messageId}
                              onClick={(event) => {
                                event.stopPropagation();
                                setMenuMessageId((prev) =>
                                  prev === messageId ? "" : messageId
                                );
                              }}
                              aria-label={t("chatPage.chatMain.deleteMessage")}
                            >
                              ⋮
                            </button>

                            {menuOpen && (
                              <div
                                className="messageMenu"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  disabled={deletingMessageId === messageId}
                                  onClick={() =>
                                    handleDeleteMessage(message, "me")
                                  }
                                >
                                  {t("chatPage.chatMain.deleteForMe")}
                                </button>
                                {canDeleteEveryone && (
                                  <button
                                    type="button"
                                    disabled={deletingMessageId === messageId}
                                    onClick={() =>
                                      handleDeleteMessage(message, "everyone")
                                    }
                                  >
                                    {t("chatPage.chatMain.deleteForEveryone")}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {!ownMessage && isGroupChat ? (
                            <small className="messageSender">{senderName}</small>
                          ) : null}

                          {deletedForEveryone ? (
                            <p className="messageDeleted">
                              {t("chatPage.chatMain.messageDeleted")}
                            </p>
                          ) : null}

                          {hasText ? (
                            <p className="messageText">
                              {renderSafeMessageText(message.text).map(
                                (part, partIndex) =>
                                  part.type === "link" ? (
                                    <a
                                      key={`${part.href}-${partIndex}`}
                                      href={part.href}
                                      target="_blank"
                                      rel="noopener noreferrer nofollow"
                                    >
                                      {part.value}
                                    </a>
                                  ) : (
                                    <span key={`t-${partIndex}`}>
                                      {part.value}
                                    </span>
                                  )
                              )}
                            </p>
                          ) : null}

                          {hasImage && (
                              <a
                                href={resolveMediaUrl(
                                  message.mediaUrl || message.image
                                )}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="messageMediaImageWrap"
                              >
                                <img
                                  src={resolveMediaUrl(
                                    message.mediaUrl || message.image
                                  )}
                                  alt={message.mediaName || "Image"}
                                  className="messageMediaImage"
                                />
                              </a>
                            )}

                          {hasVoice && (
                            <VoiceNotePlayer
                              key={message.id || message.mediaUrl}
                              src={resolveMediaUrl(message.mediaUrl)}
                              label={t("chatPage.chatMain.voiceNote")}
                            />
                          )}

                          {hasFile && (
                              <a
                                className="messageFileLink"
                                href={resolveMediaUrl(message.mediaUrl)}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                              >
                                <span className="fileGlyph" aria-hidden="true">
                                  📄
                                </span>
                                <span>
                                  {message.mediaName ||
                                    t("chatPage.chatMain.downloadFile")}
                                </span>
                              </a>
                            )}

                          <span className="messageTime">
                            {formatTime(message.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="emptyMessages">
                    <span>
                      <ChatIcon />
                    </span>

                    <h3>{t("chatPage.emptyMessages.title")}</h3>

                    <p>{t("chatPage.emptyMessages.message")}</p>
                  </div>
                )}
              </div>

              <form
                className={`messageForm ${
                  recording ? "isRecording" : ""
                } ${voiceDraft ? "isVoicePreview" : ""}`}
                onSubmit={handleSendMessage}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hiddenFileInput"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,audio/*"
                  onChange={handleAttachmentSelected}
                />

                {recording ? (
                  <>
                    <button
                      type="button"
                      className="voiceComposerBtn trash"
                      onClick={cancelVoiceRecording}
                      title={t("chatPage.chatMain.deleteVoice")}
                    >
                      <TrashIcon />
                    </button>
                    <div className="voiceRecordStatus">
                      <span className="voiceRecordDot" />
                      <strong>{formatVoiceClock(recordSeconds)}</strong>
                      <div className="voiceLiveWave" aria-hidden="true">
                        {VOICE_BARS.slice(0, 16).map((height, index) => (
                          <span
                            key={`live-${index}`}
                            style={{
                              height: `${Math.max(8, height * 0.7)}px`,
                              animationDelay: `${index * 0.05}s`,
                            }}
                          />
                        ))}
                      </div>
                      <em>{t("chatPage.chatMain.recording")}</em>
                    </div>
                    <button
                      type="button"
                      className="voiceComposerBtn stop"
                      onClick={stopVoiceRecording}
                      title={t("chatPage.chatMain.stopRecording")}
                    >
                      <StopIcon />
                    </button>
                  </>
                ) : voiceDraft ? (
                  <>
                    <button
                      type="button"
                      className="voiceComposerBtn trash"
                      onClick={discardVoiceDraft}
                      disabled={sending}
                      title={t("chatPage.chatMain.deleteVoice")}
                    >
                      <TrashIcon />
                    </button>
                    <div className="voiceDraftPreview">
                      <VoiceNotePlayer
                        key={voiceDraft.url}
                        src={voiceDraft.url}
                        label={t("chatPage.chatMain.voiceNote")}
                      />
                    </div>
                    <button
                      type="submit"
                      className="voiceComposerBtn send"
                      disabled={sending}
                      title={t("chatPage.chatMain.sendVoice")}
                    >
                      {sending ? "…" : <SendIcon />}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="mediaActionBtn"
                      onClick={handlePickAttachment}
                      disabled={sending}
                      title={t("chatPage.chatMain.attach")}
                    >
                      📎
                    </button>

                    <input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder={t("chatPage.chatMain.messagePlaceholder")}
                      disabled={sending}
                    />

                    {messageText.trim() ? (
                      <button type="submit" disabled={sending}>
                        {sending
                          ? t("chatPage.chatMain.sending")
                          : t("chatPage.chatMain.send")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="voiceComposerBtn mic"
                        onClick={startVoiceRecording}
                        disabled={sending}
                        title={t("chatPage.chatMain.recordVoice")}
                      >
                        <MicIcon />
                      </button>
                    )}
                  </>
                )}
              </form>
            </>
          ) : (
            <div className="noChatSelected">
              <span>
                <ChatIcon />
              </span>

              <h2>{t("chatPage.noChat.title")}</h2>

              <p>{t("chatPage.noChat.message")}</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default ChatPage;