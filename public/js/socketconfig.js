var socket = io();

// listening to incomming API calls to the room
socket.on("clientListening", data => {
  console.log(data);
  FileShareEventHandler.socketEvents[data.purpose](
    data.connectionId,
    data.param
  );
});
// listening for online status
socket.on("online", data => {
  FileShareImpl.updateOnlineStatus(data);
});
