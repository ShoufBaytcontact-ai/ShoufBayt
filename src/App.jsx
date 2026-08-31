import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Layout, { RequireAuth } from "./routes/layout/layout";
import HomePage from "./routes/homePage/homePage";
import ListPage from "./routes/listPage/listpage";
import SinglePage from "./routes/singlePage/singlePage";
import VerifyPhonePage from "./routes/verifyPhonePage/verifyPhonePage";
import Register from "./routes/register/register";
import Login from "./routes/login/login";
import ForgotPasswordPage from "./routes/forgotPasswordPage/forgotPasswordPage";
import NewPostPage from "./routes/newPostPage/newPostPage";
import Profilepage from "./routes/profilepage/profilepage";
import ProfileUpdatePage from "./routes/profileupdatepage/profileupdatepage";
import AccountListingsPage from "./routes/accountListingsPage/accountListingsPage";
import OffersPage from "./routes/offersPage/offersPage";
import LivePage from "./routes/livePage/livePage";
import AboutPage from "./routes/aboutpage/aboutpage";
import ContactPage from "./routes/contactpage/contactpage";
import AgentPage from "./routes/agentpage/agentpage";
import AgentDetailsPage from "./routes/agentDetailsPage/agentDetailsPage";
import AdminPage from "./routes/adminpage/adminPage";
import EditPostPage from "./routes/editPostPage/editPostPage";
import ChatPage from "./routes/chatPage/chatPage";
import BillingPage from "./routes/billingPage/billingPage";
import NotificationsPage from "./routes/notificationsPage/notificationsPage";
import RequestListingPage from "./routes/requestListingPage/requestListingPage";
import ListingRequestSinglePage from "./routes/listingRequestSinglePage/listingRequestSinglePage";
import AgentDashboardPage from "./routes/agentDashboardPage/agentDashboardPage";
import OwnerDashboardPage from "./routes/ownerDashboardPage/ownerDashboardPage";

import {
  listPageLoader,
  singlePageLoader,
  accountListingsLoader,
} from "./lib/loaders";

function RouteError({ type = "general" }) {
  const { t } = useTranslation();

  return (
    <div className="routeError">
      <h1>{type === "post" ? t("app.postNotFound") : t("app.generalError")}</h1>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "home",
        element: <HomePage />,
      },
      {
        path: "list",
        element: <ListPage />,
        loader: listPageLoader,
        errorElement: <RouteError type="general" />,
      },
      {
        path: "properties/:id",
        element: <SinglePage />,
        loader: singlePageLoader,
        errorElement: <RouteError type="post" />,
      },
      {
        path: "about",
        element: <AboutPage />,
      },
      {
        path: "live",
        element: <LivePage />,
      },
      {
        path: "contact",
        element: <ContactPage />,
      },
      {
        path: "agents",
        element: <AgentPage />,
      },
      {
        path: "agents/:id",
        element: <AgentDetailsPage />,
      },
      {
        path: "register",
        element: <Register />,
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "forgot-password",
        element: <ForgotPasswordPage />,
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: "profile",
            element: <Profilepage />,
          },
          {
            path: "verify-phone",
            element: <VerifyPhonePage />,
          },
          {
            path: "my-homes",
            element: <AccountListingsPage />,
            loader: accountListingsLoader,
          },
          {
            path: "saved",
            element: <AccountListingsPage />,
            loader: accountListingsLoader,
          },
          {
            path: "offers",
            element: <OffersPage />,
          },
          {
            path: "profile/update",
            element: <ProfileUpdatePage />,
          },
          {
            path: "newPostPage",
            element: <NewPostPage />,
          },
          {
            path: "posts/edit/:id",
            element: <EditPostPage />,
            loader: singlePageLoader,
            errorElement: <RouteError type="post" />,
          },
          {
            path: "admin",
            element: <AdminPage />,
          },
          {
            path: "chat",
            element: <ChatPage />,
          },
          {
            path: "chat/:chatId",
            element: <ChatPage />,
          },
          {
            path: "billing",
            element: <BillingPage />,
          },
          {
            path: "subscription",
            element: <BillingPage />,
          },
          {
            path: "notifications",
            element: <NotificationsPage />,
          },
          {
            path: "request-listing",
            element: <RequestListingPage />,
          },
          {
            path: "listing-requests/:id",
            element: <ListingRequestSinglePage />,
          },
          {
            path: "agent",
            element: <AgentDashboardPage />,
          },
          {
            path: "owner",
            element: <OwnerDashboardPage />,
          },
        ],
      },
      {
        path: ":id",
        element: <SinglePage />,
        loader: singlePageLoader,
        errorElement: <RouteError type="post" />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;