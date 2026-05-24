import "./listpage.scss";
import { Link, useLoaderData } from "react-router-dom";
import Card from "../../components/card/card";
import Map from "../../components/map/map";
import ListFilter from "../../components/listFilter/listFilter";
import PageState from "../../components/pageState/pageState";

function PropertyIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 21V10.5L12 4l8 6.5V21" />
      <path d="M9 21v-7h6v7" />
      <path d="M7 21h10" />
    </svg>
  );
}

function AvailableIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M20 7 10 17l-5-5" />
    </svg>
  );
}

function RentIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 7h16" />
      <path d="M6 7V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V7" />
      <path d="M6 7v13" />
      <path d="M18 7v13" />
      <path d="M9 11h6" />
      <path d="M9 15h6" />
    </svg>
  );
}

function SaleIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 2v20" />
      <path d="M17 6.5C16.2 5.4 14.5 4.7 12.5 4.7c-2.8 0-4.7 1.4-4.7 3.4 0 2.2 2.4 2.9 4.5 3.4 2.2.5 4.4 1 4.4 3.4 0 2-1.9 3.4-4.7 3.4-2.2 0-4-.8-4.9-2.1" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 21s7-5.1 7-12a7 7 0 0 0-14 0c0 6.9 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.4" />
    </svg>
  );
}

function normalizePosts(data) {
  if (Array.isArray(data)) {
    return data.map((item) => item?.post || item).filter(Boolean);
  }

  if (Array.isArray(data?.posts)) {
    return data.posts.map((item) => item?.post || item).filter(Boolean);
  }

  return [];
}

function ListPage() {
  const data = useLoaderData();
  const posts = normalizePosts(data);

  const availableCount = posts.filter((post) => {
    return (post.status || "available") === "available";
  }).length;

  const rentCount = posts.filter((post) => post.type === "rent").length;
  const saleCount = posts.filter((post) => post.type === "buy").length;

  return (
    <div className="listPage pageFade">
      <div className="listContainer">
        <div className="listHero">
          <div className="heroContent">
            <span className="heroBadge">Property Listings</span>

            <h1>Explore Available Properties</h1>

            <p>
              Browse real estate listings, compare property details, filter by
              your needs, and view each location directly on the map.
            </p>
          </div>

          <div className="heroAction">
            <Link to="/newPostPage">Create Listing</Link>
          </div>
        </div>

        <ListFilter />

        <div className="statsGrid">
          <div className="statCard">
            <span className="statIcon">
              <PropertyIcon />
            </span>

            <div>
              <strong>{posts.length}</strong>
              <p>Total Properties</p>
            </div>
          </div>

          <div className="statCard">
            <span className="statIcon">
              <AvailableIcon />
            </span>

            <div>
              <strong>{availableCount}</strong>
              <p>Available</p>
            </div>
          </div>

          <div className="statCard">
            <span className="statIcon">
              <SaleIcon />
            </span>

            <div>
              <strong>{saleCount}</strong>
              <p>For Sale</p>
            </div>
          </div>

          <div className="statCard">
            <span className="statIcon">
              <RentIcon />
            </span>

            <div>
              <strong>{rentCount}</strong>
              <p>For Rent</p>
            </div>
          </div>
        </div>

        <div className="wrapper">
          <div className="resultInfo">
            <div>
              <span>Search Results</span>

              <h2>
                {posts.length} Propert{posts.length === 1 ? "y" : "ies"} Found
              </h2>

              <p>
                {posts.length > 0
                  ? "Choose a property to view full details, location, images, and owner information."
                  : "Try changing your filters to find more properties."}
              </p>
            </div>
          </div>

          <div className="cardsContainer">
            {posts.length > 0 ? (
              posts.map((post) => <Card key={post.id} item={post} />)
            ) : (
              <PageState
                type="empty"
                title="No Properties Found"
                message="We could not find properties matching your search. Try another city, price range, or property type."
                buttonText="Reset Search"
                buttonLink="/list"
              />
            )}
          </div>
        </div>
      </div>

      <div className="mapContainer">
        <div className="mapSticky">
          <div className="mapPanel">
            <div className="mapHeader">
              <div className="mapTitle">
                <span className="mapBadge">Interactive Map</span>

                <h2>Property Locations</h2>

                <p>
                  View all matching properties on a larger map and explore
                  nearby listing locations easily.
                </p>
              </div>

              <div className="mapIcon">
                <MapIcon />
              </div>
            </div>

            <div className="mapStats">
              <div>
                <strong>{posts.length}</strong>
                <span>Total Listings</span>
              </div>

              <div>
                <strong>{availableCount}</strong>
                <span>Available</span>
              </div>
            </div>

            <div className="mapBox">
              <div className="mapOverlayTop">
                <span>Live Property Map</span>
              </div>

              <Map items={posts} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListPage;