import { useContext, useEffect, useState } from "react";
import "./contactBoxStatus.scss";
import apiRequest from "../../lib/apiRequest";
import { AuthContext } from "../../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

function ContactStatusBox() {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getMessages = async () => {
      if (!currentUser) {
        return;
      }

      try {
        setLoading(true);
        const res = await apiRequest.get("/contact/my-messages");
        setMessages(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.log("GET MY CONTACT MESSAGES ERROR:", err);
      } finally {
        setLoading(false);
      }
    };

    getMessages();
  }, [currentUser]);

  const formatDate = (date) => {
    if (!date) {
      return "Unknown date";
    }

    return new Date(date).toLocaleDateString();
  };

  if (!currentUser) {
    return (
      <div className="contactStatusBox">
        <div className="contactStatusHeader">
          <span>Message Tracking</span>
          <h2>Review Your Reports & Messages</h2>
          <p>Login to view your submitted messages, report status, and admin replies.</p>
        </div>

        <button type="button" onClick={() => navigate("/login")}>
          Login to Track Messages
        </button>
      </div>
    );
  }

  return (
    <div className="contactStatusBox">
      <div className="contactStatusHeader">
        <span>Message Tracking</span>
        <h2>Your Reports & Messages</h2>
        <p>Track the status of your submitted messages and read admin replies.</p>
      </div>

      {loading ? (
        <div className="contactStatusState">Loading your messages...</div>
      ) : messages.length === 0 ? (
        <div className="contactStatusState">
          You have not sent any messages or reports yet.
        </div>
      ) : (
        <div className="contactStatusList">
          {messages.map((item) => (
            <div className="contactStatusCard" key={item.id}>
              <div className="statusCardTop">
                <div>
                  <span className={`statusType ${item.type?.toLowerCase()}`}>
                    {item.type}
                  </span>

                  <h3>{item.subject}</h3>

                  <p>
                    Sent on {formatDate(item.createdAt)}
                  </p>
                </div>

                <strong className={`statusBadge ${item.status?.toLowerCase()}`}>
                  {item.status}
                </strong>
              </div>

              <div className="statusMessage">
                <b>Your Message</b>
                <p>{item.message}</p>
              </div>

              {item.adminReply ? (
                <div className="adminReplyBox">
                  <b>Admin Reply</b>
                  <p>{item.adminReply}</p>
                  <span>Replied on {formatDate(item.adminRepliedAt)}</span>
                </div>
              ) : (
                <div className="noReplyBox">
                  Admin has not replied yet.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ContactStatusBox;