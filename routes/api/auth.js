const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const { ensureAuthenticated } = require("../../helper/authenticate");

const PeerUser = require("../../models/peeruser");

// @type    - POST
// @route   - /api/auth/register
// @desc    - for new user signup
// @access  - PUBLIC
router.post("/register", (req, res) => {
  PeerUser.findOne({ email: req.body.email })
    .then(user => {
      if (user) {
        res.status(400).json({ emailerror: "Email is already registered" });
      } else {
        const newUser = new PeerUser({
          name: req.body.name,
          email: req.body.email,
          password: req.body.password
        });
        // encrypt the password
        bcrypt.genSalt(10, (err, salt) => {
          bcrypt.hash(newUser.password, salt, (err, hash) => {
            if (err) {
              console.log("Error : " + err);
            } else {
              newUser.password = hash;
              newUser
                .save()
                .then(user => res.json(user))
                .catch(err => console.log("Error : " + err));
            }
          });
        });
      }
    })
    .catch(err => console.log("Error : " + err));
});

// @type    - POST
// @route   - /api/auth/login
// @desc    - for freelancer login
// @access  - PUBLIC
router.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: "/api/profile",
    failureRedirect: "/",
    failureFlash: false
  })(req, res, next);
});

module.exports = router;
