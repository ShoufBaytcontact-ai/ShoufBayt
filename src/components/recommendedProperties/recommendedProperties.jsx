import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./recommendedProperties.scss";
import apiRequest from "../../lib/apiRequest";
import { citiesMatch } from "../../lib/cityMatch";
import Card from "../card/card";

const MAX_RECOMMENDED_POSTS = 3;

function getPostId(post) {
  return String(post?.id || post?._id || "");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function listingKind(post) {
  const type = normalizeText(post?.type || post?.listingType);

  if (type === "rent") return "rent";
  if (type === "buy" || type === "sale") return "buy";
  return "";
}

function unwrapPosts(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.properties)) return payload.properties;
  if (Array.isArray(payload?.posts)) return payload.posts;
  return [];
}

function RecommendedProperties({ currentPost }) {
  const { t } = useTranslation();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentPostId = getPostId(currentPost);
  const currentCity = normalizeText(currentPost?.city);
  const currentKind = listingKind(currentPost);

  useEffect(() => {
    let isMounted = true;

    const fetchRecommendedPosts = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();

        if (currentKind) {
          params.set("type", currentKind);
        }

        params.set("includeClosed", "false");
        params.set("limit", "10");

        const query = params.toString();
        const res = await apiRequest.get(query ? `/posts?${query}` : "/posts");

        if (isMounted) {
          setPosts(unwrapPosts(res.data));
        }
      } catch (err) {
        console.log("RECOMMENDED PROPERTIES ERROR:", err);

        if (isMounted) {
          setError(t("recommended.errors.failed"));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchRecommendedPosts();

    return () => {
      isMounted = false;
    };
  }, [t, currentPost?.city, currentKind]);

  const recommendedPosts = useMemo(() => {
    if (!currentPost || !currentCity || !currentKind || posts.length === 0) {
      return [];
    }

    return posts
      .filter((post) => {
        const postId = getPostId(post);

        if (!postId || postId === currentPostId) {
          return false;
        }

        if (!citiesMatch(post.city, currentPost.city)) {
          return false;
        }

        if (listingKind(post) !== currentKind) {
          return false;
        }

        const status = normalizeText(post.status);
        if (status === "sold" || status === "rented") {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, MAX_RECOMMENDED_POSTS);
  }, [posts, currentPost, currentPostId, currentKind]);

  if (!currentPost) {
    return null;
  }

  return (
    <section className="recommendedProperties">
      <div className="recommendedHeader">
        <div>
          <span>{t("recommended.header.badge")}</span>
          <h2>{t("recommended.header.title")}</h2>
          <p>{t("recommended.header.description")}</p>
        </div>
      </div>

      {loading ? (
        <div className="recommendedState">
          <span></span>
          <h3>{t("recommended.loading.title")}</h3>
          <p>{t("recommended.loading.message")}</p>
        </div>
      ) : error ? (
        <div className="recommendedState errorState">
          <h3>{t("recommended.errorState.title")}</h3>
          <p>{error}</p>
        </div>
      ) : recommendedPosts.length === 0 ? (
        <div className="recommendedState">
          <h3>{t("recommended.empty.title")}</h3>
          <p>{t("recommended.empty.message")}</p>
        </div>
      ) : (
        <div className="recommendedGrid">
          {recommendedPosts.map((post) => (
            <Card item={post} key={getPostId(post)} />
          ))}
        </div>
      )}
    </section>
  );
}

export default RecommendedProperties;
