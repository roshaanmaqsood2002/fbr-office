import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

type IconName = "dashboard" | "clients" | "team" | "settings";

const icons: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  clients: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-1a6 6 0 0 1 12 0v1M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4.58V20" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" />
    </>
  ),
};

function NavIcon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icons[name]}
    </svg>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const canManageTeam = user?.role === "owner" || user?.role === "admin";

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `group flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition ${
      isActive
        ? "bg-white text-fbr-green shadow-sm"
        : "text-white/75 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <div className="min-h-screen md:flex">
      <aside className="flex w-full shrink-0 flex-col bg-fbr-green text-white md:sticky md:top-0 md:h-screen md:w-64">
        <div className="flex items-center gap-3 px-5 py-5 md:px-6 md:py-7">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-fbr-gold/50 bg-white/10 font-serif text-xl text-fbr-gold shadow-inner">
            F
          </div>
          <div className="min-w-0">
            <div className="truncate font-semibold tracking-wide">
              {user?.firmName || "FBR Office"}
            </div>
            <div className="mt-0.5 text-xs text-white/55">Tax workspace</div>
          </div>
        </div>

        <div className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40 md:px-6 md:pt-3">
          Workspace
        </div>
        <nav
          aria-label="Main navigation"
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-1 md:px-4"
        >
          <NavLink to="/" end className={navClass}>
            <NavIcon name="dashboard" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/businesses" className={navClass}>
            <NavIcon name="clients" />
            <span>Clients</span>
          </NavLink>
          {canManageTeam && (
            <NavLink to="/team" className={navClass}>
              <NavIcon name="team" />
              <span>Team</span>
            </NavLink>
          )}
          {user?.role === "owner" && (
            <NavLink to="/settings" className={navClass}>
              <NavIcon name="settings" />
              <span>Settings</span>
            </NavLink>
          )}
        </nav>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/10 px-4 py-4 md:block md:px-5 md:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-fbr-gold/20 text-sm font-semibold text-fbr-gold">
              {user?.name?.slice(0, 1).toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user?.name}</div>
              <div className="mt-0.5 text-xs capitalize text-white/55">
                {user?.role}
              </div>
            </div>
          </div>
          <button
            className="rounded-lg px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white md:mt-4 md:w-full md:border md:border-white/15 md:text-left"
            onClick={async () => {
              await logout();
              toast.success("Logged out");
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="animate-fade-in mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-7 sm:py-8 lg:px-10 lg:py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
