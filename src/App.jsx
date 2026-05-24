import { createBrowserRouter, RouterProvider } from "react-router-dom";

import Layout, { RequireAuth } from "./routes/layout/layout";
import HomePage from "./routes/homePage/homePage";
import ListPage from "./routes/listPage/listpage";
import SinglePage from "./routes/singlePage/singlePage";
import Register from "./routes/register/register";
import Login from "./routes/login/login";
import NewPostPage from "./routes/newPostPage/newPostPage";
import Profilepage from "./routes/profilepage/profilepage";
import ProfileUpdatePage from "./routes/profileupdatepage/profileupdatepage";
import AboutPage from "./routes/aboutpage/aboutpage";
import ContactPage from "./routes/contactpage/contactpage";
import AgentPage from "./routes/agentpage/agentpage";
import AgentDetailsPage from "./routes/agentDetailsPage/agentDetailsPage";
import AdminPage from "./routes/adminpage/adminPage";
import EditPostPage from "./routes/editPostPage/editPostPage";
import ChatPage from "./routes/chatPage/chatPage";
import {
  listPageLoader,
  singlePageLoader,
  profilePageLoader,
} from "./lib/loaders";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <h1>Something went wrong!</h1>,
    children: [
      {
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/home",
        element: <HomePage />,
      },
      {
        path: "/list",
        element: <ListPage />,
        loader: listPageLoader,
      },
      {
        path: "/properties/:id",
        element: <SinglePage />,
        loader: singlePageLoader,
        errorElement: <h1>Post not found!</h1>,
      },
      {
        path: "/register",
        element: <Register />,
      },
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/about",
        element: <AboutPage />,
      },
      {
        path: "/contact",
        element: <ContactPage />,
      },
      {
        path: "/agents",
        element: <AgentPage />,
      },
      {
        path: "/agents/:id",
        element: <AgentDetailsPage />,
      },
    ],
  },
  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        path: "/profile",
        element: <Profilepage />,
        loader: profilePageLoader,
      },
      {
        path: "/newPostPage",
        element: <NewPostPage />,
      },
      {
        path: "/profile/update",
        element: <ProfileUpdatePage />,
      },
      {
        path: "/posts/edit/:id",
        element: <EditPostPage />,
        loader: singlePageLoader,
        errorElement: <h1>Post not found!</h1>,
      },
      {
        path: "/admin",
        element: <AdminPage />,
      },
      {
  path: "/chat",
  element: <ChatPage />,
},
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;