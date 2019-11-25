var socket = io();
var fshareConnection;

// listening to incomming API calls to the room
socket.on("clientListening", data => {
  console.log(data);
  FileShareEventHandler.socketEvents[data.purpose](data.connId, data.param);
  // if (purpose == "offer") {
  //   fshareConnection = new FileShareRTCConnection(
  //     data.connId,
  //     $user.uid,
  //     FshareHandler,
  //     {
  //       url: "turn:numb.viagenie.ca",
  //       credential: "muazkh",
  //       username: "webrtc@live.com"s
  //     },
  //     false,
  //     data.param.sdp,
  //     data.param.candidate,
  //     null
  //   );
  // }
  // if (purpose == "answer") {
  //   // if(!this.isCurrentUser())
  //   // {
  //   // 	// to set sdp and answer in retry cases
  //   // 	fshareConnection.setRemoteDescriptionAndAnswer(type, remoteSdp, remoteIceCandidate);
  //   // }
  //   // else
  //   // {
  //   mainFshare.setRemoteDescription(
  //     "answer",
  //     data.param.sdp.sdp,
  //     data.param.candidate
  //   );
  //   // }
  // }
  // if (purpose == "updateice") {
  //   fshareConnection.setRemoteIcecandidate(data.param.candidate);
  // }
});
// listening for online status
socket.on("online", data => {
  FileShareImpl.updateOnlineStatus(data);
});
