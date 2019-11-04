var socket = io();
// global object to store loggedin user details
var $user = {};
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
