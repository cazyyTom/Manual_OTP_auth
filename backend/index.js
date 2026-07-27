// 1. Load env vars first — before any other import, so nothing reads process.env before it's populated
import "dotenv/config";

import { app } from "./app.js";
import connectDB from "./db/index.js";

const PORT = process.env.PORT || 8000;

// 2. Connect DB first, then listen — never accept requests before the DB is ready
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    // 3. Exit on DB failure — a process manager restarts it cleanly, don't limp along broken
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  });
