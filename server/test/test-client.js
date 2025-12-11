const { io } = require("socket.io-client");

const socket = io("http://localhost:3001");

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  socket.emit("joinRoom", {
    roomId: "ee08f170-162d-45d1-95b9-cc78433c0555",
    userId: "user2",
  });
});
socket.on("initial-state", (data) => {
  console.log("initial-state:", data);
});

socket.on("error", (err) => {
  console.log("error:", err);
});

socket.on("initial-state", (msg) => console.log("initial", msg));
socket.on("public-stroke", (msg) => console.log("public", msg));
socket.on("private-stroke", (msg) => console.log("private", msg));
