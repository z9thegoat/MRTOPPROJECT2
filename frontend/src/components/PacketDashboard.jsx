import React, { useState, useEffect, useRef, useCallback } from "react";
import io from "socket.io-client";
import { Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import "./PacketDashboard.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

export default function PacketDashboard() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [packets, setPackets] = useState([]);
  const [displayPackets, setDisplayPackets] = useState([]);
  const [ipList, setIpList] = useState([]);
  const [filterIP, setFilterIP] = useState("");
  const [selectedPacket, setSelectedPacket] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = io("http://localhost:3000", {
      transports: ["websocket", "polling"],
    });

    fetch("http://localhost:3000/devices")
      .then((r) => r.json())
      .then(setDevices)
      .catch(() => {});

    socketRef.current.on("packetBatch", (batch) =>
      setPackets((p) => [...p, ...batch].slice(-1000)),
    );
    socketRef.current.on("ipList", setIpList);

    return () => socketRef.current.disconnect();
  }, []);

  useEffect(() => setDisplayPackets([...packets]), [packets]);

  const startCapture = useCallback((deviceName) => {
    setPackets([]);
    setDisplayPackets([]);
    setFilterIP("");
    socketRef.current.emit("startCapture", deviceName);
    setIsPaused(false);
  }, []);

  const handleDeviceChange = (e) => {
    const val = e.target.value;
    setSelectedDevice(val);
    if (val) startCapture(val);
  };

  const togglePause = () => {
    if (isPaused) {
      socketRef.current.emit("resumeCapture");
      setIsPaused(false);
    } else {
      socketRef.current.emit("pauseCapture");
      setIsPaused(true);
    }
  };

  const filtered = filterIP
    ? displayPackets.filter((p) => p.src === filterIP || p.dst === filterIP)
    : displayPackets;

  const total = filtered.length;
  const encCount = filtered.filter((p) => p.encrypted).length;
  const plainCount = total - encCount;
  const avgSize = total
    ? Math.round(filtered.reduce((s, p) => s + p.length, 0) / total)
    : 0;
  const uniqueIPs = new Set([
    ...filtered.map((p) => p.src),
    ...filtered.map((p) => p.dst),
  ]).size;
  const encPct = total ? Math.round((encCount / total) * 100) : 0;
  const isLive = !!selectedDevice;
  const last30 = filtered.slice(-30);
  const last12 = filtered.slice(-12).reverse();

  const lineData = {
    labels: last30.map((p) => new Date(p.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: "Plain",
        data: last30.map((p) => (!p.encrypted ? p.length : null)),
        borderColor: "#1d9e75",
        backgroundColor: "rgba(29,158,117,0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: "Encrypted",
        data: last30.map((p) => (p.encrypted ? p.length : null)),
        borderColor: "#d85a30",
        backgroundColor: "rgba(216,90,48,0.08)",
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
    ],
  };
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: "index", intersect: false },
    },
    scales: {
      x: { ticks: { color: "#a09f99" } },
      y: { ticks: { color: "#a09f99" } },
    },
  };

  const protocolCounts = filtered.reduce((acc, p) => {
    acc[p.protocol] = (acc[p.protocol] || 0) + 1;
    return acc;
  }, {});
  const protocolColors = {
    HTTP: "#1d9e75",
    HTTPS: "#d85a30",
    SSH: "#4a90e2",
    DNS: "#f5a623",
    TCP: "#50e3c2",
    UDP: "#bd10e0",
    ICMP: "#f8e71c",
    OTHER: "#9b9b9b",
  };
  const doughnutProtocolData = {
    labels: Object.keys(protocolCounts),
    datasets: [
      {
        data: Object.values(protocolCounts),
        backgroundColor: Object.keys(protocolCounts).map(
          (p) => protocolColors[p] || "#ccc",
        ),
        borderWidth: 0,
      },
    ],
  };
  const doughnutProtocolOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: { legend: { display: true, position: "right" } },
  };

  const doughnutEncryptedData = {
    labels: ["Encrypted", "Plain"],
    datasets: [
      {
        data: [encCount, plainCount],
        backgroundColor: ["#d85a30", "#1d9e75"],
        borderWidth: 0,
      },
    ],
  };
  const doughnutEncryptedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: { legend: { display: true, position: "right" } },
  };

  return (
    <div className="page">
      <div className="topbar">
        <div className="logo">
          <span className="dot" /> Packet Dashboard
        </div>
        <div className={`badge ${isLive ? "live" : ""}`}>
          {isLive && <span className="liveDot" />}
          {isLive ? `Capture on — ${selectedDevice}` : "Idle"}
        </div>
      </div>

      <div className="controls">
        <div className="ctrlGroup">
          <span className="label">Device</span>
          <select
            className="select"
            value={selectedDevice}
            onChange={handleDeviceChange}
          >
            <option value="">— select interface —</option>
            {devices.map((d) => (
              <option key={d.name} value={d.name}>
                {d.desc || d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="divider" />
        <div className="ctrlGroup">
          <span className="label">Filter IP</span>
          <input
            type="text"
            className="input"
            value={filterIP}
            onChange={(e) => setFilterIP(e.target.value)}
            placeholder="e.g. 192.168.1.1"
          />
          <select
            className="select"
            value={filterIP}
            onChange={(e) => setFilterIP(e.target.value)}
          >
            <option value="">All IPs</option>
            {ipList.map((ip) => (
              <option key={ip} value={ip}>
                {ip}
              </option>
            ))}
          </select>
        </div>
        <button className="btnClear" onClick={() => setFilterIP("")}>
          Show all
        </button>
        <button className="btnClear" onClick={togglePause}>
          {isPaused ? "Resume" : "Pause"}
        </button>
      </div>

      <div className="metrics">
        <div className="metricCard">
          <div className="metricLabel">Total packets</div>
          <div className="metricValue">{total}</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">Encrypted</div>
          <div className="metricValue">{encPct}%</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">Avg size</div>
          <div className="metricValue">{avgSize} B</div>
        </div>
        <div className="metricCard">
          <div className="metricLabel">Unique IPs</div>
          <div className="metricValue">{uniqueIPs}</div>
        </div>
      </div>

      <div className="chartsRow">
        <div className="card" style={{ height: 200 }}>
          <Line data={lineData} options={lineOptions} />
        </div>
        <div className="card" style={{ height: 200 }}>
          <Doughnut
            data={doughnutProtocolData}
            options={doughnutProtocolOptions}
          />
        </div>
        <div className="card" style={{ height: 200 }}>
          <Doughnut
            data={doughnutEncryptedData}
            options={doughnutEncryptedOptions}
          />
        </div>
      </div>

      <div className="tableCard">
        <div className="tableHeader">
          <span>Latest packets</span>
          <span>{total} packets</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table width="100%">
            <thead>
              <tr>
                <th>Time</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Protocol</th>
                <th>Length</th>
                <th>Encrypted</th>
              </tr>
            </thead>
            <tbody>
              {last12.length === 0 ? (
                <tr>
                  <td colSpan={6} className="emptyCell">
                    {selectedDevice
                      ? "No packets match filter"
                      : "Select device to start capture"}
                  </td>
                </tr>
              ) : (
                last12.map((p, i) => (
                  <tr
                    key={i}
                    style={{ cursor: "pointer" }}
                    onClick={() =>
                      setSelectedPacket(selectedPacket === p ? null : p)
                    }
                  >
                    <td>{new Date(p.timestamp).toLocaleTimeString()}</td>
                    <td>{p.src}</td>
                    <td>{p.dst}</td>
                    <td>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: "#e1f5ee",
                          color: "#0f6e56",
                          border: "1px solid #9fe1cb",
                        }}
                      >
                        {p.protocol}
                      </span>
                    </td>
                    <td>{p.length} B</td>
                    <td className={p.encrypted ? "enc-yes" : "enc-no"}>
                      {p.encrypted ? "Yes" : "No"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPacket && (
        <div className="tableCard">
          <div className="packetDetailPanel">
            <h3>Packet Details</h3>
            <table>
              <tbody>
                <tr>
                  <td>Time:</td>
                  <td>{new Date(selectedPacket.timestamp).toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Source IP:</td>
                  <td>{selectedPacket.src}</td>
                </tr>
                <tr>
                  <td>Destination IP:</td>
                  <td>{selectedPacket.dst}</td>
                </tr>
                <tr>
                  <td>Protocol:</td>
                  <td>{selectedPacket.protocol}</td>
                </tr>
                <tr>
                  <td>Length:</td>
                  <td>{selectedPacket.length} B</td>
                </tr>
                <tr>
                  <td>Encrypted:</td>
                  <td>{selectedPacket.encrypted ? "Yes" : "No"}</td>
                </tr>
                {selectedPacket.srcPort && (
                  <tr>
                    <td>Source Port:</td>
                    <td>{selectedPacket.srcPort}</td>
                  </tr>
                )}
                {selectedPacket.dstPort && (
                  <tr>
                    <td>Destination Port:</td>
                    <td>{selectedPacket.dstPort}</td>
                  </tr>
                )}
                {selectedPacket.flags && (
                  <tr>
                    <td>TCP Flags:</td>
                    <td>{JSON.stringify(selectedPacket.flags)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
