var socket = io();
// get userId
$.ajax("/api/profile/info", {
  dataType: "json",
  success: function(data, status, xhr) {
    var uid = data._id;
    socket.emit("join", { id: uid });
  },
  error: function(jqXhr, textStatus, errorMessage) {
    console.log(errorMessage);
  }
});
socket.on("new_msg", data => {
  console.log(data.msg);
});
