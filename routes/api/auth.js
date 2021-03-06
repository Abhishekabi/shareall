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
        // change status code
        res.json({ emailerror: "Email is already registered" });
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
              console.log("Password Error : " + err);
            } else {
              newUser.password = hash;
              newUser
                .save()
                .then(user => res.redirect("/"))
                .catch(err => console.log("DB Error : " + err));
            }
          });
        });
      }
    })
    .catch(err => console.log("Error : " + err));
});

// @type    - POST
// @route   - /api/auth/login
// @desc    - for user login
// @access  - PUBLIC
// router.post("/login", passport.authenticate("local"), function(req, res) {
//   res.json({ message: "login successful" });
// });

router.post("/login", function(req, res, next) {
  passport.authenticate("local", function(err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.json({ message: info.error });
    }
    req.logIn(user, function(err) {
      if (err) {
        return next(err);
      }
      return res.redirect("/api/profile");
    });
  })(req, res, next);
});

module.exports = router;
