const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { ensureAuthenticated } = require("../../helper/authenticate");

const PeerUser = require("../../models/peeruser");

// @type    - PUT
// @route   - /api/friends
// @desc    - adds new friend to the list
// @access  - PRIVATE
router.put("/", ensureAuthenticated, (req, res) => {
  var friend = req.body.uid;
  PeerUser.findOneAndUpdate(
    { _id: req.user._id, friends: { $ne: friend } },
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
  PeerUser.findOne({ _id: req.user.id }, "friends")
    .then(friendlist => {
      var updatedList = friendlist.friends.filter(friendId => {
        return friendId != uid;
      });
      PeerUser.updateOne(
        { _id: req.user.id },
        { $set: { friends: updatedList } }
      )
        .then(user => res.json(user))
        .catch(err => console.log(err));
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
      var friends = doc.friends;
      var tempArr = friends;
      PeerUser.find({ _id: { $in: tempArr } }, "_id name isonline email")
        .then(friendlist => res.json(friendlist))
        .catch();
    })
    .catch(err => console.log(err));
});

module.exports = router;
