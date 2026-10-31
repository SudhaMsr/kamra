import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/ui";
import { RouterProvider, match, useLocation } from "./lib/router";
import { useThemeSync } from "./lib/theme";
import { Flatmates } from "./pages/Flatmates";
import { Home } from "./pages/Home";
import { ListingPage } from "./pages/Listing";
import { MyRooms, Saved, Visits } from "./pages/Lists";
import { Messages } from "./pages/Messages";
import { PostRoom } from "./pages/PostRoom";
import { ProfilePage } from "./pages/Profile";
import { Search } from "./pages/Search";
import { NotFoundPage, Safety } from "./pages/Static";

function Routes() {
  const { path } = useLocation();
  let m: Record<string, string> | null;
  if (path === "/") return <Home />;
  if (path === "/search") return <Search />;
  if ((m = match("/rooms/:id", path))) return <ListingPage key={m.id} id={m.id} />;
  if (path === "/post") return <PostRoom />;
  if (path === "/my-rooms") return <MyRooms />;
  if (path === "/flatmates") return <Flatmates />;
  if (path === "/messages") return <Messages />;
  if ((m = match("/messages/:id", path))) return <Messages threadId={m.id} />;
  if (path === "/saved") return <Saved />;
  if (path === "/visits") return <Visits />;
  if (path === "/profile") return <ProfilePage />;
  if (path === "/safety") return <Safety />;
  return <NotFoundPage />;
}

/** Catches render errors so one broken page never blanks the whole site. */
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Kamra crashed:", error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="wrap grid max-w-xl gap-4 py-16">
        <h1 className="text-3xl font-extrabold">Something went wrong on this page</h1>
        <p className="text-muted">Your data is safe. Go back to the home page and try again.</p>
        <a href="#/" className="btn-primary justify-self-start" onClick={() => this.setState({ error: null })}>Go home</a>
      </div>
    );
  }
}

function App() {
  useThemeSync();
  const { path } = useLocation();
  return (
    <ToastProvider>
      <Layout>
        <Boundary key={path}><Routes /></Boundary>
      </Layout>
    </ToastProvider>
  );
}

const el = document.getElementById("root");
if (el) createRoot(el).render(<StrictMode><RouterProvider><App /></RouterProvider></StrictMode>);
