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
// @route   - /api/profile/search?email={email} || /api/profile/search?id={id}
// @desc    - for user search
// @access  - PUBLIC
router.get("/search", (req, res) => {
  var id = req.query.id;
  var email = req.query.email;
  var obj = {};
  if (id && id != null) obj = { _id: id };
  else obj = { email: email };
  PeerUser.findOne(obj, "_id name email isonline")
    .then(user => {
      if (!user || user.length <= 0) {
        res.json({ usernotfound: "No profiles here" });
      } else {
        res.json(user);
      }
    })
    .catch(err => console.log(err));
});

// @type    - GET
// @route   - /api/profile/fileshare
// @desc    - returns the user information
// @access  - PRIVATE
router.get("/fileshare", ensureAuthenticated, (req, res) => {
  var data = {
    credentials: {
      url: "turn:numb.viagenie.ca",
      credential: "muazkh",
      username: "webrtc@live.com"
    }
  };
  res.json(data);
});

module.exports = router;
