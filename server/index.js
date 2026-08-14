const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const categoriesRouter = require("./routes/categories");
const generateRouter = require("./routes/generate");
const authRouter = require("./routes/auth");
const progressRouter = require("./routes/progress");
const { shutdown } = require("./lib/pdfBuilder");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "200kb" }));
app.use(cookieParser());
app.use("/api", categoriesRouter);
app.use("/api", generateRouter);
app.use("/api", authRouter);
app.use("/api", progressRouter);
app.use(express.static(path.join(__dirname, "..", "public")));

app.listen(PORT, () => {
  console.log(`Kriah assessment generator listening on http://localhost:${PORT}`);
});

async function gracefulShutdown() {
  await shutdown();
  process.exit(0);
}
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
