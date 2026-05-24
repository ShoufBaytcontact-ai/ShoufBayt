import { Link } from "react-router-dom";
import "./aboutpage.scss";

const stats = [
  {
    value: "1200+",
    label: "Listings",
  },
  {
    value: "500+",
    label: "Clients",
  },
];

const missionCards = [
  {
    number: "01",
    title: "Our Mission",
    text: "Our mission is to simplify the real estate experience. We help users search, compare, save, and manage property listings without wasting time or effort.",
  },
  {
    number: "02",
    title: "Our Vision",
    text: "We aim to create a trusted digital space where property owners, agents, renters, and buyers can connect clearly and professionally.",
  },
];

const features = [
  {
    number: "01",
    title: "Property Listings",
    text: "Browse houses, apartments, and lands with complete details, images, prices, and ownership information.",
  },
  {
    number: "02",
    title: "Map Location",
    text: "View property locations directly on an interactive map to understand the area better.",
  },
  {
    number: "03",
    title: "Saved Properties",
    text: "Save your favorite properties and return to them anytime from your profile page.",
  },
  {
    number: "04",
    title: "Real-Time Chat",
    text: "Communicate easily with owners, agents, or interested users through the chat system.",
  },
  {
    number: "05",
    title: "Smart AI Tools",
    text: "Generate professional property descriptions and help admins reply faster to user messages and reports.",
  },
  {
    number: "06",
    title: "Reports Tracking",
    text: "Users can send reports, check their status, and view admin replies directly from the contact page.",
  },
];

function AboutPage() {
  return (
    <div className="aboutPage pageFade">
      <section className="aboutHero">
        <div className="heroContent">
          <span className="heroBadge">About SmartEstate</span>

          <h1>Building a Smarter Real Estate Experience</h1>

          <p>
            SmartEstate is a modern real estate platform designed to make buying,
            renting, posting, and managing properties easier, faster, and more
            organized.
          </p>

          <div className="heroActions">
            <Link to="/list">Explore Properties</Link>

            <Link to="/contact" className="secondaryBtn">
              Contact Us
            </Link>
          </div>
        </div>

        <div className="heroVisual">
          <div className="visualCard mainCard">
            <span>SmartEstate</span>
            <h3>Find your next property with confidence.</h3>
          </div>

          <div className="visualGrid">
            {stats.map((item) => (
              <div key={item.label}>
                <strong>{item.value}</strong>
                <p>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="aboutContent">
        <div className="sectionIntro">
          <span>Our Platform</span>

          <h2>Who We Are</h2>

          <p>
            SmartEstate helps users discover properties with clear information,
            high-quality images, prices, locations, and important details. Our
            platform connects buyers, renters, owners, and agents in one simple
            and user-friendly website.
          </p>
        </div>

        <div className="missionGrid">
          {missionCards.map((card) => (
            <div className="missionCard" key={card.number}>
              <span>{card.number}</span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </div>
          ))}
        </div>

        <div className="featuresSection">
          <div className="sectionHeader">
            <span>Features</span>

            <h2>What SmartEstate Offers</h2>

            <p>
              Everything needed to explore, manage, and communicate about real
              estate listings in one modern platform.
            </p>
          </div>

          <div className="features">
            {features.map((feature) => (
              <div className="featureBox" key={feature.number}>
                <div className="featureIcon">{feature.number}</div>

                <h3>{feature.title}</h3>

                <p>{feature.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="whyChoose">
          <div>
            <span>Why Choose Us?</span>

            <h2>A Complete Real Estate Solution</h2>
          </div>

          <p>
            SmartEstate brings everything into one place. Users can explore
            listings, check property details, save posts, create new posts,
            update profiles, contact agents, track reports, and communicate with
            others. The website is built to be clean, simple, and useful for
            anyone looking for real estate solutions.
          </p>
        </div>
      </section>
    </div>
  );
}

export default AboutPage;