// This file contains all the basic utility methods
var $Util = {};

$Util = {
  isValidEmailId: function (email) {
    var emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
    return emailPattern.test(email);
  },
};
