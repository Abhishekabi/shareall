const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");

// import models
const PeerUser = require("../models/peeruser");

module.exports = function(passport) {
  passport.use(
    new LocalStrategy({ usernameField: "email" }, (email, password, done) => {
      PeerUser.findOne({ email: email })
        .then(user => {
          if (!user) {
            console.log("incorrect user");
            return done(null, false, { error: "incorrect user" });
          }
          bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) throw err;
            if (isMatch) {
              console.log("login success");
              return done(null, user);
            } else {
              console.log("incorrect password");
              return done(null, false, { error: "incorrect password" });
            }
          });
        })
        .catch(err => console.log(err));
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    PeerUser.findById(id, (err, user) => {
      done(err, user);
    });
  });
};
