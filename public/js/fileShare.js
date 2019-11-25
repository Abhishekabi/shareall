var FileShareSession = {};
var FileShareEventHandler = {};
var FileShare = {};

var FileShareSession = function(
  connectionId,
  senderId,
  receiverId,
  receiverName,
  files,
  metaData,
  turnCredentials
) {
  this._connectionId = connectionId;
  this._senderId = senderId;
  this._receiverId = receiverId;
  this._receiverName = receiverName;
  this._files = files;
  this._fileIndex = 0;
  this._metaData = metaData;

  this._turnCredentials = turnCredentials;
  this._rtcConnection = undefined;
  this._sessionTimer = undefined;

  this._initialize();
};

FileShareSession.prototype = {
  _initialize: function() {
    // this._sessionTimer = setTimeout(function()
    // {
    // 	FileShare.close(this._connectionId);
    // 	FileShare.removeSession(this._connectionId);
    // }.bind(this),30000);
  },

  getPeerUserId: function() {
    return this.isCurrentUser() ? this._receiverId : this._senderId;
  },

  isCurrentUser: function() {
    return this._senderId === $user.uid;
  },

  getSelectedFiles: function() {
    return this._files;
  },

  getMetaData: function() {
    return this._metaData;
  },

  getCurrentFileId: function() {
    return this._metaData[this._fileIndex].file_id;
  },

  getCurrentFileIndex: function() {
    return this._fileIndex;
  },

  updateFileIndex: function() {
    this._fileIndex += 1;
    return this._fileIndex;
  },

  getFileName: function() {
    return this._metaData[this._fileIndex].name;
  },

  getTotalFileSize: function() {
    var size = 0;
    this._metaData.forEach(function(file) {
      size += file.size;
    });
    return $Util.getFileSize(size);
  },

  initiateSession: function() {
    // clearTimeout(this._sessionTimer);
    // this._sessionTimer = undefined;
    this._rtcConnection = new FileShareRTCConnection(
      this._connectionId,
      this._senderId,
      FileShareEventHandler.peerConnectionEvents,
      this._turnCredentials,
      true,
      undefined,
      undefined,
      this._files
    );
  },

  setRemoteDescription: function(type, remoteSdp, remoteIceCandidate) {
    if (!this.isCurrentUser()) {
      // to set sdp and answer in retry cases
      this._rtcConnection.setRemoteDescriptionAndAnswer(
        type,
        remoteSdp,
        remoteIceCandidate
      );
    } else {
      this._rtcConnection.setRemoteDescription(
        type,
        remoteSdp,
        remoteIceCandidate
      );
    }
  },

  updateIceCandidates: function(remoteIceCandidate) {
    // ice candidates are generated even after the connection being closed
    if (this._rtcConnection) {
      this._rtcConnection.setRemoteIcecandidate(remoteIceCandidate);
    }
  },

  connectFileShareDownStream: function(remoteSdp, remoteIceCandidate) {
    // clearTimeout(this._sessionTimer);
    // this._sessionTimer = undefined;
    this._rtcConnection = new FileShareRTCConnection(
      this._connectionId,
      this._receiverId,
      FileShareEventHandler.peerConnectionEvents,
      this._turnCredentials,
      false,
      remoteSdp,
      remoteIceCandidate
    );
  },

  close: function() {
    // clearTimeout(this._sessionTimer);
    // this._sessionTimer = undefined;
    if (this._rtcConnection) {
      this._rtcConnection.close();
      this._rtcConnection = undefined;
    }
  },

  retryTransfer: function(fileId, chunkId) {
    for (var i = 0; i < this._metaData.length; i++) {
      if (this._metaData[i].file_id == fileId) {
        this._rtcConnection.retryFileShare(i, chunkId);
        return;
      }
    }
  }
};

