var _global = {}; // socketid vs uid
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const exphdl = require("express-handlebars");
const mongoose = require("mongoose");
const passport = require("passport");
const favicon = require("express-favicon");
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
  res.render("profile", { user });
});

// socket code
io.on("connection", socket => {
  socket.on("disconnect", () => {
    var disconnectedUid = helper.removeSocketById(socket.id);
    if (!helper.hasOtherSession(disconnectedUid)) {
      helper.setOnline(disconnectedUid, false, socket);
    }
  });

  socket.on("createRoom", data => {
    var uid = data.id;
    _global[socket.id] = uid;
    helper.setOnline(uid, true, socket);
    if (!io.nsps["/"].adapter.rooms["room-" + uid]) {
      socket.join("room-" + uid);
    }
  });

  socket.on("join", data => {
    var uid = data.id;
    if (io.nsps["/"].adapter.rooms["room-" + uid]) {
      if (io.nsps["/"].adapter.rooms["room-" + uid].length < 2) {
        socket.join("room-" + uid);
        console.log(io.nsps["/"].adapter.rooms);
      } else console.log("cannot enter room");
    }
  });

  socket.on("leaveRoom", data => {
    var uid = data.id;
    if (io.nsps["/"].adapter.rooms["room-" + uid]) {
      socket.leave("room-" + uid);
    }
  });

  socket.on("serverListening", data => {
    console.log(data);
    socket.broadcast.to(data.connectionId).emit("clientListening", data); // broadcast to everyone in the room
  });
});

var helper = {
  removeSocketById: function(socketId) {
    for (let [sid, uid] of Object.entries(_global)) {
      if (socketId == sid) {
        delete _global[socketId];
        return uid;
      }
    }
    console.log(_global);
  },

  hasOtherSession: function(userId) {
    for (let [sid, uid] of Object.entries(_global)) {
      if (uid == userId) return true;
    }
    return false;
  },

  setOnline: function(uid, isonline, socket) {
    PeerUser.findOneAndUpdate(
      { _id: uid },
      { $set: { isonline } },
      { useFindAndModify: false, new: true }
    )
      .then(user => {
        console.log(user.name + " is " + (isonline ? " online" : " offline"));
        socket.broadcast.emit("online", { uid, isonline });
      })
      .catch(err => console.log(err));
  }
};

http.listen(PORT, () => console.log("Server running at port 3000..."));
