import { Suspense, useContext, useEffect, useState } from "react";
import { Await, Link, useLoaderData, useNavigate } from "react-router-dom";
import "./profilepage.scss";
import ProfilePostCard from "../../components/profilePostCard/profilePostCard";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";

function ProfilePage() {
  const data = useLoaderData();
  const navigate = useNavigate();
  const { currentUser, updateUser } = useContext(AuthContext);

  const [activeTab, setActiveTab] = useState("myPosts");

  const userName = currentUser?.username || "User";
  const userEmail = currentUser?.email || "No email";
  const userAvatar = currentUser?.avatar || "/no-avatar.png";
  const userRole = currentUser?.role || "USER";

  const handleLogout = async () => {
    try {
      await apiRequest.post("/auth/logout");
      updateUser(null);
      navigate("/login");
    } catch (err) {
      console.log("LOGOUT ERROR:", err);
      alert(err.response?.data?.message || "Failed to logout.");
    }
  };

  if (!currentUser) {
    return (
      <div className="profilePage pageFade">
        <div className="profileStateBox">
          <h2>Loading Profile...</h2>
          <p>Please wait while we prepare your account information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profilePage pageFade">
      <section className="profileHero">
        <div className="profileUserCard">
          <div className="profileAvatarBox">
            <img
              src={userAvatar}
              alt={userName}
              onError={(e) => {
                e.currentTarget.src = "/no-avatar.png";
              }}
            />

            <span>{userRole}</span>
          </div>

          <div className="profileUserInfo">
            <span className="profileBadge">My Account</span>

            <h1>{userName}</h1>

            <p>{userEmail}</p>

            <div className="profileActions">
              <Link to="/profile/update" className="editBtn">
                Update Profile
              </Link>

              <button type="button" onClick={handleLogout} className="logoutBtn">
                Logout
              </button>
            </div>
          </div>
        </div>

        <Suspense fallback={<ProfileStatsSkeleton />}>
          <Await
            resolve={data?.postResponse}
            errorElement={<ProfileStatsFallback />}
          >
            {(postResponse) => {
              const userPosts = getUserPosts(postResponse);
              const savedPosts = getSavedPosts(postResponse);

              return (
                <div className="profileStats">
                  <div className="statCard">
                    <strong>{userPosts.length}</strong>
                    <span>My Posts</span>
                    <p>Properties you created</p>
                  </div>

                  <div className="statCard">
                    <strong>{savedPosts.length}</strong>
                    <span>Saved Posts</span>
                    <p>Your favorite properties</p>
                  </div>

                  <div className="statCard">
                    <strong>{userRole}</strong>
                    <span>Account Role</span>
                    <p>Your current permission</p>
                  </div>
                </div>
              );
            }}
          </Await>
        </Suspense>
      </section>

      <div className="profileContent">
        <main className="profileMain">
          <div className="profileSectionHeader">
            <div>
              <span>Property Dashboard</span>

              <h2>Property Management</h2>

              <p>
                Manage your created listings and saved properties from one place.
              </p>
            </div>

            <Link to="/newPostPage" className="createBtn">
              Add New Property
            </Link>
          </div>

          <div className="profileTabs">
            <button
              type="button"
              className={
                activeTab === "myPosts" ? "profileTab active" : "profileTab"
              }
              onClick={() => setActiveTab("myPosts")}
            >
              My Posts
            </button>

            <button
              type="button"
              className={
                activeTab === "savedPosts" ? "profileTab active" : "profileTab"
              }
              onClick={() => setActiveTab("savedPosts")}
            >
              Saved Posts
            </button>
          </div>

          <Suspense fallback={<LoadingCards />}>
            <Await
              resolve={data?.postResponse}
              errorElement={
                <div className="errorBox">
                  Failed to load your properties.
                </div>
              }
            >
              {(postResponse) => (
                <ProfilePostsSection
                  postResponse={postResponse}
                  activeTab={activeTab}
                />
              )}
            </Await>
          </Suspense>
        </main>

        <aside className="profileSide">
          <div className="messagesBox">
            <div className="sideHeader">
              <div>
                <span>Inbox</span>

                <h2>Messages</h2>
              </div>

              <Link to="/chat">View All</Link>
            </div>

            <Suspense fallback={<p className="loadingText">Loading messages...</p>}>
              <Await
                resolve={data?.chatResponse}
                errorElement={
                  <p className="errorText">Failed to load messages.</p>
                }
              >
                {(chatResponse) => (
                  <MessagesPreview
                    chatResponse={chatResponse}
                    currentUser={currentUser}
                  />
                )}
              </Await>
            </Suspense>
          </div>

          <div className="quickActionsBox">
            <h2>Quick Actions</h2>

            <Link to="/list">Browse Properties</Link>
            <Link to="/agents">Find Agents</Link>
            <Link to="/contact">Contact Support</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProfilePostsSection({ postResponse, activeTab }) {
  const initialMyPosts = getUserPosts(postResponse);
  const initialSavedPosts = getSavedPosts(postResponse);

  const [myPosts, setMyPosts] = useState(initialMyPosts);
  const [savedPosts, setSavedPosts] = useState(initialSavedPosts);
  const [selectedPost, setSelectedPost] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setMyPosts(initialMyPosts);
    setSavedPosts(initialSavedPosts);
  }, [postResponse]);

  const postsToShow = activeTab === "myPosts" ? myPosts : savedPosts;

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
      alert("Could not find this property.");
      return;
    }

    try {
      setIsDeleting(true);

      await apiRequest.delete(`/posts/${postId}`);

      setMyPosts((prev) => prev.filter((post) => post.id !== postId));
      setSelectedPost(null);
    } catch (err) {
      console.log("DELETE PROPERTY ERROR:", err);
      alert(err.response?.data?.message || "Failed to delete property.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="profilePosts">
        {postsToShow.length > 0 ? (
          postsToShow.map((post) => (
            <ProfilePostCard
              item={post}
              key={post.id || post.postId}
              showActions={activeTab === "myPosts"}
              onDelete={() => setSelectedPost(post)}
              onStatusUpdated={handleStatusUpdated}
            />
          ))
        ) : (
          <div className="emptyBox">
            <h3>No properties found</h3>

            <p>
              {activeTab === "myPosts"
                ? "You did not add any property yet."
                : "You did not save any property yet."}
            </p>

            {activeTab === "myPosts" ? (
              <Link to="/newPostPage">Create Your First Property</Link>
            ) : (
              <Link to="/list">Explore Properties</Link>
            )}
          </div>
        )}
      </div>

      {selectedPost && (
        <div className="deleteModalOverlay">
          <div className="deleteModal">
            <span>Confirm Action</span>

            <h2>Delete Property?</h2>

            <p>
              Are you sure you want to delete{" "}
              <b>{selectedPost.title || selectedPost.post?.title || "this property"}</b>?
            </p>

            <div className="deleteModalActions">
              <button
                type="button"
                className="cancelDeleteBtn"
                onClick={() => setSelectedPost(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="confirmDeleteBtn"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MessagesPreview({ chatResponse, currentUser }) {
  const chats = Array.isArray(chatResponse?.data) ? chatResponse.data : [];

  if (chats.length === 0) {
    return (
      <div className="emptyMessage">
        <h3>No messages</h3>
        <p>Your conversations will appear here.</p>
      </div>
    );
  }

  return (
    <div className="messageList">
      {chats.slice(0, 4).map((chat) => {
        const receiver =
          chat.receiver ||
          chat.users?.find((user) => user.id !== currentUser?.id);

        return (
          <Link
            to="/chat"
            state={{ chatId: chat.id }}
            className="messageItem"
            key={chat.id}
          >
            <img
              src={receiver?.avatar || "/no-avatar.png"}
              alt={receiver?.username || "User"}
              onError={(e) => {
                e.currentTarget.src = "/no-avatar.png";
              }}
            />

            <div>
              <h4>{receiver?.username || "User"}</h4>
              <p>{chat.lastMessage || "No message yet"}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function getUserPosts(postResponse) {
  return Array.isArray(postResponse?.data?.userPosts)
    ? postResponse.data.userPosts
    : [];
}

function getSavedPosts(postResponse) {
  const savedPosts = Array.isArray(postResponse?.data?.savedPosts)
    ? postResponse.data.savedPosts
    : [];

  return savedPosts.map((item) => item?.post || item).filter(Boolean);
}

function LoadingCards() {
  return (
    <div className="loadingCards">
      <div className="loadingCard"></div>
      <div className="loadingCard"></div>
      <div className="loadingCard"></div>
    </div>
  );
}

function ProfileStatsSkeleton() {
  return (
    <div className="profileStats">
      <div className="statCard skeleton"></div>
      <div className="statCard skeleton"></div>
      <div className="statCard skeleton"></div>
    </div>
  );
}

function ProfileStatsFallback() {
  return (
    <div className="profileStats">
      <div className="statCard">
        <strong>--</strong>
        <span>Stats</span>
        <p>Failed to load profile stats</p>
      </div>
    </div>
  );
}

export default ProfilePage;