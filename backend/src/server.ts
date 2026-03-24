import cors from "cors";
import express from "express";

import { loadEnv } from "./config/loadEnv";
import { getSupabaseConfig } from "./config/supabase";
import readingsRouter from "./routes/readings";

loadEnv();

const app = express();
const port = Number(process.env.PORT ?? 3000);
const supabaseConfig = getSupabaseConfig();

app.use(cors());
app.use(express.json());
app.use("/api", readingsRouter);

app.get("/", (_req, res) => {
  res.send("Smart bandage backend is running");
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(
    `Readings store: ${supabaseConfig ? `supabase (${supabaseConfig.table})` : "memory"}`,
  );
});
