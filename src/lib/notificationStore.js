import { create } from "zustand";
import apiRequest from "./apiRequest";
import {
  countUnreadAlerts,
  parseNotificationList,
} from "./notificationMeta";

function toCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }

  return Math.min(Math.floor(n), 999);
}

function parseChats(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.chats)) return data.chats;
  return [];
}

function sumChatUnread(chats) {
  return chats.reduce(
    (sum, chat) => sum + toCount(chat?.unreadCount),
    0
  );
}

export const useNotificationStore = create((set) => ({
  number: 0,
  messages: 0,

  setNumber: (number) => set({ number: toCount(number) }),

  fetch: async () => {
    try {
      const [listRes, chatsRes] = await Promise.all([
        apiRequest.get("/notifications"),
        apiRequest.get("/chats").catch(() => ({ data: [] })),
      ]);
      const items = parseNotificationList(listRes.data);
      const chats = parseChats(chatsRes.data);

      set({
        number: countUnreadAlerts(items),
        messages: sumChatUnread(chats),
      });
    } catch (err) {
      console.log(err);
      set({ number: 0, messages: 0 });
    }
  },

  increase: () =>
    set((prev) => ({
      number: prev.number + 1,
    })),

  decrease: () =>
    set((prev) => ({
      messages: prev.messages > 0 ? prev.messages - 1 : 0,
    })),

  increaseMessages: () =>
    set((prev) => ({
      messages: prev.messages + 1,
    })),

  decreaseMessages: () =>
    set((prev) => ({
      messages: prev.messages > 0 ? prev.messages - 1 : 0,
    })),

  setMessages: (count) =>
    set({
      messages: toCount(count),
    }),

  reset: () => set({ number: 0, messages: 0 }),
}));
