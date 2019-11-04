const express = require("express");
const router = express.Router();
const { ensureAuthenticated } = require("../../helper/authenticate");

const PeerUser = require("../../models/peeruser");

// @type    - GET
// @route   - /api/profile
// @desc    - displays the user profile
// @access  - PRIVATE
router.get("/", ensureAuthenticated, (req, res) => {
  res.redirect("/profile");
});

// @type    - POST
// @route   - /api/profile/logout
// @desc    - for user logout
// @access  - PRIVATE
router.post("/logout", ensureAuthenticated, (req, res) => {
  req.logout();
  res.redirect("/");
});

// @type    - GET
// @route   - /api/profile/me
// @desc    - returns the user information
// @access  - PRIVATE
router.get("/me", ensureAuthenticated, (req, res) => {
  var data = {
    uid: req.user._id,
    name: req.user.name,
    email: req.user.email
  };
  res.json(data);
});

// @type    - GET
// @route   - /api/profile/search?key={email}
// @desc    - for user search
// @access  - PUBLIC
router.get("/search", (req, res) => {
  PeerUser.findOne({}, "_id name email isonline")
    .or([{ _id: req.query.key }, { email: req.query.key }])
    .then(user => {
      console.log(req.body.uid);
      console.log(user);
      if (!user || user.length <= 0) {
        res.json({ usernotfound: "No profiles here" });
      } else {
        res.json(user);
      }
    })
    .catch(err => console.log(err));
});

module.exports = router;
