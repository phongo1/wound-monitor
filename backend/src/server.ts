import cors from "cors";
import express from "express";

import readingsRouter from "./routes/readings";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());
app.use("/api", readingsRouter);

app.get("/", (_req, res) => {
  res.send("Smart bandage backend is running");
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
