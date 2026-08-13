const express = require("express");
const { getCategorySummaries, getDocumentTitle } = require("../lib/data");

const router = express.Router();

router.get("/categories", (req, res) => {
  res.json({
    title: getDocumentTitle(),
    categories: getCategorySummaries(),
  });
});

module.exports = router;
