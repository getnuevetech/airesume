import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { Footer } from "./Footer";
import { GoogleModal } from "./GoogleModal";
import { Header } from "./Header";

export function Layout() {
  const { pathname } = useLocation();
  const { toast } = useApp();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <Header />
      <main className="page" id="main">
        <Outlet />
      </main>
      <Footer />
      <GoogleModal />
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}