// handler for fp2p
FileShareEventHandler = {
  peerConnectionEvents: {
    sendOffer: function(connectionId, sdp, iceCandidate, iceRestart) {
      FileShareAPI.sendSdp(
        connectionId,
        sdp,
        iceCandidate,
        iceRestart,
        "offer"
      );
    },

    sendAnswer: function(connectionId, sdp, iceCandidate, iceRestart) {
      FileShareAPI.sendSdp(
        connectionId,
        sdp,
        iceCandidate,
        iceRestart,
        "answer"
      );
    },

    handleConnected: function(connectionId, isReconnecting) {
      if (isReconnecting) {
        // FileShareImpl.updateReconnected(connectionId);
      }
    },

    updateIceCandidates: function(connectionId, iceCandidate, iceRestart) {
      FileShareAPI.updateCandidate(connectionId, iceCandidate, iceRestart);
    },

    handleFailed: function(connectionId) {
      // FileShareImpl.updateFailedState(connectionId);
    },

    handleRetry: function(connectionId, isOfferer, currentChunkId) {
      if (!isOfferer) {
        var fileShareSession = FileShare.getSession(this._connectionId);
        var fileIndex = fileShareSession.getCurrentFileIndex();
        var fileId = fileShareSession.getCurrentFileId(fileIndex);
        FileShareAPI.retry(connectionId, fileId, currentChunkId);
      }
    },

    handleSent: function(connectionId) {
      FileShareAPI.sendAcknowledgement(connectionId);
    }
  },

  socketEvents: {
    offer: function(connId, data) {
      var description = data.sdp;
      var sdp = description.sdp;
      var type = description.type;
      var isIceRestart = data.ice_restart;
      var fileShareSession = FileShare.getSession(connId);
      if (typeof fileShareSession !== "undefined") {
        var iceCandidates = data.ice_candidates;
        if (!isIceRestart) {
          fileShareSession.connectFileShareDownStream(sdp, iceCandidates);
        } else {
          fileShareSession._rtcConnection.setRemoteDescription(
            type,
            sdp,
            iceCandidates
          );
        }
      }
    },

    answer: function(connId, data) {
      var description = data.sdp;
      var sdp = description.sdp;
      var type = description.type;
      var isIceRestart = data.ice_restart;
      var fileShareSession = FileShare.getSession(connId);
      if (typeof fileShareSession !== "undefined") {
        var iceCandidates = data.ice_candidates;
        fileShareSession.setRemoteDescription(type, sdp, iceCandidates);
      }
    },

    accept: function(connId) {
      var fileShareSession = FileShare.getSession(connId);
      if (typeof fileShareSession !== "undefined") {
        // FileShareImpl.updateContent(connectionId);
        fileShareSession.initiateSession();
      }
    },

    decline: function(connId) {
      var fileShareSession = FileShare.getSession(connId);
      if (typeof fileShareSession !== "undefined") {
        // var receiverName = Users.getName(fileShareSession.getPeerUserId());
        // var text = Resource.getRealValue("fileshare.rejected",[receiverName]);
        // FileShareImpl.updateState(connectionId, text);
        // FileShareImpl.showFailedRipple(connectionId);
        // var elementId = fileShareSession.getCurrentFileShareElementId();
        // FileShareImpl.updateBtn(elementId);
        fileShareSession.close();
      }
    },

    updateicecandidates: function(connId, data) {
      var fileShareSession = FileShare.getSession(connId);
      if (typeof fileShareSession !== "undefined") {
        var iceCandidates = data.ice_candidates;
        fileShareSession.updateIceCandidates(iceCandidates);
      }
    },

    terminate: function(connId) {
      var connectionId = connId;
      FileShare.close(connectionId);
      FileShare.removeSession(connectionId);
    },

    new_session: function(connId, data) {
      var turnCredentials = data.turnCredentials;
      var connectionId = connId;
      var peer = data.peer;
      var peername = "";
      var metaData = data.files;

      var fileShareSession = new FileShareSession(
        connectionId,
        peer,
        $user.uid,
        peername,
        undefined,
        metaData,
        turnCredentials
      );
      FileShare.addSession(connectionId, fileShareSession);
      // var text = Resource.getRealValue("fileshare.sending",[peername, metaData.length]);
      // var elementId = fileShareSession.getCurrentFileShareElementId();
      // FileShareImpl.initialize(elementId, connectionId, text);
    },

    transfer_completed: function(connId) {
      FileShareAPI.terminate(connId);
      FileShare.close(connId);
      FileShare.removeSession(connId);
    },

    retry: function(connId, data) {
      var fileId = data.file_id;
      var lastChunkId = data.last_chunk_id;
      var fileShareSession = FileShare.getSession(connId);
      if (typeof fileShareSession !== "undefined") {
        fileShareSession.retryTransfer(fileId, lastChunkId);
      }
    }
  },

  UIEvents: {
    acceptFileShare: function(connectionId) {
      // FileShareImpl.updateContent(connectionId);
      FileShareAPI.accept(connectionId);
    },

    closeFileShare: function(connectionId) {
      // var elementId = FileShare.getSession(connectionId).getCurrentFileShareElementId();
      // FileShareImpl.removeUI($("#file"+elementId));
      FileShareAPI.terminate(connectionId);
    },

    rejectFileShare: function(connectionId) {
      // var elementId = FileShare.getSession(connectionId).getCurrentFileShareElementId();
      // FileShareImpl.removeUI($("#file"+elementId));
      FileShareAPI.decline(connectionId);
    }
  }
};

