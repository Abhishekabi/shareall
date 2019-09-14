const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const session = require("express-session");
const exphdl = require("express-handlebars");
const mongoose = require("mongoose");
const passport = require("passport");

const PORT = process.env.PORT || 3000;

var app = express();
const url = require("./config/setup").mongoURL;

// // middlewares for handlebars
// app.engine('handlebars', exphdl({ defaultLayout: 'main' }));
// app.set('view engine', 'handlebars');

//Importing routes
const auth = require("./routes/api/auth");
// const search = require("./routes/public/search");
const profile = require("./routes/api/profile");

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
    secret: "secret",
    resave: true,
    saveUninitialized: true
  })
);

//passport middleware
app.use(passport.initialize());
app.use(passport.session());

//using the routes
// app.use("/public/search", search);
app.use("/api/auth", auth);
app.use("/api/profile", profile);

//conecting to db
mongoose
  .connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("DB connected successfully");
  })
  .catch(err => console.log("Error : " + err));

//test route
app.get("/", (req, res) => {
  res.render("index");
});

app.listen(PORT, () => console.log("Server running at port 3000..."));
