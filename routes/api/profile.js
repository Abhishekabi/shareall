const express = require("express");
const router = express.Router();
const { ensureAuthenticated } = require("../../helper/authenticate");

const PeerUser = require("../../models/peeruser");

// @type    - GET
// @route   - /api/profile
// @desc    - displays the user profile
// @access  - PUBLIC
router.get("/", ensureAuthenticated, (req, res) => {
  res.send("Login success");
});

module.exports = router;
