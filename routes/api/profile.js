const express = require("express");
const router = express.Router();
const { ensureAuthenticated } = require("../../helper/authenticate");

const PeerUser = require("../../models/peeruser");

// @type    - GET
// @route   - /api/profile
// @desc    - displays the user profile
// @access  - PUBLIC
router.get("/", ensureAuthenticated, (req, res) => {
  res.redirect("/");
});

// @type    - get
// @route   - /api/profile/logout
// @desc    - for user logout
// @access  - PRIVATE
router.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

module.exports = router;
