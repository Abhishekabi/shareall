// Helper function to authentication

module.exports = {
  ensureAuthenticated: function(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.send("Error : Unable to access this route without authentication");
  }
};
