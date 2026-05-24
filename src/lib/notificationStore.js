import { create } from "zustand";
import apiRequest from "./apiRequest";

export const useNotificationStore = create((set) => ({
  number: 0,

  fetch: async () => {
    try {
      const res = await apiRequest.get("/users/notifications");
      set({ number: res.data });
    } catch (err) {
      console.log(err);
    }
  },

  increase: () =>
    set((prev) => ({
      number: prev.number + 1,
    })),

  decrease: () =>
    set((prev) => ({
      number: prev.number > 0 ? prev.number - 1 : 0,
    })),

  reset: () => set({ number: 0 }),
}));  