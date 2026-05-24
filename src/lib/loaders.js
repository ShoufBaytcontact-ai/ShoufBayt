import { defer } from "react-router-dom";
import apiRequest from "./apiRequest";

export const singlePageLoader = async ({ params }) => {
  const id = params.id;

  if (!id) {
    throw new Response("Post ID is missing", { status: 400 });
  }

  try {
    const res = await apiRequest.get(`/posts/${id}`);
    return res.data;
  } catch (err) {
    console.log("Single page loader error:", err);

    throw new Response(err.response?.data?.message || "Failed to load post", {
      status: err.response?.status || 500,
    });
  }
};

export const listPageLoader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.toString();

    const res = await apiRequest.get(query ? `/posts?${query}` : "/posts");

    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.log("List page loader error:", err);

    return [];
  }
};

export const profilePageLoader = () => {
  const postResponse = apiRequest.get("/users/profile/posts").catch((err) => {
    console.log("PROFILE POSTS ERROR STATUS:", err.response?.status);
    console.log("PROFILE POSTS ERROR DATA:", err.response?.data);
    return { data: [] };
  });

  const chatResponse = apiRequest.get("/chats").catch((err) => {
    console.log("CHAT ERROR STATUS:", err.response?.status);
    console.log("CHAT ERROR DATA:", err.response?.data);
    return { data: [] };
  });

  return defer({
    postResponse,
    chatResponse,
  });
};