import React, { useState, useEffect, useCallback } from "react";

const API = "http://localhost:8080/api";

const peso = (value) => "₱" + Number(value || 0).toLocaleString("en-PH");

export default function AdminDashboard({ onLogout, currentUser }) {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reservations, setReservations] = useState([]);
  const [arrivalsTab, setArrivalsTab] = useState("Arrivals");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const emptyForm = {
    guestName: "",
    email: "",
    phone: "",
    roomType: "Standard Room",
    checkIn: "",
    checkOut: "",
    totalAmount: 1200,
    status: "Pending",
    roomNumber: "",
  };

  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    loadReservations();
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const response = await fetch(`${API}/rooms?all=1`);
      if (response.ok) setRooms(await response.json());
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
  };

  const loadReservations = async () => {
    try {
      const response = await fetch("http://localhost:8080/api/reservations");
      if (response.ok) {
        const data = await response.json();
        const formatted = data.map((res) => ({
          id: res.reservation_code || res.code || res.id,
          dbId: res.id,
          guestName: res.guestName || res.guest_name,
          email: res.email,
          phone: res.phone,
          roomType: res.roomType || res.room_type || "Standard Room",
          checkIn: res.checkIn || res.check_in,
          checkOut: res.checkOut || res.check_out,
          totalAmount: Number(res.totalAmount || res.total_amount || 0),
          status: res.status || "Pending",
          roomNumber: res.roomNumber || "",
          notes: res.notes || "",
          paymentMethod: res.paymentMethod || "",
          paymentReference: res.paymentReference || "",
          paymentStatus: res.paymentStatus || "Unpaid",
          voucherCode: res.voucherCode || "",
          discountAmount: Number(res.discountAmount || 0),
        }));
        setReservations(formatted);
      }
    } catch (error) {
      console.error("Failed to load reservations from API:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:8080/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: formData.guestName,
          email: formData.email,
          phone: formData.phone,
          roomType: formData.roomType,
          checkIn: formData.checkIn,
          checkOut: formData.checkOut,
          totalAmount: formData.totalAmount,
          status: formData.status,
          guests: 1,
          paymentMethod: "Cash",
        }),
      });

      if (response.ok) {
        loadReservations();
        setIsAddModalOpen(false);
        setFormData(emptyForm);
      } else {
        alert("Failed to create booking.");
      }
    } catch (error) {
      console.error("Error creating booking:", error);
    }
  };

  const handleOpenEdit = (res) => {
    setEditingId(res.dbId || res.id);
    setFormData({
      guestName: res.guestName,
      email: res.email,
      phone: res.phone,
      roomType: res.roomType,
      checkIn: res.checkIn,
      checkOut: res.checkOut,
      totalAmount: res.totalAmount,
      status: res.status,
      roomNumber: res.roomNumber || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateBooking = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:8080/api/reservations/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: formData.guestName,
          email: formData.email,
          phone: formData.phone,
          roomType: formData.roomType,
          checkIn: formData.checkIn,
          checkOut: formData.checkOut,
          totalAmount: formData.totalAmount,
          status: formData.status,
          roomNumber: formData.roomNumber,
        }),
      });

      if (response.ok) {
        loadReservations();
        setIsEditModalOpen(false);
        setEditingId(null);
        setFormData(emptyForm);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(errData.message || "Failed to update booking.");
      }
    } catch (error) {
      console.error("Error updating booking:", error);
    }
  };


  const handlePaymentToggle = async (resItem) => {
    const next = resItem.paymentStatus === "Paid" ? "Unpaid" : "Paid";
    try {
      const response = await fetch(`${API}/reservations/${resItem.dbId || resItem.id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: next }),
      });
      if (response.ok) loadReservations();
      else alert("Could not update the payment status.");
    } catch (error) {
      console.error("Error updating payment:", error);
    }
  };

  const handleStatusQuickChange = async (resItem, newStatus) => {
    if (newStatus === "Confirmed") {
      setConfirmTarget(resItem);
      return;
    }
    const targetId = resItem.dbId || resItem.id;
    try {
      const response = await fetch(`http://localhost:8080/api/reservations/${targetId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        loadReservations();
      } else {
        const errData = await response.json();
        alert("Hindi na-update ang status: " + (errData.message || "Unknown error"));
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("May problema sa koneksyon sa server.");
    }
  };

  const handleDeleteBooking = async (resItem) => {
    const targetId = resItem.dbId || resItem.id;
    if (window.confirm("ARE YOU SURE U WANT TO DELETE?")) {
      try {
        const response = await fetch(`http://localhost:8080/api/reservations/${targetId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          loadReservations();
        } else {
          alert("Failed to delete booking.");
        }
      } catch (error) {
        console.error("Error deleting booking:", error);
      }
    }
  };

  const totalBooked = reservations.filter((r) => r.status === "Confirmed").length;
  const totalPending = reservations.filter((r) => r.status === "Pending").length;
  const activeRooms = rooms.filter((r) => r.is_active);
  const roomTypesCount = activeRooms.length
    ? Object.fromEntries(activeRooms.map((r) => [r.name, r.total_units]))
    : {
        "Standard Room": 8,
        "Deluxe Queen Room": 8,
        "Family Suite Room": 8,
        "Barkada Group Room": 6,
        Studio: 4,
      };
  const totalRoomUnits = Object.values(roomTypesCount).reduce((sum, n) => sum + Number(n), 0);
  const availableRoomsCount = Math.max(0, totalRoomUnits - totalBooked);
  const roomOptions = Object.keys(roomTypesCount);

  const menuItems = [
    { id: "Dashboard", label: "Dashboard" },
    { id: "Calendar", label: "Calendar" },
    { id: "Bookings", label: "Bookings" },
    { id: "Clients", label: "Clients" },
    { id: "Rooms", label: "Rooms" },
    { id: "Keys", label: "Key Management" },
    { id: "Discounts", label: "Discounts" },
    { id: "Food Orders", label: "Food Orders" },
    { id: "Extras", label: "Extras" },
  ];

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        fontFamily: "'Inter', 'Segoe UI', Roboto, sans-serif",
        backgroundColor: "lightgray",
        color: "#333",
      }}
    >
      <div
        style={{
          width: sidebarOpen ? "250px" : "75px",
          backgroundColor: "#2f4f4f",
          color: "white",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          boxShadow: "2px 0 10px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            padding: "24px 20px",
            textAlign: sidebarOpen ? "left" : "center",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {sidebarOpen ? (
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.15rem",
                  fontWeight: "700",
                  letterSpacing: "0.5px",
                  color: "#ffffff",
                }}
              >
                Hytech Hotel & Bistro
              </h3>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#a2b4b4",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Admin Panel
              </span>
            </div>
          ) : (
            <span style={{ fontWeight: "700", fontSize: "1.2rem" }}>DH</span>
          )}
        </div>

        <nav style={{ marginTop: "20px", flex: 1, padding: "0 10px" }}>
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "12px 16px",
                  marginBottom: "4px",
                  backgroundColor: isActive
                    ? "rgba(255, 255, 255, 0.12)"
                    : "transparent",
                  color: isActive ? "#ffffff" : "#c1d0d0",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: "0.9rem",
                  fontWeight: isActive ? "600" : "500",
                  transition: "all 0.2s ease",
                  boxShadow: isActive ? "inset 3px 0 0 #b22222" : "none",
                }}
              >
                {sidebarOpen ? (
                  <span>{item.label}</span>
                ) : (
                  <span>{item.label.substring(0, 3)}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div
          style={{
            padding: "15px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <button
            onClick={onLogout}
            style={{
              width: "100%",
              padding: "10px 16px",
              backgroundColor: "#b22222",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: "600",
              letterSpacing: "0.3px",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 4px rgba(178,34,34,0.3)",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = "#961c1c")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "#b22222")
            }
          >
            {sidebarOpen ? "Logout" : "Exit"}
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflowX: "hidden",
        }}
      >
        <div
          style={{
            height: "64px",
            backgroundColor: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            borderBottom: "1px solid #eef2f5",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.2rem",
                cursor: "pointer",
                color: "#2f4f4f",
                padding: "6px 10px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ☰
            </button>
            <h2
              style={{
                margin: 0,
                fontSize: "1.25rem",
                color: "#2f4f4f",
                fontWeight: "700",
                letterSpacing: "-0.3px",
              }}
            >
              {activeTab}
            </h2>
          </div>

          {currentUser && (
            <div
              style={{
                fontSize: "0.85rem",
                color: "#607274",
                fontWeight: "500",
              }}
            >
              Administrator:{" "}
              <strong style={{ color: "#2f4f4f" }}>
                {currentUser.name || currentUser.displayName || currentUser.email}
              </strong>
            </div>
          )}
        </div>

        <div style={{ padding: "28px", flex: 1 }}>
          {activeTab === "Dashboard" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 1fr",
                gap: "24px",
              }}
            >
              <div>
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    padding: "24px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    marginBottom: "24px",
                    border: "1px solid #eef2f5",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "14px 0",
                      borderBottom: "1px solid #f2f5f8",
                    }}
                  >
                    <span style={{ color: "#607274", fontSize: "0.95rem" }}>
                      Rooms Booked Today
                    </span>
                    <strong style={{ color: "#2f4f4f", fontSize: "1.1rem" }}>
                      {totalBooked}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "14px 0",
                      borderBottom: "1px solid #f2f5f8",
                    }}
                  >
                    <span style={{ color: "#607274", fontSize: "0.95rem" }}>
                      Pending Rooms Today
                    </span>
                    <strong style={{ color: "#b22222", fontSize: "1.1rem" }}>
                      {totalPending}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "14px 0",
                    }}
                  >
                    <span style={{ color: "#607274", fontSize: "0.95rem" }}>
                      Available Rooms Today
                    </span>
                    <strong style={{ color: "#2e7d32", fontSize: "1.1rem" }}>
                      {availableRoomsCount}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "#ffffff",
                    padding: "24px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    border: "1px solid #eef2f5",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 16px 0",
                      color: "#2f4f4f",
                      fontSize: "0.8rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.8px",
                      fontWeight: "700",
                    }}
                  >
                    Available Rooms By Type
                  </h4>
                  {Object.entries(roomTypesCount).map(([type, count]) => (
                    <div
                      key={type}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "12px 0",
                        fontSize: "0.9rem",
                        color: "#444",
                        borderBottom: "1px dashed #eef2f5",
                      }}
                    >
                      <span>{type}</span>
                      <strong style={{ color: "#2f4f4f" }}>{count}</strong>
                    </div>
                  ))}
                  <button
                    onClick={() => setActiveTab("Calendar")}
                    style={{
                      marginTop: "16px",
                      background: "none",
                      border: "none",
                      color: "#b22222",
                      cursor: "pointer",
                      fontSize: "0.88rem",
                      fontWeight: "600",
                      padding: 0,
                    }}
                  >
                    View Calendar →
                  </button>
                </div>
              </div>

              <div>
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    padding: "24px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    border: "1px solid #eef2f5",
                    minHeight: "260px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      borderBottom: "1px solid #eef2f5",
                      marginBottom: "16px",
                    }}
                  >
                    <button
                      onClick={() => setArrivalsTab("Arrivals")}
                      style={{
                        padding: "10px 16px",
                        border: "none",
                        background: "none",
                        borderBottom:
                          arrivalsTab === "Arrivals"
                            ? "2px solid #2f4f4f"
                            : "2px solid transparent",
                        fontWeight: arrivalsTab === "Arrivals" ? "700" : "500",
                        color: arrivalsTab === "Arrivals" ? "#2f4f4f" : "#888",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                      }}
                    >
                      Arrivals
                    </button>
                    <button
                      onClick={() => setArrivalsTab("Departures")}
                      style={{
                        padding: "10px 16px",
                        border: "none",
                        background: "none",
                        borderBottom:
                          arrivalsTab === "Departures"
                            ? "2px solid #2f4f4f"
                            : "2px solid transparent",
                        fontWeight:
                          arrivalsTab === "Departures" ? "700" : "500",
                        color:
                          arrivalsTab === "Departures" ? "#2f4f4f" : "#888",
                        cursor: "pointer",
                        fontSize: "0.9rem",
                      }}
                    >
                      Departures
                    </button>
                  </div>

                  <div
                    style={{
                      color: "#777",
                      fontSize: "0.9rem",
                      textAlign: "center",
                      paddingTop: "40px",
                    }}
                  >
                    {arrivalsTab === "Arrivals"
                      ? reservations.length === 0
                        ? "No arrivals scheduled today"
                        : `Incoming guests today: ${reservations.length}`
                      : "No departures scheduled today"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Calendar" && (
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "28px",
                borderRadius: "10px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                border: "1px solid #eef2f5",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      color: "#2f4f4f",
                      fontSize: "1.15rem",
                      fontWeight: "700",
                    }}
                  >
                    Room Occupancy Calendar
                  </h3>
                  <p
                    style={{
                      margin: "4px 0 0 0",
                      color: "#777",
                      fontSize: "0.85rem",
                    }}
                  >
                    Monthly reservation schedule & room availability grid
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "8px",
                  marginTop: "16px",
                }}
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div
                      key={day}
                      style={{
                        fontWeight: "600",
                        padding: "10px",
                        backgroundColor: "#f4f6f9",
                        color: "#2f4f4f",
                        borderRadius: "6px",
                        textAlign: "center",
                        fontSize: "0.85rem",
                      }}
                    >
                      {day}
                    </div>
                  ),
                )}
                {Array.from({ length: 31 }).map((_, i) => {
                  const dayNum = i + 1;
                  const isBooked = dayNum % 4 === 0 || dayNum % 7 === 0;
                  return (
                    <div
                      key={i}
                      style={{
                        padding: "14px 10px",
                        border: "1px solid #eef2f5",
                        borderRadius: "6px",
                        backgroundColor: isBooked ? "#fdf2f2" : "#ffffff",
                        minHeight: "75px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: "700",
                          color: "#2f4f4f",
                          fontSize: "0.85rem",
                        }}
                      >
                        {dayNum}
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: "600",
                          color: isBooked ? "#b22222" : "#2e7d32",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: isBooked
                            ? "rgba(178,34,34,0.08)"
                            : "rgba(46,125,50,0.08)",
                          textAlign: "center",
                        }}
                      >
                        {isBooked ? "Booked" : "Available"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "Bookings" && (
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "28px",
                borderRadius: "10px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                border: "1px solid #eef2f5",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <input
                  type="text"
                  placeholder="Search guest or booking ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    width: "280px",
                    borderRadius: "6px",
                    border: "1px solid #dcdfe4",
                    fontSize: "0.88rem",
                    outline: "none",
                  }}
                />

                <div
                  style={{ display: "flex", gap: "12px", alignItems: "center" }}
                >
                  <button
                    onClick={() => {
                      setFormData(emptyForm);
                      setIsAddModalOpen(true);
                    }}
                    style={{
                      backgroundColor: "whitesmoke",
                      color: "black",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: "600",
                      fontSize: "0.88rem",
                      boxShadow: "whitesmoke 0px 2px 4px rgba(0,0,0,0.1)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    + Add New Booking
                  </button>

                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      backgroundColor: "#121414",
                      padding: "3px",
                      borderRadius: "6px",
                    }}
                  >
                    {["All", "Pending", "Confirmed", "Cancelled"].map((st) => (
                      <button
                        key={st}
                        onClick={() => setFilterStatus(st)}
                        style={{
                          padding: "6px 12px",
                          backgroundColor:
                            filterStatus === st ? "#ffffff" : "transparent",
                          color: filterStatus === st ? "#2f4f4f" : "#607274",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontWeight: filterStatus === st ? "600" : "500",
                          fontSize: "0.82rem",
                          boxShadow:
                            filterStatus === st
                              ? "0 1px 3px rgba(0,0,0,0.08)"
                              : "none",
                        }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.88rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: "#2f4f4f",
                        color: "white",
                        textAlign: "left",
                      }}
                    >
                      <th
                        style={{
                          padding: "12px 16px",
                          borderRadius: "6px 0 0 6px",
                        }}
                      >
                        ID
                      </th>
                      <th style={{ padding: "12px 16px" }}>Guest Details</th>
                      <th style={{ padding: "12px 16px" }}>Room</th>
                      <th style={{ padding: "12px 16px" }}>Room No.</th>
                      <th style={{ padding: "12px 16px" }}>Dates</th>
                      <th style={{ padding: "12px 16px" }}>Amount</th>
                      <th style={{ padding: "12px 16px" }}>Payment</th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                      <th
                        style={{
                          padding: "12px 16px",
                          borderRadius: "0 6px 6px 0",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservations.length === 0 ? (
                      <tr>
                        <td
                          colSpan="9"
                          style={{
                            textAlign: "center",
                            padding: "28px",
                            color: "#888",
                          }}
                        >
                          No reservations found in database.
                        </td>
                      </tr>
                    ) : (
                      reservations
                        .filter(
                          (r) =>
                            filterStatus === "All" || r.status === filterStatus,
                        )
                        .filter(
                          (r) =>
                            (r.guestName && r.guestName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                            (r.id && r.id.toLowerCase().includes(searchQuery.toLowerCase())),
                        )
                        .map((res) => (
                          <tr
                            key={res.dbId || res.id}
                            style={{ borderBottom: "1px solid #f2f5f8" }}
                          >
                            <td
                              style={{
                                padding: "14px 16px",
                                fontWeight: "600",
                                color: "#2f4f4f",
                              }}
                            >
                              {res.id}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <div style={{ fontWeight: "600", color: "#333" }}>
                                {res.guestName}
                              </div>
                              <div
                                style={{ fontSize: "0.8rem", color: "#777" }}
                              >
                                {res.email} | {res.phone}
                              </div>
                              {res.notes && (
                                <div style={{ fontSize: "0.8rem", color: "#b45309", marginTop: "4px" }}>
                                  Request: {res.notes}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              {res.roomType}
                            </td>
                            <td style={{ padding: "14px 16px", fontWeight: "700", color: "#2f4f4f" }}>
                              {res.roomNumber || "Not assigned"}
                            </td>
                            <td style={{ padding: "14px 16px", color: "#555" }}>
                              {res.checkIn} to {res.checkOut}
                            </td>
                            <td
                              style={{
                                padding: "14px 16px",
                                fontWeight: "700",
                                color: "#b22222",
                              }}
                            >
                              {peso(res.totalAmount)}
                              {res.discountAmount > 0 && (
                                <div style={{ fontSize: "0.75rem", fontWeight: "500", color: "#2e7d32" }}>
                                  {res.voucherCode}: -{peso(res.discountAmount)}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "14px 16px", fontSize: "0.82rem" }}>
                              <div style={{ fontWeight: "600" }}>{res.paymentMethod}</div>
                              {res.paymentReference && (
                                <div style={{ color: "#777" }}>Ref: {res.paymentReference}</div>
                              )}
                              <button
                                type="button"
                                onClick={() => handlePaymentToggle(res)}
                                style={{
                                  marginTop: "4px",
                                  padding: "3px 10px",
                                  borderRadius: "999px",
                                  border: "none",
                                  cursor: "pointer",
                                  fontWeight: "700",
                                  fontSize: "0.75rem",
                                  backgroundColor: res.paymentStatus === "Paid" ? "#e6f4ea" : "#fff4dc",
                                  color: res.paymentStatus === "Paid" ? "#1e6b34" : "#8a5a00",
                                }}
                              >
                                {res.paymentStatus}
                              </button>
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <select
                                value={res.status}
                                onChange={(e) =>
                                  handleStatusQuickChange(
                                    res,
                                    e.target.value,
                                  )
                                }
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "4px",
                                  fontWeight: "600",
                                  fontSize: "0.82rem",
                                  border: "1px solid #dcdfe4",
                                  backgroundColor: "#ffffff",
                                  color:
                                    res.status === "Confirmed"
                                      ? "#2e7d32"
                                      : res.status === "Cancelled"
                                        ? "#b22222"
                                        : "#d97706",
                                }}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Confirmed">Confirmed</option>
                                <option value="Cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  onClick={() => handleOpenEdit(res)}
                                  style={{
                                    backgroundColor: "#ffffff",
                                    color: "#2f4f4f",
                                    border: "1px solid #dcdfe4",
                                    padding: "6px 12px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteBooking(res)}
                                  style={{
                                    backgroundColor: "rgba(178,34,34,0.08)",
                                    color: "#b22222",
                                    border: "1px solid rgba(178,34,34,0.2)",
                                    padding: "6px 12px",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    fontWeight: "600",
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "Clients" && (
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "28px",
                borderRadius: "10px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                border: "1px solid #eef2f5",
              }}
            >
              <h3
                style={{
                  margin: "0 0 16px 0",
                  color: "#2f4f4f",
                  fontSize: "1.15rem",
                  fontWeight: "700",
                }}
              >
                Client Directory
              </h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {reservations.map((res, i) => (
                  <li
                    key={i}
                    style={{
                      padding: "14px 0",
                      borderBottom: "1px solid #f2f5f8",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "600", color: "#333" }}>
                        {res.guestName}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#777" }}>
                        {res.email} | {res.phone}
                      </div>
                    </div>
                    <span
                      style={{
                        color: "#2f4f4f",
                        fontWeight: "600",
                        fontSize: "0.88rem",
                        backgroundColor: "#f4f6f9",
                        padding: "4px 10px",
                        borderRadius: "4px",
                      }}
                    >
                      {res.roomType}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === "Rooms" && <AdminRoomsTab rooms={rooms} onSaved={loadRooms} />}
          {activeTab === "Keys" && <AdminKeysTab reservations={reservations} />}
          {activeTab === "Discounts" && <AdminVouchersTab />}

          {activeTab === "Food Orders" && <AdminOrdersTab />}

          {activeTab === "Extras" && (
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "28px",
                borderRadius: "10px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                border: "1px solid #eef2f5",
              }}
            >
              <h3
                style={{
                  margin: "0 0 8px 0",
                  color: "#2f4f4f",
                  fontSize: "1.15rem",
                  fontWeight: "700",
                }}
              >
                Extras and Services
              </h3>
              <p
                style={{
                  margin: "0 0 20px 0",
                  color: "#777",
                  fontSize: "0.88rem",
                }}
              >
                Manage add-on amenities and extra charges.
              </p>
            </div>
          )}
        </div>
      </div>

      {confirmTarget && (
        <ConfirmBookingModal
          reservation={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onDone={() => {
            setConfirmTarget(null);
            loadReservations();
          }}
        />
      )}

      {isAddModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(2px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "28px",
              borderRadius: "10px",
              width: "420px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                color: "#2f4f4f",
                fontSize: "1.15rem",
                fontWeight: "700",
              }}
            >
              Add New Reservation
            </h3>
            <form onSubmit={handleCreateBooking}>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Guest Name:
                </label>
                <input
                  type="text"
                  name="guestName"
                  required
                  value={formData.guestName}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Email:
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Phone:
                </label>
                <input
                  type="text"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Room Type:
                </label>
                <select
                  name="roomType"
                  value={formData.roomType}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                >
                  {roomOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div
                style={{ display: "flex", gap: "10px", marginBottom: "12px" }}
              >
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: "600",
                      color: "#444",
                    }}
                  >
                    Check-In:
                  </label>
                  <input
                    type="date"
                    name="checkIn"
                    required
                    value={formData.checkIn}
                    onChange={handleInputChange}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      border: "1px solid #dcdfe4",
                      boxSizing: "border-box",
                      marginTop: "4px",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: "600",
                      color: "#444",
                    }}
                  >
                    Check-Out:
                  </label>
                  <input
                    type="date"
                    name="checkOut"
                    required
                    value={formData.checkOut}
                    onChange={handleInputChange}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      border: "1px solid #dcdfe4",
                      boxSizing: "border-box",
                      marginTop: "4px",
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Amount (₱):
                </label>
                <input
                  type="number"
                  name="totalAmount"
                  required
                  value={formData.totalAmount}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #2f4f4f",
                    backgroundColor: "#2f4f4f",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: "#2f4f4f",
                    color: "white",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Save Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(2px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "28px",
              borderRadius: "10px",
              width: "420px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                color: "#2f4f4f",
                fontSize: "1.15rem",
                fontWeight: "700",
              }}
            >
              Edit Booking
            </h3>
            <form onSubmit={handleUpdateBooking}>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Guest Name:
                </label>
                <input
                  type="text"
                  name="guestName"
                  required
                  value={formData.guestName}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Email:
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Phone:
                </label>
                <input
                  type="text"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Room Type:
                </label>
                <select
                  name="roomType"
                  value={formData.roomType}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                >
                  {roomOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div
                style={{ display: "flex", gap: "10px", marginBottom: "12px" }}
              >
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: "600",
                      color: "#444",
                    }}
                  >
                    Check-In:
                  </label>
                  <input
                    type="date"
                    name="checkIn"
                    required
                    value={formData.checkIn}
                    onChange={handleInputChange}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      border: "1px solid #dcdfe4",
                      boxSizing: "border-box",
                      marginTop: "4px",
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: "600",
                      color: "#444",
                    }}
                  >
                    Check-Out:
                  </label>
                  <input
                    type="date"
                    name="checkOut"
                    required
                    value={formData.checkOut}
                    onChange={handleInputChange}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      border: "1px solid #dcdfe4",
                      boxSizing: "border-box",
                      marginTop: "4px",
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "#444" }}>
                  Room Number:
                </label>
                <input
                  type="text"
                  name="roomNumber"
                  value={formData.roomNumber}
                  onChange={handleInputChange}
                  placeholder="e.g. 204"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    color: "#444",
                  }}
                >
                  Amount (₱):
                </label>
                <input
                  type="number"
                  name="totalAmount"
                  required
                  value={formData.totalAmount}
                  onChange={handleInputChange}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "1px solid #dcdfe4",
                    boxSizing: "border-box",
                    marginTop: "4px",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #dcdfe4",
                    backgroundColor: "#fff",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: "#2f4f4f",
                    color: "white",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Update Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const adPanel = {
  backgroundColor: "#ffffff",
  padding: "28px",
  borderRadius: "10px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
  border: "1px solid #eef2f5",
};

const adHeading = { margin: "0 0 8px 0", color: "#2f4f4f", fontSize: "1.15rem", fontWeight: "700" };

const adSubheading = { margin: "0 0 20px 0", color: "#777", fontSize: "0.88rem" };

const adLabel = { fontSize: "0.82rem", fontWeight: "600", color: "#444" };

const adInput = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "4px",
  border: "1px solid #dcdfe4",
  boxSizing: "border-box",
  marginTop: "4px",
  backgroundColor: "#fff",
  color: "#333",
};

const adPrimaryButton = {
  backgroundColor: "#2f4f4f",
  color: "white",
  border: "none",
  padding: "8px 16px",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "0.85rem",
};

const adGhostButton = {
  backgroundColor: "#ffffff",
  color: "#2f4f4f",
  border: "1px solid #dcdfe4",
  padding: "8px 16px",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "0.85rem",
};

const adDangerButton = {
  backgroundColor: "rgba(178,34,34,0.08)",
  color: "#b22222",
  border: "1px solid rgba(178,34,34,0.2)",
  padding: "8px 16px",
  borderRadius: "4px",
  cursor: "pointer",
  fontWeight: "600",
  fontSize: "0.85rem",
};

const adOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "rgba(0,0,0,0.4)",
  backdropFilter: "blur(2px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const adModal = {
  backgroundColor: "#fff",
  padding: "28px",
  borderRadius: "10px",
  width: "420px",
  maxWidth: "92vw",
  maxHeight: "92vh",
  overflowY: "auto",
  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
};

const adTh = { padding: "12px 16px" };

const adErrorBox = {
  backgroundColor: "#fbe9e7",
  color: "#b22222",
  padding: "8px 12px",
  borderRadius: "6px",
  fontSize: "0.85rem",
  marginBottom: "12px",
};

function AdminRoomsTab({ rooms, onSaved }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openEdit = (room) => {
    setEditing(room);
    setForm({
      name: room.name,
      category: room.category,
      price: room.price,
      capacity: room.capacity,
      totalUnits: room.total_units,
      isActive: Boolean(room.is_active),
    });
    setError("");
  };

  const closeEdit = () => {
    setEditing(null);
    setForm(null);
  };

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API}/rooms/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim(),
          price: Number(form.price),
          capacity: Number(form.capacity),
          totalUnits: Number(form.totalUnits),
          isActive: form.isActive,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message || "Could not save the room.");
        return;
      }
      closeEdit();
      onSaved();
    } catch (err) {
      console.error(err);
      setError("Cannot reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={adPanel}>
      <h3 style={adHeading}>Room Management</h3>
      <p style={adSubheading}>Configure hotel room capacity and base prices.</p>

      {rooms.length === 0 ? (
        <div style={{ padding: "24px", border: "1px dashed #dcdfe4", borderRadius: "8px", textAlign: "center", color: "#888" }}>
          No rooms loaded. Check that the backend is running.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
          {rooms.map((room) => (
            <div
              key={room.id}
              style={{
                padding: "20px",
                border: "1px solid #eef2f5",
                borderRadius: "8px",
                backgroundColor: "#fcfdfe",
                opacity: room.is_active ? 1 : 0.6,
              }}
            >
              <h4 style={{ margin: "0 0 4px 0", color: "#2f4f4f" }}>{room.name}</h4>
              <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "10px" }}>
                {room.category}{room.is_active ? "" : " · Hidden from guests"}
              </div>
              <div style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.7, marginBottom: "14px" }}>
                <div>Price: <strong>{peso(room.price)}</strong> / night</div>
                <div>Capacity: <strong>{room.capacity}</strong> guest{room.capacity > 1 ? "s" : ""}</div>
                <div>Total inventory: <strong>{room.total_units}</strong> rooms</div>
              </div>
              <button type="button" onClick={() => openEdit(room)} style={adPrimaryButton}>
                Edit Details
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && form && (
        <div style={adOverlay} onClick={closeEdit}>
          <div style={adModal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: "#2f4f4f", fontSize: "1.15rem", fontWeight: "700" }}>Edit Room Details</h3>
            <form onSubmit={save}>
              {error && <div style={adErrorBox}>{error}</div>}
              <div style={{ marginBottom: "12px" }}>
                <label style={adLabel}>Room name:</label>
                <input style={adInput} name="name" required value={form.name} onChange={change} />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={adLabel}>Category:</label>
                <input style={adInput} name="category" required value={form.category} onChange={change} />
              </div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={adLabel}>Price per night (₱):</label>
                  <input style={adInput} type="number" min="0" name="price" required value={form.price} onChange={change} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={adLabel}>Max guests:</label>
                  <input style={adInput} type="number" min="1" name="capacity" required value={form.capacity} onChange={change} />
                </div>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={adLabel}>Total rooms of this type:</label>
                <input style={adInput} type="number" min="0" name="totalUnits" required value={form.totalUnits} onChange={change} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.88rem", color: "#444", marginBottom: "20px" }}>
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={change} />
                Available for guest booking
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={closeEdit} style={adGhostButton}>Cancel</button>
                <button type="submit" disabled={saving} style={adPrimaryButton}>
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const KEY_STATUSES = ["Available", "Assigned", "Lost", "Damaged"];

function localDateValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function createEmptyKeyForm() {
  return {
    keyCode: "",
    keyType: "Access card",
    roomNumber: "",
    guestName: "",
    reservationCode: "",
    status: "Available",
    issuedAt: "",
    returnedAt: "",
    notes: "",
  };
}

function AdminKeysTab({ reservations }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(createEmptyKeyForm);
  const [editingKey, setEditingKey] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const loadKeys = useCallback(async () => {
    try {
      const response = await fetch(`${API}/keys`);
      const result = await response.json();
      if (!response.ok) {
        setLoadError(result.message || "Could not load key records.");
        return;
      }
      setLoadError("");
      setKeys(result);
    } catch (loadError) {
      console.error("Failed to load key records:", loadError);
      setLoadError("Cannot reach the server. Check that the hotel API is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const openCreate = () => {
    setEditingKey(null);
    setForm(createEmptyKeyForm());
    setError("");
    setIsModalOpen(true);
  };

  const openEdit = (key) => {
    setEditingKey(key);
    setForm({
      keyCode: key.keyCode || "",
      keyType: key.keyType || "Access card",
      roomNumber: key.roomNumber || "",
      guestName: key.guestName || "",
      reservationCode: key.reservationCode || "",
      status: key.status || "Available",
      issuedAt: key.issuedAt || "",
      returnedAt: key.returnedAt || "",
      notes: key.notes || "",
    });
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingKey(null);
    setError("");
  };

  const change = (event) => {
    const { name, value } = event.target;
    setForm((previous) => {
      if (name === "status") {
        if (value === "Available") {
          return {
            ...previous,
            status: value,
            roomNumber: "",
            guestName: "",
            reservationCode: "",
            returnedAt: previous.status === "Assigned" ? localDateValue() : previous.returnedAt,
          };
        }
        return {
          ...previous,
          status: value,
          issuedAt: value === "Assigned" ? previous.issuedAt || localDateValue() : previous.issuedAt,
          returnedAt: value === "Assigned" ? "" : previous.returnedAt,
        };
      }
      return { ...previous, [name]: value };
    });
  };

  const selectReservation = (event) => {
    const reservationCode = event.target.value;
    const reservation = reservations.find((item) => String(item.id) === reservationCode);
    setForm((previous) => ({
      ...previous,
      reservationCode,
      guestName: reservation?.guestName || previous.guestName,
      roomNumber: reservation?.roomNumber || previous.roomNumber,
      status: reservation ? "Assigned" : previous.status,
      issuedAt: reservation ? previous.issuedAt || localDateValue() : previous.issuedAt,
      returnedAt: reservation ? "" : previous.returnedAt,
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API}/keys${editingKey ? `/${editingKey.id}` : ""}`, {
        method: editingKey ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          keyCode: form.keyCode.trim(),
          keyType: form.keyType.trim(),
          roomNumber: form.roomNumber.trim(),
          guestName: form.guestName.trim(),
          notes: form.notes.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message || "Could not save this key record.");
        return;
      }
      setIsModalOpen(false);
      setEditingKey(null);
      setForm(createEmptyKeyForm());
      await loadKeys();
    } catch (saveError) {
      console.error("Failed to save key record:", saveError);
      setError("Cannot reach the server. Check that the hotel API is running.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (key) => {
    if (!window.confirm(`Delete key record ${key.keyCode}?`)) return;
    setLoadError("");
    try {
      const response = await fetch(`${API}/keys/${key.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        setLoadError(result.message || "Could not delete this key record.");
        return;
      }
      await loadKeys();
    } catch (deleteError) {
      console.error("Failed to delete key record:", deleteError);
      setLoadError("Cannot reach the server. Check that the hotel API is running.");
    }
  };

  const filteredKeys = keys.filter((key) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      key.keyCode,
      key.keyType,
      key.roomNumber,
      key.guestName,
      key.reservationCode,
    ].some((value) => String(value || "").toLowerCase().includes(query));
    return matchesSearch && (statusFilter === "All" || key.status === statusFilter);
  });
  const assignedCount = keys.filter((key) => key.status === "Assigned").length;
  const attentionCount = keys.filter((key) => ["Lost", "Damaged"].includes(key.status)).length;

  const statusStyle = (status) => ({
    display: "inline-block",
    padding: "4px 9px",
    borderRadius: "999px",
    fontSize: "0.76rem",
    fontWeight: "700",
    color: status === "Available" ? "#1e6b34" : status === "Assigned" ? "#805600" : "#b22222",
    backgroundColor: status === "Available" ? "#e6f4ea" : status === "Assigned" ? "#fff4dc" : "#fbe9e7",
  });

  return (
    <div style={adPanel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h3 style={adHeading}>Key Management</h3>
          <p style={adSubheading}>Issue and track room keys and access cards against guest reservations.</p>
        </div>
        <button type="button" onClick={openCreate} style={adPrimaryButton}>Add key</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        {[
          ["Total keys", keys.length, "#2f4f4f"],
          ["Available", keys.filter((key) => key.status === "Available").length, "#1e6b34"],
          ["Assigned", assignedCount, "#805600"],
          ["Lost / damaged", attentionCount, "#b22222"],
        ].map(([label, count, color]) => (
          <div key={label} style={{ padding: "16px", backgroundColor: "#fcfdfe", border: "1px solid #eef2f5", borderRadius: "8px" }}>
            <div style={{ color: "#777", fontSize: "0.8rem" }}>{label}</div>
            <strong style={{ display: "block", marginTop: "5px", color, fontSize: "1.3rem" }}>{count}</strong>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
        <input
          aria-label="Search key records"
          style={{ ...adInput, flex: "1 1 220px", marginTop: 0 }}
          placeholder="Search key, room, guest or booking..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="Filter keys by status"
          style={{ ...adInput, flex: "0 1 170px", marginTop: 0 }}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="All">All statuses</option>
          {KEY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
      </div>

      {loadError && (
        <div style={adErrorBox}>
          {loadError}{" "}
          <button type="button" onClick={loadKeys} style={{ ...adGhostButton, marginLeft: "8px", padding: "4px 10px" }}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "24px", textAlign: "center", color: "#777" }}>Loading key records...</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem", minWidth: "850px" }}>
            <thead>
              <tr style={{ backgroundColor: "#2f4f4f", color: "white", textAlign: "left" }}>
                {["Key", "Room / guest", "Reservation", "Issue / return", "Status", "Actions"].map((heading) => (
                  <th key={heading} style={adTh}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: "28px", textAlign: "center", color: "#888" }}>
                    {keys.length ? "No keys match these filters." : "No key records yet. Add a key to get started."}
                  </td>
                </tr>
              ) : filteredKeys.map((key) => (
                <tr key={key.id} style={{ borderBottom: "1px solid #f2f5f8" }}>
                  <td style={{ padding: "13px 16px" }}>
                    <strong style={{ color: "#2f4f4f" }}>{key.keyCode}</strong>
                    <div style={{ color: "#888", fontSize: "0.78rem", marginTop: "3px" }}>{key.keyType}</div>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    {key.roomNumber ? <strong>Room {key.roomNumber}</strong> : "—"}
                    <div style={{ color: "#777", fontSize: "0.8rem", marginTop: "3px" }}>{key.guestName || "No guest assigned"}</div>
                  </td>
                  <td style={{ padding: "13px 16px" }}>{key.reservationCode || "—"}</td>
                  <td style={{ padding: "13px 16px", color: "#666" }}>
                    <div>Issued: {key.issuedAt || "—"}</div>
                    <div style={{ marginTop: "3px" }}>Returned: {key.returnedAt || "—"}</div>
                  </td>
                  <td style={{ padding: "13px 16px" }}><span style={statusStyle(key.status)}>{key.status}</span></td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button type="button" onClick={() => openEdit(key)} style={{ ...adGhostButton, padding: "6px 10px" }}>Edit</button>
                      <button type="button" onClick={() => remove(key)} style={{ ...adDangerButton, padding: "6px 10px" }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div style={adOverlay} onClick={closeModal}>
          <div style={adModal} onClick={(event) => event.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: "#2f4f4f", fontSize: "1.15rem", fontWeight: "700" }}>
              {editingKey ? "Edit key record" : "Add key record"}
            </h3>
            <form onSubmit={save}>
              {error && <div style={adErrorBox}>{error}</div>}
              <div style={{ marginBottom: "12px" }}>
                <label style={adLabel}>Key ID / label:</label>
                <input style={adInput} name="keyCode" maxLength="60" required value={form.keyCode} onChange={change} placeholder="e.g. CARD-101" />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={adLabel}>Key type:</label>
                <input style={adInput} name="keyType" maxLength="40" required value={form.keyType} onChange={change} placeholder="Access card, metal key..." />
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={adLabel}>Link a reservation (optional):</label>
                <select style={adInput} value={form.reservationCode} onChange={selectReservation}>
                  <option value="">No reservation</option>
                  {reservations.filter((item) => item.status !== "Cancelled").map((reservation) => (
                    <option key={reservation.id} value={reservation.id}>
                      {reservation.id} · {reservation.guestName}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={adLabel}>Room number:</label>
                  <input style={adInput} name="roomNumber" maxLength="20" required={form.status === "Assigned"} value={form.roomNumber} onChange={change} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={adLabel}>Guest name:</label>
                  <input style={adInput} name="guestName" maxLength="120" required={form.status === "Assigned"} value={form.guestName} onChange={change} />
                </div>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={adLabel}>Status:</label>
                <select style={adInput} name="status" value={form.status} onChange={change}>
                  {KEY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={adLabel}>Issue date:</label>
                  <input style={adInput} type="date" name="issuedAt" value={form.issuedAt} onChange={change} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={adLabel}>Return date:</label>
                  <input style={adInput} type="date" name="returnedAt" value={form.returnedAt} onChange={change} />
                </div>
              </div>
              <div style={{ marginBottom: "18px" }}>
                <label style={adLabel}>Notes (optional):</label>
                <textarea style={{ ...adInput, minHeight: "70px", resize: "vertical" }} name="notes" maxLength="500" value={form.notes} onChange={change} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={closeModal} disabled={saving} style={adGhostButton}>Cancel</button>
                <button type="submit" disabled={saving} style={adPrimaryButton}>{saving ? "Saving..." : "Save key"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const emptyVoucher = { code: "", discountType: "percent", discountValue: "", validUntil: "" };

function AdminVouchersTab() {
  const [vouchers, setVouchers] = useState([]);
  const [form, setForm] = useState(emptyVoucher);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API}/vouchers`);
      if (response.ok) setVouchers(await response.json());
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const response = await fetch(`${API}/vouchers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          validUntil: form.validUntil || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message || "Could not create the voucher.");
        return;
      }
      setForm(emptyVoucher);
      load();
    } catch (err) {
      console.error(err);
      setError("Cannot reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (voucher) => {
    await fetch(`${API}/vouchers/${voucher.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !voucher.isActive }),
    });
    load();
  };

  const remove = async (voucher) => {
    if (!window.confirm(`Delete voucher ${voucher.code}?`)) return;
    await fetch(`${API}/vouchers/${voucher.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div style={adPanel}>
      <h3 style={adHeading}>Discount Vouchers</h3>
      <p style={adSubheading}>Create promotional discount codes for direct bookings.</p>

      <form onSubmit={create} style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end", marginBottom: "10px" }}>
        <div style={{ flex: "1 1 150px" }}>
          <label style={adLabel}>Code:</label>
          <input style={adInput} name="code" required placeholder="SUMMER10" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} />
        </div>
        <div style={{ flex: "0 1 140px" }}>
          <label style={adLabel}>Type:</label>
          <select style={adInput} name="discountType" value={form.discountType} onChange={change}>
            <option value="percent">Percent off</option>
            <option value="fixed">Peso amount off</option>
          </select>
        </div>
        <div style={{ flex: "0 1 120px" }}>
          <label style={adLabel}>{form.discountType === "percent" ? "Percent:" : "Amount (₱):"}</label>
          <input style={adInput} type="number" min="1" name="discountValue" required value={form.discountValue} onChange={change} />
        </div>
        <div style={{ flex: "0 1 160px" }}>
          <label style={adLabel}>Valid until (optional):</label>
          <input style={adInput} type="date" name="validUntil" value={form.validUntil} onChange={change} />
        </div>
        <button type="submit" disabled={saving} style={{ ...adPrimaryButton, padding: "10px 18px" }}>
          {saving ? "Creating..." : "Create voucher"}
        </button>
      </form>
      {error && <div style={adErrorBox}>{error}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem", marginTop: "16px" }}>
        <thead>
          <tr style={{ backgroundColor: "#2f4f4f", color: "white", textAlign: "left" }}>
            <th style={{ ...adTh, borderRadius: "6px 0 0 6px" }}>Code</th>
            <th style={adTh}>Discount</th>
            <th style={adTh}>Valid until</th>
            <th style={adTh}>Status</th>
            <th style={{ ...adTh, borderRadius: "0 6px 6px 0" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {vouchers.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", padding: "28px", color: "#888" }}>
                No vouchers yet. Create one above.
              </td>
            </tr>
          ) : (
            vouchers.map((v) => (
              <tr key={v.id} style={{ borderBottom: "1px solid #f2f5f8" }}>
                <td style={{ ...adTh, fontWeight: "700", color: "#2f4f4f" }}>{v.code}</td>
                <td style={adTh}>{v.discountType === "percent" ? `${Number(v.discountValue)}% off` : `${peso(v.discountValue)} off`}</td>
                <td style={adTh}>{v.validUntil || "No expiry"}</td>
                <td style={{ ...adTh, fontWeight: "600", color: v.isActive ? "#2e7d32" : "#888" }}>{v.isActive ? "Active" : "Paused"}</td>
                <td style={adTh}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button type="button" style={{ ...adGhostButton, padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => toggle(v)}>
                      {v.isActive ? "Pause" : "Activate"}
                    </button>
                    <button type="button" style={{ ...adDangerButton, padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => remove(v)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const ORDER_STATUSES = ["Pending", "Preparing", "Served", "Cancelled"];

const orderTone = (status) => {
  if (status === "Served") return "#2e7d32";
  if (status === "Cancelled") return "#b22222";
  if (status === "Preparing") return "#1a4f8b";
  return "#d97706";
};

function AdminOrdersTab() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API}/orders`);
      if (response.ok) setOrders(await response.json());
      setError("");
    } catch (err) {
      console.error(err);
      setError("Cannot reach the server.");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const changeStatus = async (order, status) => {
    const response = await fetch(`${API}/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      const result = await response.json();
      alert(result.message || "Could not update the order.");
      return;
    }
    load();
  };

  return (
    <div style={adPanel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div>
          <h3 style={adHeading}>Food Orders</h3>
          <p style={adSubheading}>Orders sent from the Dining & Beverages menu. Refreshes every 20 seconds.</p>
        </div>
        <button type="button" onClick={load} style={adGhostButton}>Refresh</button>
      </div>
      {error && <div style={{ color: "#b22222", fontSize: "0.85rem", marginBottom: "12px" }}>{error}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
        <thead>
          <tr style={{ backgroundColor: "#2f4f4f", color: "white", textAlign: "left" }}>
            <th style={{ ...adTh, borderRadius: "6px 0 0 6px" }}>Order</th>
            <th style={adTh}>Guest</th>
            <th style={adTh}>Items</th>
            <th style={adTh}>Deliver to</th>
            <th style={adTh}>Total</th>
            <th style={{ ...adTh, borderRadius: "0 6px 6px 0" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: "center", padding: "28px", color: "#888" }}>
                No food orders yet.
              </td>
            </tr>
          ) : (
            orders.map((o) => (
              <tr key={o.id} style={{ borderBottom: "1px solid #f2f5f8", verticalAlign: "top" }}>
                <td style={{ ...adTh, fontWeight: "700", color: "#2f4f4f" }}>{o.code}</td>
                <td style={adTh}>
                  <div style={{ fontWeight: "600" }}>{o.guestName}</div>
                  <div style={{ fontSize: "0.8rem", color: "#777" }}>{o.phone}</div>
                </td>
                <td style={adTh}>
                  {o.items.map((i) => (
                    <div key={i.title}>{i.qty} × {i.title}</div>
                  ))}
                  {o.notes && <div style={{ fontSize: "0.8rem", color: "#b45309", marginTop: "4px" }}>Request: {o.notes}</div>}
                </td>
                <td style={adTh}>{o.roomNumber || "Not specified"}</td>
                <td style={{ ...adTh, fontWeight: "700", color: "#b22222" }}>{peso(o.totalAmount)}</td>
                <td style={adTh}>
                  <select
                    value={o.status}
                    onChange={(e) => changeStatus(o, e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: "4px", fontWeight: "600", fontSize: "0.82rem", border: "1px solid #dcdfe4", backgroundColor: "#fff", color: orderTone(o.status) }}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ConfirmBookingModal({ reservation, onClose, onDone }) {
  const [roomNumber, setRoomNumber] = useState(reservation.roomNumber || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API}/reservations/${reservation.dbId || reservation.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Confirmed", roomNumber: roomNumber.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.message || "Could not confirm this booking.");
        return;
      }
      onDone();
    } catch (err) {
      console.error(err);
      setError("Cannot reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={adOverlay} onClick={onClose}>
      <div style={{ ...adModal, width: "380px" }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, color: "#2f4f4f", fontSize: "1.15rem", fontWeight: "700" }}>Confirm booking</h3>
        <p style={{ margin: "0 0 14px", fontSize: "0.88rem", color: "#555", lineHeight: 1.5 }}>
          {reservation.guestName} · {reservation.roomType}<br />
          {reservation.checkIn} to {reservation.checkOut}
        </p>
        {reservation.paymentMethod === "GCash" && (
          <p style={{ margin: "0 0 14px", fontSize: "0.85rem", color: "#555" }}>
            GCash reference: <strong>{reservation.paymentReference || "none"}</strong>. Check it against your GCash history before confirming.
          </p>
        )}
        <form onSubmit={submit}>
          {error && <div style={adErrorBox}>{error}</div>}
          <label style={adLabel}>Assign room number:</label>
          <input
            style={{ ...adInput, marginBottom: "6px" }}
            required
            autoFocus
            placeholder="e.g. 204"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
          />
          <p style={{ margin: "0 0 18px", fontSize: "0.8rem", color: "#888" }}>
            The guest receives a text message with this room number.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button type="button" onClick={onClose} style={adGhostButton}>Cancel</button>
            <button type="submit" disabled={saving} style={adPrimaryButton}>
              {saving ? "Confirming..." : "Confirm booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
