const path = require("path");
const express = require("express");
const categoriesRouter = require("./routes/categories");
const generateRouter = require("./routes/generate");
const { shutdown } = require("./lib/pdfBuilder");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "200kb" }));
app.use("/api", categoriesRouter);
app.use("/api", generateRouter);
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
