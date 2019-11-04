const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const exphdl = require("express-handlebars");
const mongoose = require("mongoose");
const passport = require("passport");
const favicon = require("express-favicon");
var global = {};
const PeerUser = require("./models/peeruser");

const PORT = process.env.PORT || 3000;

var app = express();
const http = require("http").createServer(app);
// socketio connection
var io = require("socket.io")(http);
const { ensureAuthenticated } = require("./helper/authenticate");

const url = require("./config/setup").mongoURL;
const secret = require("./config/setup").secret;
app.use(favicon(__dirname + "/public/favicon.png"));

// // middlewares for handlebars
app.engine("handlebars", exphdl({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

//Importing routes
const auth = require("./routes/api/auth");
const profile = require("./routes/api/profile");
const friends = require("./routes/api/friends");

// Middleware for bodyparser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Adding passport strategy
require("./strategy/passport_local")(passport);

//set static folder
app.use(express.static(path.join(__dirname, "public")));

// Express session midleware
app.use(
  session({
    secret: secret,
    resave: true,
    saveUninitialized: true
  })
);

//passport middleware
app.use(passport.initialize());
app.use(passport.session());

//using the routes
app.use("/api/auth", auth);
app.use("/api/profile", profile);
app.use("/api/friends", friends);

//conecting to db
mongoose
  .connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("DB connected successfully");
  })
  .catch(err => console.log("Error : " + err));

//home route
app.get("/", (req, res) => {
  var user = {};
  if (req.user) {
    res.redirect("/profile");
  } else res.render("home");
});

app.get("/profile", ensureAuthenticated, (req, res) => {
  var user = {};
  if (req.user) {
    user.isLoggedIn = true;
    user.initial = req.user.name.charAt(0).toLowerCase();
    user.name = req.user.name;
  }
  var uid = req.user._id;
  global[uid] = "";
  res.render("profile", { user });
  // socket code
  io.on("connection", socket => {
    // user connected (online)
    global[uid] = socket.id;
    PeerUser.findOneAndUpdate({ _id: uid }, { $set: { isonline: true } })
      .then(user => {})
      .catch(err => console.log(err));

    socket.on("disconnect", function() {
      console.log("user disconnected");
      for (let [uid, sid] of Object.entries(global)) {
        if (socket.id == sid) {
          delete global[uid];
          PeerUser.findOneAndUpdate({ _id: uid }, { $set: { isonline: false } })
            .then(user => {})
            .catch(err => console.log(err));
        }
      }
    });
    socket.on("join", function(data) {
      var uid = data.id;
      socket.join(uid, () => {
        // check if only two users in a room
        io.to(uid).emit("new_msg", { msg: "helloo..." }); // broadcast to everyone in the room
      });
    });
  });
});

http.listen(PORT, () => console.log("Server running at port 3000..."));
