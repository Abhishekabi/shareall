const express = require("express");
const router = express.Router();
const { ensureAuthenticated } = require("../../helper/authenticate");

const PeerUser = require("../../models/peeruser");

// @type    - PUT
// @route   - /api/friends
// @desc    - adds new friend to the list
// @access  - PRIVATE
router.put("/", ensureAuthenticated, (req, res) => {
  var { uid, name, email } = req.body;
  var friend = { uid, name, email };
  PeerUser.findOneAndUpdate(
    { _id: req.user._id, "friends.uid": { $ne: friend.uid } },
    { $push: { friends: friend } },
    { useFindAndModify: false, new: true }
  )
    .then(user => {
      if (user == null) {
        res.json({ error: "User already added" });
      } else res.send(user.friends);
    })
    .catch(err => console.log(err));
});

// @type    - DELETE
// @route   - /api/friends
// @desc    - delete a friend based on uid
// @access  - PRIVATE
router.delete("/", ensureAuthenticated, (req, res) => {
  var { uid } = req.body;
  PeerUser.findOneAndUpdate(
    { _id: req.user.id },
    { $pull: { friends: { uid: uid } } },
    { useFindAndModify: false, new: true }
  )
    .then(friends => {
      res.send(friends);
    })
    .catch(err => console.log(err));
});

// @type    - GET
// @route   - /api/friends
// @desc    - gets the list of friends
// @access  - PRIVATE
router.get("/", ensureAuthenticated, (req, res) => {
  PeerUser.findOne({ _id: req.user.id }, "friends")
    .then(doc => {
      res.send(doc.friends);
    })
    .catch(err => console.log(err));
});

module.exports = router;
