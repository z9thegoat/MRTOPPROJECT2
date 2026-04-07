import express from "express";
import http from "http";
import { Server } from "socket.io";
import pkg from "cap";
const { Cap, decoders } = pkg;
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PROTOCOL = decoders.PROTOCOL;

let c;
let linkType;
let ipSet = new Set();
let packetBuffer = [];
let paused = false;

/* ─── Device list ─── */
app.get("/devices", (req, res) => {
  const devices = Cap.deviceList().map((d) => ({
    name: d.name,
    desc: d.description,
  }));
  res.json(devices);
});

/* ─── Socket.IO ─── */
io.on("connection", (socket) => {
  console.log("Client connected");

  socket.on("startCapture", (deviceName) => {
    console.log("Starting capture on:", deviceName);
    if (c) c.close();
    paused = false;

    const filter = "ip";
    const bufSize = 10 * 1024 * 1024;
    const buffer = Buffer.alloc(65535);

    c = new Cap();
    try {
      linkType = c.open(deviceName, filter, bufSize, buffer);
    } catch (err) {
      console.error("Failed to open device:", err.message);
      return;
    }

    ipSet = new Set();
    packetBuffer = [];

    c.on("packet", (nbytes, trunc) => {
      if (linkType !== "ETHERNET") return;

      const ret = decoders.Ethernet(buffer);
      if (ret.info.type === PROTOCOL.ETHERNET.IPV4) {
        const ip = decoders.IPV4(buffer, ret.offset);
        const src = ip.info.srcaddr;
        const dst = ip.info.dstaddr;
        const protocolNum = ip.info.protocol;

        ipSet.add(src);
        ipSet.add(dst);

        let protocol = "OTHER";
        let encrypted = false;
        let srcPort, dstPort, flags;

        if (protocolNum === 6) {
          const tcp = decoders.TCP(buffer, ip.offset);
          srcPort = tcp.info.srcport;
          dstPort = tcp.info.dstport;
          flags = tcp.info.flags;

          if ([443].includes(srcPort) || [443].includes(dstPort)) {
            protocol = "HTTPS";
            encrypted = true;
          } else if ([80].includes(srcPort) || [80].includes(dstPort)) {
            protocol = "HTTP";
          } else if ([22].includes(srcPort) || [22].includes(dstPort)) {
            protocol = "SSH";
            encrypted = true;
          } else {
            protocol = "TCP";
          }
        } else if (protocolNum === 17) {
          const udp = decoders.UDP(buffer, ip.offset);
          srcPort = udp.info.srcport;
          dstPort = udp.info.dstport;
          if ([53].includes(srcPort) || [53].includes(dstPort)) protocol = "DNS";
          else protocol = "UDP";
        } else if (protocolNum === 1) {
          protocol = "ICMP";
        }

        packetBuffer.push({
          src,
          dst,
          protocol,
          length: ip.info.totallen,
          encrypted,
          timestamp: Date.now(),
          srcPort,
          dstPort,
          flags,
        });
      }
    });
  });

  socket.on("pauseCapture", () => {
    paused = true;
    console.log("Capture paused");
  });
  socket.on("resumeCapture", () => {
    paused = false;
    console.log("Capture resumed");
  });

  socket.on("disconnect", () => console.log("Client disconnected"));
});

setInterval(() => {
  if (!paused && packetBuffer.length > 0) {
    io.emit("packetBatch", packetBuffer);
    io.emit("ipList", Array.from(ipSet));
    packetBuffer = [];
  }
}, 100);

/* ─── Start server ─── */
const PORT = 3000;
server.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));