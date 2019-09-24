const express = require("express");
const router = express.Router();
const { ensureAuthenticated } = require("../../helper/authenticate");

const PeerUser = require("../../models/peeruser");

// @type    - GET
// @route   - /api/profile
// @desc    - displays the user profile
// @access  - PRIVATE
router.get("/", ensureAuthenticated, (req, res) => {
  res.redirect("/");
});

// @type    - POST
// @route   - /api/profile/logout
// @desc    - for user logout
// @access  - PRIVATE
router.post("/logout", ensureAuthenticated, (req, res) => {
  req.logout();
  res.redirect("/");
});

module.exports = router;
