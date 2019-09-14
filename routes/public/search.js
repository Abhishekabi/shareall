const express = require('express');
const router = express.Router();

const Freelancer = require('../../models/freelancer');

// @type    - GET
// @route   - /public/search/
// @desc    - displays the user profile
// @access  - PUBLIC
router.get('/', (req, res) => {
  res.render('search');
});

router.post('/', (req, res) => {
  Freelancer.find(
    { works: { $regex: req.body.query, $options: '$i' } },
    { password: 0, profilepic: 0, date: 0 }
  )
    .then(freelancer => {
      if (!freelancer) {
        res.status(404).json({ usernotfound: 'No profiles here' });
      } else {
        console.log(freelancer);
        res.render('search', { query: req.body.query, freelancer });
      }
    })
    .catch(err => console.log(err));
});

module.exports = router;
