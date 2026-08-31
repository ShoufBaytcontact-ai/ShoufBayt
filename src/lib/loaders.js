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
    if (err.response?.status === 404) {
      return null;
    }

    throw new Response(err.response?.data?.message || "Failed to load post", {
      status: err.response?.status || 500,
    });
  }
};

export const listPageLoader = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.searchParams);

    params.set("limit", "10");

    if (!params.get("page")) {
      params.set("page", "1");
    }

    const res = await apiRequest.get(`/posts?${params.toString()}`);
    const payload = res.data;
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.properties)
            ? payload.properties
            : [];

    return {
      items,
      pagination: payload?.pagination || {
        page: Number(params.get("page")) || 1,
        limit: Number(params.get("limit")) || 10,
        total: items.length,
        totalPages: 1,
      },
    };
  } catch (err) {
    throw new Response(
      err.response?.data?.message || "Failed to load properties",
      {
        status: err.response?.status || 500,
      }
    );
  }
};

export const accountListingsLoader = () => {
  const postResponse = apiRequest.get("/users/profile/posts").catch(() => {
    return { data: { userPosts: [], savedPosts: [] } };
  });

  return defer({
    postResponse,
  });
};