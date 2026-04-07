import express from "express";
import http from "http";
import { Server } from "socket.io";
import pkg from "cap";
const { Cap, decoders } = pkg;
import cors from "cors";
import jwt from "jsonwebtoken";
import { savePackets } from "./src/controllers/packetsController.js";
import packetsRouter from "./src/routers/packetsRouter.js";
import usersRouter from "./src/routers/usersRouter.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use("/packets", packetsRouter);
app.use("/users", usersRouter);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PROTOCOL = decoders.PROTOCOL;

app.get("/devices", (req, res) => {
  const devices = Cap.deviceList().map((d) => ({
    name: d.name,
    desc: d.description,
  }));
  res.json(devices);
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  console.log("Client Count:", io.sockets.sockets.size);

  let c;
  let linkType;
  let ipSet = new Set();
  let packetBuffer = [];
  let paused = false;
  let currentUserId = null;

  const token = socket.handshake.auth?.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      currentUserId = decoded.id;
      console.log("User ID:", currentUserId);
    } catch (err) {
      console.log("Invalid token");
    }
  }

  socket.on("startCapture", ({ deviceName }) => {
    console.log("Start:", deviceName, "User:", currentUserId);

    if (!currentUserId) {
      console.log("No user → skip capture");
      return;
    }

    if (c) c.close();
    paused = false;

    const buffer = Buffer.alloc(65535);
    c = new Cap();

    try {
      linkType = c.open(deviceName, "ip", 10 * 1024 * 1024, buffer);
    } catch (err) {
      console.error("Open error:", err.message);
      return;
    }

    ipSet = new Set();
    packetBuffer = [];

    c.on("packet", () => {
      if (linkType !== "ETHERNET") return;

      const ret = decoders.Ethernet(buffer);

      if (ret.info.type === PROTOCOL.ETHERNET.IPV4) {
        const ip = decoders.IPV4(buffer, ret.offset);

        const src = ip.info.srcaddr;
        const dst = ip.info.dstaddr;

        let protocol = "OTHER";
        let encrypted = false;
        let srcPort, dstPort;

        if (ip.info.protocol === 6) {
          const tcp = decoders.TCP(buffer, ip.offset);
          srcPort = tcp.info.srcport;
          dstPort = tcp.info.dstport;

          if (srcPort === 443 || dstPort === 443) {
            protocol = "HTTPS";
            encrypted = true;
          } else if (srcPort === 80 || dstPort === 80) {
            protocol = "HTTP";
          } else {
            protocol = "TCP";
          }
        } else if (ip.info.protocol === 17) {
          const udp = decoders.UDP(buffer, ip.offset);
          srcPort = udp.info.srcport;
          dstPort = udp.info.dstport;
          protocol = "UDP";
        }

        ipSet.add(src);
        ipSet.add(dst);

        let payload = null;

        try {
          let dataOffset = null;

          switch (ip.info.protocol) {
            case 6: // TCP
              const tcp = decoders.TCP(buffer, ip.offset);
              dataOffset = tcp.offset;
              break;

            case 17: // UDP
              const udp = decoders.UDP(buffer, ip.offset);
              dataOffset = udp.offset;
              break;

            case 1: // ICMP
              const icmp = decoders.ICMP(buffer, ip.offset);
              dataOffset = icmp.offset;
              break;

            default:
              dataOffset = ip.offset;
              break;
          }

          if (dataOffset !== null) {
            payload = buffer
              .slice(dataOffset, dataOffset + 200)
              .toString("utf8")
              .replace(/\0/g, "");
          }
        } catch (e) {
          payload = null;
        }

        const method =
          payload && /^[A-Z]+ /.test(payload) ? payload.split(" ")[0] : null;

        packetBuffer.push({
          src,
          dst,
          protocol,
          length: ip.info.totallen,
          encrypted,
          timestamp: Date.now(),
          srcPort,
          dstPort,
          payload,
          method,
        });
      }
    });
  });

  socket.on("pauseCapture", () => (paused = true));
  socket.on("resumeCapture", () => (paused = false));

  const interval = setInterval(async () => {
    if (!paused && packetBuffer.length > 0) {
      const batch = packetBuffer;

      socket.emit("packetBatch", batch);
      socket.emit("ipList", Array.from(ipSet));

      if (currentUserId) {
        try {
          await savePackets(batch, currentUserId);
        } catch (err) {
          console.error("DB Save error:", err);
        }
      }

      packetBuffer = [];
    }
  }, 100);

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);
    clearInterval(interval);
    if (c) c.close();
  });
});

const PORT = 3000;
server.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`),
);
