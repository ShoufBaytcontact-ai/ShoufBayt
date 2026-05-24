import { Server } from "socket.io";

const io = new Server({
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

let onlineUsers = [];

const addUser = (userId, socketId) => {
  const userExists = onlineUsers.some((user) => user.userId === userId);

  if (!userExists) {
    onlineUsers.push({
      userId,
      socketId,
    });
  }
};

const removeUser = (socketId) => {
  onlineUsers = onlineUsers.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
  return onlineUsers.find((user) => user.userId === userId);
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("newUser", (userId) => {
    addUser(userId, socket.id);
    console.log("Online users:", onlineUsers);
  });

  socket.on("sendMessage", ({ receiverId, data }) => {
    const receiver = getUser(receiverId);

    if (receiver) {
      io.to(receiver.socketId).emit("getMessage", data);

      io.to(receiver.socketId).emit("getNotification", {
        chatId: data.chatId,
        senderId: data.userId,
        text: data.text,
        createdAt: data.createdAt,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    removeUser(socket.id);
  });
});

io.listen(8900);