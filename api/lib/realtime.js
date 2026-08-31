import { Server } from "socket.io";

let io = null;

const onlineUsers = new Map();

function normalizeId(id) {
  return String(id || "").trim();
}

function extractUserId(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "object") {
    return normalizeId(
      value.id ||
        value._id ||
        value.userId ||
        value.user?.id ||
        value.user?._id ||
        value.data?.id ||
        value.data?._id ||
        value.profile?.id ||
        value.profile?._id
    );
  }

  return normalizeId(value);
}

function addUser(userId, socketId) {
  const id = extractUserId(userId);

  if (!id || !socketId) {
    return;
  }

  const userSockets = onlineUsers.get(id) || new Set();
  userSockets.add(socketId);
  onlineUsers.set(id, userSockets);
}

function removeSocket(socketId) {
  onlineUsers.forEach((socketSet, userId) => {
    socketSet.delete(socketId);

    if (socketSet.size === 0) {
      onlineUsers.delete(userId);
    }
  });
}

function getUserSocketIds(userId) {
  const id = extractUserId(userId);
  return Array.from(onlineUsers.get(id) || []);
}

function getOnlineUsers() {
  return Array.from(onlineUsers.keys());
}

function emitOnlineUsers() {
  if (!io) return;
  io.emit("getOnlineUsers", getOnlineUsers());
}

export function emitToUser(userId, event, payload) {
  if (!io) return 0;

  const socketIds = getUserSocketIds(userId);
  socketIds.forEach((socketId) => {
    io.to(socketId).emit(event, payload);
  });
  return socketIds.length;
}

export function emitToUsers(userIds, event, payload) {
  const uniqueIds = [...new Set((userIds || []).map(extractUserId).filter(Boolean))];
  uniqueIds.forEach((userId) => emitToUser(userId, event, payload));
  return uniqueIds.length;
}

export function broadcastMessage({
  receiverId,
  receiverIds,
  senderId,
  data,
  excludeSocketId = null,
}) {
  if (!io || !data) {
    return { receiverSockets: 0, senderSockets: 0 };
  }

  const cleanSenderId = extractUserId(
    senderId || data?.senderId || data?.userId
  );
  const uniqueReceiverIds = [
    ...new Set(
      [
        ...(Array.isArray(receiverIds) ? receiverIds : []),
        receiverId,
        data?.receiverId,
      ]
        .map(extractUserId)
        .filter((id) => id && id !== cleanSenderId)
    ),
  ];

  if (!uniqueReceiverIds.length || !cleanSenderId) {
    console.log("Realtime message ignored. Missing ids:", {
      receiverId,
      receiverIds,
      senderId,
    });
    return { receiverSockets: 0, senderSockets: 0 };
  }

  const messageData = {
    ...data,
    userId: extractUserId(data.userId || cleanSenderId),
    senderId: extractUserId(data.senderId || data.userId || cleanSenderId),
    receiverId: uniqueReceiverIds[0],
    receiverIds: uniqueReceiverIds,
    chatId: normalizeId(data.chatId),
    createdAt: data.createdAt || new Date().toISOString(),
  };

  let receiverSockets = 0;

  uniqueReceiverIds.forEach((id) => {
    const socketIds = getUserSocketIds(id);
    receiverSockets += socketIds.length;
    socketIds.forEach((socketId) => {
      io.to(socketId).emit("getMessage", {
        ...messageData,
        receiverId: id,
      });
      io.to(socketId).emit("newMessage", {
        ...messageData,
        receiverId: id,
      });
    });
  });

  const senderSocketIds = getUserSocketIds(cleanSenderId);

  senderSocketIds.forEach((socketId) => {
    if (excludeSocketId && socketId === excludeSocketId) {
      return;
    }
    io.to(socketId).emit("getMessage", messageData);
    io.to(socketId).emit("newMessage", messageData);
  });

  console.log("Realtime message broadcast:", {
    receiverIds: uniqueReceiverIds,
    senderId: messageData.senderId,
    chatId: messageData.chatId,
    receiverSockets,
    senderSockets: senderSocketIds.length,
  });

  return {
    receiverSockets,
    senderSockets: senderSocketIds.length,
  };
}

export function emitNotification(userId, payload) {
  return emitToUser(userId, "getNotification", payload);
}

function handleClientSendMessage(socket, payload = {}) {
  const { receiverId, receiverIds, senderId, data } = payload || {};
  const result = broadcastMessage({
    receiverId,
    receiverIds,
    senderId,
    data,
    excludeSocketId: socket.id,
  });

  if (result.receiverSockets === 0 && data) {
    socket.emit("messageNotDelivered", {
      reason: "Receiver is not connected to socket",
      receiverId: extractUserId(receiverId || data?.receiverId),
      senderId: extractUserId(senderId || data?.senderId || data?.userId),
      chatId: normalizeId(data?.chatId),
    });
  }
}

export function initRealtime(httpServer, { clientUrls = [] } = {}) {
  const origins = clientUrls.filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: origins.length ? origins : true,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("addUser", (userId) => {
      const cleanUserId = extractUserId(userId);
      addUser(cleanUserId, socket.id);
      emitOnlineUsers();
      console.log("User added to socket:", cleanUserId, socket.id);
    });

    // Compat for older clients that still emit client-side
    socket.on("sendMessage", (payload) => {
      handleClientSendMessage(socket, payload);
    });

    socket.on("newMessage", (payload) => {
      handleClientSendMessage(socket, payload);
    });

    socket.on("disconnect", () => {
      removeSocket(socket.id);
      emitOnlineUsers();
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
}

export function getRealtimeIo() {
  return io;
}

export function getRealtimeOnlineUsers() {
  return getOnlineUsers();
}
