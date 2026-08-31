import { Suspense, useContext, useEffect, useMemo, useState } from "react";
import { Await, Link, useLoaderData, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../context/AuthContext.jsx";
import PageState from "../../components/pageState/pageState";
import ProfilePostCard from "../../components/profilePostCard/profilePostCard";
import { toUiPropertyStatus } from "../../lib/propertyStatus";
import {
  canDeleteListing,
  canEditListing,
  canManageListingStatus,
  isAgentManagedForUser,
} from "../../lib/listingAccess";
import apiRequest from "../../lib/apiRequest";
import "./accountListingsPage.scss";

function getPayload(postResponse) {
  if (postResponse?.data?.userPosts || postResponse?.data?.savedPosts) {
    return postResponse.data;
  }

  return postResponse || {};
}

function getUserPosts(postResponse) {
  const payload = getPayload(postResponse);
  return Array.isArray(payload?.userPosts) ? payload.userPosts : [];
}

function getSavedPosts(postResponse) {
  const payload = getPayload(postResponse);
  const savedPosts = Array.isArray(payload?.savedPosts)
    ? payload.savedPosts
    : [];

  return savedPosts.map((item) => item?.post || item).filter(Boolean);
}

function AccountPosts({
  postResponse,
  mode,
  isAgentOrAdmin,
  currentUserId,
  currentUserRole,
}) {
  const { t } = useTranslation();
  const [myPosts, setMyPosts] = useState(() => getUserPosts(postResponse));
  const [savedPosts, setSavedPosts] = useState(() =>
    getSavedPosts(postResponse)
  );
  const [selectedPost, setSelectedPost] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setMyPosts(getUserPosts(postResponse));
    setSavedPosts(getSavedPosts(postResponse));
  }, [postResponse]);

  const postsToShow = mode === "saved" ? savedPosts : myPosts;

  const stats = useMemo(() => {
    const listed = myPosts.length;
    const available = myPosts.filter(
      (item) => toUiPropertyStatus(item.status) === "available"
    ).length;
    const closed = myPosts.filter((item) =>
      ["sold", "rented"].includes(toUiPropertyStatus(item.status))
    ).length;

    return { listed, available, closed, saved: savedPosts.length };
  }, [myPosts, savedPosts]);

  const handleStatusUpdated = (postId, status) => {
    setMyPosts((prev) =>
      prev.map((item) => (item.id === postId ? { ...item, status } : item))
    );
  };

  const handleDelete = async () => {
    if (!selectedPost) {
      return;
    }

    const postId = selectedPost.id || selectedPost.postId;
    if (!postId) {
      alert(t("profile.delete.cannotFind"));
      return;
    }

    try {
      setIsDeleting(true);
      await apiRequest.delete(`/posts/${postId}`);
      setMyPosts((prev) => prev.filter((post) => post.id !== postId));
      setSelectedPost(null);
    } catch (err) {
      alert(err.response?.data?.message || t("profile.delete.failed"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {mode === "saved" ? (
        <section className="homesStats">
          <article>
            <small>{t("accountListings.stats.saved")}</small>
            <strong>{stats.saved}</strong>
          </article>
        </section>
      ) : (
        <section className="homesStats">
          <article>
            <small>{t("accountListings.stats.listed")}</small>
            <strong>{stats.listed}</strong>
          </article>
          <article>
            <small>{t("accountListings.stats.available")}</small>
            <strong>{stats.available}</strong>
          </article>
          <article>
            <small>{t("accountListings.stats.closed")}</small>
            <strong>{stats.closed}</strong>
          </article>
        </section>
      )}

      <div className="homesToolbar">
        <p>{t("accountListings.count", { count: postsToShow.length })}</p>
      </div>

      <div className="homesGrid">
        {postsToShow.length > 0 ? (
          postsToShow.map((post) => (
            <ProfilePostCard
              item={post}
              key={post.id || post.postId}
              canEdit={
                mode !== "saved" &&
                canEditListing(post, currentUserId, currentUserRole)
              }
              canDelete={
                mode !== "saved" &&
                canDeleteListing(post, currentUserId, currentUserRole)
              }
              canManageStatus={
                mode !== "saved" &&
                canManageListingStatus(post, currentUserId, currentUserRole)
              }
              isAgentManaged={isAgentManagedForUser(post, currentUserId)}
              currentUserId={currentUserId}
              onDelete={() => setSelectedPost(post)}
              onStatusUpdated={handleStatusUpdated}
            />
          ))
        ) : (
          <div className="homesEmpty">
            <h3>{t("profile.empty.title")}</h3>
            <p>
              {mode === "saved"
                ? t("profile.empty.noSavedPosts")
                : t(
                    isAgentOrAdmin
                      ? "profile.empty.noMyPosts"
                      : "profile.empty.noMyPostsOwner"
                  )}
            </p>
            {mode === "saved" ? (
              <Link to="/list">{t("profile.empty.exploreProperties")}</Link>
            ) : (
              <Link to={isAgentOrAdmin ? "/newPostPage" : "/request-listing"}>
                {isAgentOrAdmin
                  ? t("profile.empty.createFirst")
                  : t("profile.empty.requestFirst")}
              </Link>
            )}
          </div>
        )}
      </div>

      {selectedPost && (
        <div className="homesModalOverlay">
          <div className="homesModal">
            <span>{t("profile.delete.badge")}</span>
            <h2>{t("profile.delete.title")}</h2>
            <p>
              {t("profile.delete.question")}{" "}
              <b>
                {selectedPost.title ||
                  selectedPost.post?.title ||
                  t("profile.delete.thisProperty")}
              </b>
              ?
            </p>
            <div className="homesModalActions">
              <button
                type="button"
                className="homesGhostBtn"
                onClick={() => setSelectedPost(null)}
                disabled={isDeleting}
              >
                {t("profile.delete.cancel")}
              </button>
              <button
                type="button"
                className="homesDangerBtn"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting
                  ? t("profile.delete.deleting")
                  : t("profile.delete.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AccountListingsPage() {
  const data = useLoaderData();
  const location = useLocation();
  const { t } = useTranslation();
  const { currentUser } = useContext(AuthContext);
  const mode = location.pathname.startsWith("/saved") ? "saved" : "myPosts";
  const isAgentOrAdmin = ["AGENT", "ADMIN"].includes(
    String(currentUser?.role || "").toUpperCase()
  );

  return (
    <main className="accountListings pageFade">
      <header className="homesHero">
        <div>
          <p className="homesEyebrow">
            {mode === "saved" ? t("nav.saved") : t("nav.myHomes")}
          </p>
          <h1>
            {mode === "saved"
              ? t("accountListings.savedTitle")
              : isAgentOrAdmin
                ? t("accountListings.homesTitle")
                : t("accountListings.ownerTitle")}
          </h1>
          <span>
            {mode === "saved"
              ? t("accountListings.savedDescription")
              : isAgentOrAdmin
                ? t("accountListings.homesDescription")
                : t("accountListings.ownerDescription")}
          </span>
        </div>
        {mode !== "saved" && (
          <Link
            to={isAgentOrAdmin ? "/newPostPage" : "/request-listing"}
            className="homesPrimary"
          >
            {isAgentOrAdmin
              ? t("profile.dashboard.addNewProperty")
              : t("profile.dashboard.requestListing")}
          </Link>
        )}
      </header>

      <Suspense
        fallback={
          <PageState
            type="loading"
            title={t("pageState.loading.title")}
            message={t("pageState.loading.message")}
          />
        }
      >
        <Await
          resolve={data?.postResponse}
          errorElement={
            <div className="homesEmpty isError">
              {t("profile.errors.loadProperties")}
            </div>
          }
        >
          {(postResponse) => (
            <AccountPosts
              postResponse={postResponse}
              mode={mode}
              isAgentOrAdmin={isAgentOrAdmin}
              currentUserId={currentUser?.id}
              currentUserRole={currentUser?.role}
            />
          )}
        </Await>
      </Suspense>
    </main>
  );
}

export default AccountListingsPage;
