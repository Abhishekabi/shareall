// Helper function to authentication

module.exports = {
  ensureAuthenticated: function(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    console.log("not authenticated");

    res.redirect("/");
  }
};
