var socket = io();
// global object to store loggedin user details
var $user = {};
var $fshare = {};
// get userId
$.ajax("/api/profile/me", {
  dataType: "json",
  success: function(data, status, xhr) {
    $user = data;
    var uid = data.uid;
    socket.emit("join", { id: uid });
  },
  error: function(jqXhr, textStatus, errorMessage) {
    console.log(errorMessage);
  }
});
socket.on("new_msg", data => {
  console.log(data.msg);
});
socket.on("online", data => {
  $user.friends.forEach(friend => {
    if (friend._id == data.uid) {
      var elem = $(`.right-pannel [uid=${data.uid}]`).find(".status");
      $fshare.currentChatUserId == data.uid
        ? elem.removeClass("status-offline")
        : elem.addClass("status-offline");
      var ele = $(`.contacts [uid=${data.uid}]`).find(".status");
      data.isonline
        ? ele.removeClass("status-offline")
        : ele.addClass("status-offline");
    }
  });
});
