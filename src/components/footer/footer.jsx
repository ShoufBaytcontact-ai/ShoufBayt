import { Link } from "react-router-dom";
import "./footer.scss";

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footerContainer">
        <div className="footerBrand">
          <Link to="/" className="footerLogo">
            <div className="footerLogoIcon">
              <span className="roof"></span>
              <span className="tower"></span>
              <span className="door"></span>
            </div>

            <div className="footerLogoText">
              <span>SmartEstate</span>
              <small>Real Estate Platform</small>
            </div>
          </Link>

          <p>
            SmartEstate is a modern real estate platform built to help users
            discover, save, post, and manage properties with a clean and
            professional experience.
          </p>

          <div className="footerSocials">
            <a href="https://www.facebook.com/" target="_blank" rel="noreferrer">
              Facebook
            </a>

            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
              Instagram
            </a>

            <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </div>
        </div>

        <div className="footerColumn">
          <h3>Explore</h3>
          <Link to="/">Home</Link>
          <Link to="/list">Properties</Link>
          <Link to="/agents">Agents</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Support</Link>
        </div>

        <div className="footerColumn">
          <h3>Account</h3>
          <Link to="/profile">My Profile</Link>
          <Link to="/newPostPage">Create Listing</Link>
          <Link to="/profile/update">Update Profile</Link>
          <Link to="/chat">Messages</Link>
          <Link to="/login">Login</Link>
        </div>

        <div className="footerContact">
          <h3>Contact Info</h3>

          <div className="contactItem">
            <span>Email</span>
            <p>support@smartestate.com</p>
          </div>

          <div className="contactItem">
            <span>Location</span>
            <p>Beirut, Lebanon</p>
          </div>

          <div className="contactItem">
            <span>Working Hours</span>
            <p>Monday - Saturday, 9:00 AM - 6:00 PM</p>
          </div>
        </div>
      </div>

      <div className="footerBottom">
        <p>© {year} SmartEstate. All rights reserved.</p>

        <div>
          <Link to="/about">Privacy Policy</Link>
          <Link to="/contact">Support</Link>
        </div>
      </div>
    </footer>
  );
}

export default Footer;