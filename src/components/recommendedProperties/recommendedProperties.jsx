import { useEffect, useMemo, useState } from "react";
import "./recommendedProperties.scss";
import apiRequest from "../../lib/apiRequest";
import Card from "../card/card";

function RecommendedProperties({ currentPost }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentPostId = currentPost?.id;

  useEffect(() => {
    const fetchRecommendedPosts = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await apiRequest.get("/posts");

        const data = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.posts)
          ? res.data.posts
          : [];

        setPosts(data);
      } catch (err) {
        console.log("RECOMMENDED PROPERTIES ERROR:", err);
        setError("Failed to load recommended properties.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendedPosts();
  }, []);

  const recommendedPosts = useMemo(() => {
    if (!currentPost || posts.length === 0) {
      return [];
    }

    const currentPrice = Number(currentPost.price) || 0;
    const currentBedroom = Number(currentPost.bedroom) || 0;

    const scoredPosts = posts
      .filter((post) => post?.id !== currentPostId)
      .map((post) => {
        let score = 0;

        if (
          post.city &&
          currentPost.city &&
          post.city.toLowerCase() === currentPost.city.toLowerCase()
        ) {
          score += 35;
        }

        if (post.property && post.property === currentPost.property) {
          score += 25;
        }

        if (post.type && post.type === currentPost.type) {
          score += 20;
        }

        const postPrice = Number(post.price) || 0;

        if (currentPrice > 0 && postPrice > 0) {
          const priceDifference = Math.abs(postPrice - currentPrice);
          const pricePercent = priceDifference / currentPrice;

          if (pricePercent <= 0.15) {
            score += 20;
          } else if (pricePercent <= 0.3) {
            score += 12;
          } else if (pricePercent <= 0.5) {
            score += 6;
          }
        }

        const postBedroom = Number(post.bedroom) || 0;

        if (currentBedroom > 0 && postBedroom > 0) {
          if (postBedroom === currentBedroom) {
            score += 10;
          } else if (Math.abs(postBedroom - currentBedroom) === 1) {
            score += 5;
          }
        }

        return {
          ...post,
          recommendationScore: score,
        };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore);

    const strongMatches = scoredPosts.filter(
      (post) => post.recommendationScore > 0
    );

    const fallbackPosts = scoredPosts.filter(
      (post) => post.recommendationScore === 0
    );

    return [...strongMatches, ...fallbackPosts].slice(0, 3);
  }, [posts, currentPost, currentPostId]);

  if (!currentPost) {
    return null;
  }

  return (
    <section className="recommendedProperties">
      <div className="recommendedHeader">
        <div>
          <span>Smart Recommendations</span>
          <h2>Recommended Properties</h2>
          <p>
            SmartEstate suggests similar listings based on city, type, price,
            category, and property details.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="recommendedState">
          <span></span>
          <h3>Loading Recommendations</h3>
          <p>Please wait while we find similar properties.</p>
        </div>
      ) : error ? (
        <div className="recommendedState errorState">
          <h3>Recommendations Unavailable</h3>
          <p>{error}</p>
        </div>
      ) : recommendedPosts.length === 0 ? (
        <div className="recommendedState">
          <h3>No Recommendations Yet</h3>
          <p>
            There are not enough similar properties available right now. Add
            more listings to improve recommendations.
          </p>
        </div>
      ) : (
        <div className="recommendedGrid">
          {recommendedPosts.map((post) => (
            <Card item={post} key={post.id} />
          ))}
        </div>
      )}
    </section>
  );
}

export default RecommendedProperties;