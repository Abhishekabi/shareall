// Helper function to authentication

module.exports = {
  ensureAuthenticated: function(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.json({
      error: "Unable to access private route without authentication"
    });
  }
};
