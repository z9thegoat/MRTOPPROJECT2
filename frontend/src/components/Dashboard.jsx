// Dashboard.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./Dashboard.css";

const AVATAR_COLORS = ["blue", "teal", "purple", "amber", "coral"];

const ROLE_MAP = {
  1: { label: "User", className: "role-badge--editor" },
  2: { label: "Admin", className: "role-badge--admin" },
};

function getInitials(email) {
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function Avatar({ email, index }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  return <div className={`avatar avatar--${color}`}>{getInitials(email)}</div>;
}

function RoleBadge({ roleId }) {
  const role = ROLE_MAP[roleId] ?? {
    label: `Role ${roleId}`,
    className: "role-badge--viewer",
  };
  return <span className={`role-badge ${role.className}`}>{role.label}</span>;
}

function SearchIcon() {
  return (
    <svg
      className="dashboard__refresh-icon"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M13.5 13.5L17 17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RefreshButton({ onClick }) {
  return (
    <button className="dashboard__refresh-btn" onClick={onClick}>
      <svg
        width="25px"
        height="25px"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.793 2.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414-1.414L14.086 7H12.5C8.952 7 6 9.952 6 13.5S8.952 20 12.5 20s6.5-2.952 6.5-6.5a1 1 0 1 1 2 0c0 4.652-3.848 8.5-8.5 8.5S4 18.152 4 13.5 7.848 5 12.5 5h1.586l-1.293-1.293a1 1 0 0 1 0-1.414z"
          fill="#0D0D0D"
        />
      </svg>
    </button>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("token");

  const fetchCurrentUserRole = async () => {
    if (!token) {
      navigate("/login");
      return null;
    }

    try {
      const res = await axios.get("http://localhost:3000/users/verify", {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log(res.data.role);
      return res.data.role;
    } catch (err) {
      console.error(err);
      navigate("/login");
      return null;
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://localhost:3000/users/getAllUsers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const role = await fetchCurrentUserRole();
      if (role !== "admin") {
        alert("Access denied. Admins only.");
        navigate("/home");
        return;
      }
      fetchUsers();
    };
    init();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await axios.delete(`http://localhost:3000/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("User deleted!");
      fetchUsers();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete user");
    }
  };

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div className="dashboard__title-block">
          <p className="dashboard__label">Admin Panel</p>
          <h2 className="dashboard__title">User Management</h2>
        </div>
        <div className="dashboard__header-actions">
          <span className="dashboard__count">
            {filtered.length} of {users.length} users
          </span>
          <RefreshButton onClick={fetchUsers} />
        </div>
      </div>

      <div className="dashboard__search-wrap">
        <SearchIcon />
        <input
          className="dashboard__search"
          type="text"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="dashboard__card">
        <table className="dashboard__table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>ID</th>
              <th>User</th>
              <th style={{ width: 110 }}>Role</th>
              <th style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4}>
                  <div className="dashboard__empty">Loading…</div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div className="dashboard__empty">
                    <div className="dashboard__empty-icon">∅</div>
                    No users found
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((u, i) => (
                <tr key={u.id}>
                  <td>
                    <span className="cell-id">#{u.id}</span>
                  </td>
                  <td>
                    <div className="user-cell">
                      <Avatar email={u.email} index={i} />
                      <span className="user-email">{u.email}</span>
                    </div>
                  </td>
                  <td>
                    <RoleBadge roleId={u.role_id} />
                  </td>
                  <td>
                    <button
                      className="btn-delete"
                      onClick={() => handleDelete(u.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;
