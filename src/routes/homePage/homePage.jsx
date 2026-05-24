import { useContext } from "react";
import { Link } from "react-router-dom";
import "./homepage.scss";
import SearchBar from "../../components/searchBar/searchBar";
import SmartSearchAssistant from "../../components/smartSearchAssistant/smartSearchAssistant";
import { AuthContext } from "../../context/AuthContext";

function HomePage() {
  const { currentUser } = useContext(AuthContext);

  return (
    <div className="homepage pageFade">
      <div className="textContainer">
        <div className="wrapper">
          <div className="heroBadge">
            <span>SmartEstate</span>
            <p>Find • Compare • Connect</p>
          </div>

          <h1 className="title">Your Smart Way to Discover Real Estate</h1>

          <p className="subtitle">
            Search for apartments, houses, and lands in a simple professional
            way. SmartEstate helps buyers, renters, owners, and agents connect
            faster with trusted property tools.
          </p>

          {currentUser && (
            <div className="welcomeBox">
              Welcome back, <b>{currentUser.username || "User"}</b>
            </div>
          )}

          <div className="searchWrapper">
            <SearchBar />
          </div>

          <div className="smartSearchWrapper">
            <SmartSearchAssistant />
          </div>

          <div className="heroActions">
            <Link to="/list" className="primaryBtn">
              Explore Properties
            </Link>

            <Link to="/agents" className="secondaryBtn">
              Contact Agents
            </Link>
          </div>

          <div className="boxes">
            <div className="box">
              <h1>1200+</h1>
              <h2>Listed Properties</h2>
            </div>

            <div className="box">
              <h1>500+</h1>
              <h2>Happy Clients</h2>
            </div>

            <div className="box">
              <h1>24/7</h1>
              <h2>Smart Support</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="visualContainer">
        <div className="realEstateVisual">
          <div className="visualHeader">
            <span>Real Estate Market</span>
            <b>Live Platform</b>
          </div>

          <div className="buildingScene">
            <div className="building small">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <div className="building tall">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>

            <div className="building medium">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>

          <div className="floatingSearchCard">
            <h3>Smart Search</h3>
            <p>Find the right property by city, price, type, and location.</p>
          </div>

          <div className="floatingStatsCard">
            <h3>98%</h3>
            <p>User Satisfaction</p>
          </div>

          <div className="miniCards">
            <div className="miniCard">
              <span>01</span>

              <div>
                <b>Apartments</b>
                <p>Modern city homes</p>
              </div>
            </div>

            <div className="miniCard">
              <span>02</span>

              <div>
                <b>Houses</b>
                <p>Family properties</p>
              </div>
            </div>

            <div className="miniCard">
              <span>03</span>

              <div>
                <b>Map Search</b>
                <p>Choose exact location</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;