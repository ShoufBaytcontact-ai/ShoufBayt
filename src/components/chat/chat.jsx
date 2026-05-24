import { useState, useContext, useEffect, useRef } from "react";
import "./chat.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import { SocketContext } from "../../context/SocketContext.jsx";
import { useNotificationStore } from "../../lib/notificationStore.js";

function Chat({ chats = [] }) {
  const [chat, setChat] = useState(null);
  const [text, setText] = useState("");

  const { currentUser } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const messageEndRef = useRef(null);
  const decrease = useNotificationStore((state) => state.decrease);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  const handleOpenChat = async (id, receiver) => {
    try {
      const res = await apiRequest.get("/chats/" + id);

      if (!res.data.seenBy?.includes(currentUser?.id)) {
        decrease();
      }

      setChat({ ...res.data, receiver });
    } catch (err) {
      console.log(err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!text.trim() || !chat) {
      return;
    }

    try {
      const res = await apiRequest.post("/messages", {
        chatId: chat.id,
        text,
      });

      setChat((prev) => ({
        ...prev,
        messages: [...(prev.messages || []), res.data],
        lastMessage: text,
      }));

      socket?.emit("newMessage", {
        data: res.data,
        receiverId: chat.receiver?.id,
      });

      setText("");
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    if (!socket || !chat) {
      return;
    }

    const readChat = async () => {
      try {
        await apiRequest.put("/chats/read/" + chat.id);
      } catch (err) {
        console.log(err);
      }
    };

    const handleGetMessage = (data) => {
      if (data.chatId === chat.id) {
        setChat((prev) => ({
          ...prev,
          messages: [...(prev.messages || []), data],
        }));

        readChat();
      }
    };

    socket.on("getMessage", handleGetMessage);

    return () => {
      socket.off("getMessage", handleGetMessage);
    };
  }, [socket, chat]);

  return (
    <div className="chat">
      <div className="messages">
        <h1>Messages</h1>

        {chats.length === 0 && <p>No messages yet.</p>}

        {chats.map((c) => (
          <div
            className="message"
            key={c.id}
            onClick={() => handleOpenChat(c.id, c.receiver)}
            style={{
              backgroundColor:
                c.seenBy?.includes(currentUser?.id) || c.id === chat?.id
                  ? "white"
                  : "#fece51",
            }}
          >
            <img
              src={c.receiver?.avatar || "/no-avatar.png"}
              alt="User avatar"
            />

            <span>{c.receiver?.username || "Unknown User"}</span>

            <p>{c.lastMessage || "No messages yet"}</p>
          </div>
        ))}
      </div>

      {chat && (
        <div className="chatbox">
          <div className="top">
            <div className="user">
              <img
                src={chat.receiver?.avatar || "/no-avatar.png"}
                alt="User avatar"
              />

              <span>{chat.receiver?.username || "Unknown User"}</span>
            </div>

            <div className="close" onClick={() => setChat(null)}>
              X
            </div>
          </div>

          <div className="center">
            {chat.messages?.length === 0 && <p>No messages yet.</p>}

            {chat.messages?.map((message) => (
              <div
                className={
                  message.userId === currentUser?.id
                    ? "chatMessage own"
                    : "chatMessage"
                }
                key={message.id}
              >
                <p>{message.text}</p>
                <span>{new Date(message.createdAt).toLocaleString()}</span>
              </div>
            ))}

            <div ref={messageEndRef}></div>
          </div>

          <form className="bottom" onSubmit={handleSendMessage}>
            <textarea
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            ></textarea>

            <button type="submit">Send</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Chat;