FileShare = {
  BYTES_PER_CHUNK: 16384, // Constant chunk size (16 * 1024)

  _activeSessions: {}, // Holds all the fileShare session objects

  getSession: function(connectionId) {
    return this._activeSessions[connectionId];
  },

  removeSession: function(connectionId) {
    var fileShareSession = FileShare.getSession(connectionId);
    if (typeof fileShareSession !== "undefined") {
      // remove UI
      FileShare.resetForm(fileShareSession.isCurrentUser());
      delete this._activeSessions[connectionId];
    }
  },

  addSession: function(connectionId, fileShareObj) {
    this._activeSessions[connectionId] = fileShareObj;
  },

  initiate: function(recipiant, selectedFiles) {
    var metaData = this.constructMetaData(selectedFiles);
    FileShareAPI.startFileShare(selectedFiles, recipiant, metaData);
  },

  close: function(connectionId) {
    var fileShareSession = FileShare.getSession(connectionId);
    if (typeof fileShareSession !== "undefined") {
      fileShareSession.close();
    }
  },

  startSession: function(resp, recipant, selectedFiles) {
    var connectionId = resp.connId;
    var metaData = resp.files;
    var peername = " ";
    var turnCredentials = resp.data;

    var fileShareSession = new FileShareSession(
      connectionId,
      $user.uid,
      recipant,
      peername,
      selectedFiles,
      metaData,
      turnCredentials
    );
    FileShare.addSession(connectionId, fileShareSession);

    // var elementId = fileShareSession.getCurrentFileShareElementId();
    // var text = Resource.getRealValue("fileshare.waiting",[peername,metaData.length]);
    // FileShareImpl.initialize(elementId, connectionId, text);

    // if($DB.get("contacts")[recipant].status == $zcg.OFFLINE)
    // {
    // 	var text = Resource.getRealValue("fileshare.useroffline");
    // 	FileShareImpl.updateState(connectionId, text);
    // 	FileShareImpl.showFailedRipple(connectionId);
    // }
  },

  constructMetaData: function(files) {
    var metaData = [];

    for (var i = 0; i < files.length; i++) {
      metaData.push({ name: files[i].name, size: files[i].size });
    }
    return metaData;
  },

  getUserSessionCount: function(receiverId) {
    var sessions = this._activeSessions;
    var count = 0;
    for (var id in sessions) {
      var session = sessions[id];
      if (session.getPeerUserId() == receiverId) {
        count++;
      }
    }
    return count;
  },

  hasExceededFileShareLimit: function(receiverId) {
    return this.getUserSessionCount(receiverId) >= 2;
  },

  resetForm: function(isCurrentUser) {
    if (isCurrentUser) $("#file-upload").val("");
  }
};

FileShareAPI = {
  accept: function(connectionId) {
    socket.emit("serverListening", {
      connectionId,
      purpose: "accept",
      param: { connectionId }
    });
  },

  decline: function(connectionId) {
    socket.emit("serverListening", {
      connectionId,
      purpose: "decline",
      param: { connectionId }
    });
  },

  terminate: function(connectionId) {
    socket.emit("serverListening", {
      connectionId,
      purpose: "terminate",
      param: { connectionId }
    });
  },

  sendAcknowledgement: function(connectionId) {
    socket.emit("serverListening", {
      connectionId,
      purpose: "transfer_completed",
      param: { connectionId }
    });
  },

  retry: function(connectionId, fileId, currentChunkId) {
    socket.emit("serverListening", {
      connectionId,
      purpose: "retry",
      param: {
        connectionId,
        data: { file_id: fileId, last_chunk_id: currentChunkId }
      }
    });
  },

  updateCandidate: function(connectionId, ice_candidates, iceRestart) {
    socket.emit("serverListening", {
      connectionId,
      purpose: "updateicecandidates",
      param: { ice_candidates, iceRestart }
    });
  },

  sendSdp: function(connectionId, sdp, ice_candidates, iceRestart, type) {
    socket.emit("serverListening", {
      connectionId,
      purpose: type,
      param: { sdp, ice_candidates, iceRestart }
    });
  },

  startFileShare: function(selectedFiles, peer, metaData) {
    $.ajax({
      url: "/api/profile/fileshare",
      type: "GET",
      dataType: "json",
      success: function(res) {
        var connectionId = "room-" + peer;
        var turnCredentials = res.credentials;
        socket.emit("serverListening", {
          connectionId,
          purpose: "new_session",
          param: { turnCredentials, peer, files: metaData }
        });
        FileShare.startSession(
          { connId: connectionId, data: turnCredentials, files: metaData },
          peer,
          selectedFiles
        );
      }
    });
  }
};
