var FileShareSession = {};
var FileShareEventHandler = {};
var FileShare = {};
var FileShareAPI = {};
var FileShareImpl = {};
var FileShareConstants = {};
var FileSystemAPI = {};

FileShareConstants = {
  progressStates: {
    WAITING: "waiting", //NO I18N
    DOWNLOADING: "downloading", //NO I18N
    COMPLETED: "completed", //NO I18N
    FAILED: "failed", //NO I18N
  },

  UIConstants: {
    wrapperWidth: 430,
    wrapperHeight: 170,
    wrapperMargin: 10,
    wrapperTop: 60,
  },

  endCase: {
    BROWSER_INCOMPATIBILITY: "browser_incompatibility", //NO I18N
    QUOTA_EXCEEDED: "quota_exceeded", //NO I18N
    NO_RESPONSE: "no_response", //NO I18N
    NETWORK_ERROR: "network_error", //NO I18N
  },

  reconnectionAttempts: 3,

  waitingTimeLimit: 120 * 1000,
  closeUITimeLimit: 3 * 1000,
  reconnectionInterval: 30 * 1000,
  filesLimit: 10,
  fileSharesLimit: 2,
};

FileShareSession = function (
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
  this._isValidSession = false;

  this._fileIdVsFile = {}; // fileId vs File object
  this._fileSystemAPI = {}; // fileId vs FileSystemAPI object

  this._turnCredentials = turnCredentials;
  this._rtcConnection = undefined;
  this._sessionTimer = undefined;
  this._closeUITimer = undefined;
  this._clearFileSystemTimer = undefined;

  this._initialize();
};

FileShareSession.prototype = {
  _initialize: function () {
    if (this.isCurrentUser()) {
      for (var i = 0; i < this._files.length; i++) {
        this._fileIdVsFile[this._metaData[i].file_id] = this._files[i];
      }
    }
    this._sessionTimer = setTimeout(
      function () {
        FileShareAPI.terminate(
          this._connectionId,
          FileShareConstants.endCase.NO_RESPONSE
        );
      }.bind(this),
      FileShareConstants.waitingTimeLimit
    );
  },

  getPeerUserId: function () {
    return this.isCurrentUser() ? this._receiverId : this._senderId;
  },

  getReceiverName: function () {
    return this._receiverName;
  },

  getSenderId: function () {
    return this._senderId;
  },

  isCurrentUser: function () {
    return this._senderId === $user.uid;
  },

  getSelectedFiles: function () {
    return this._fileIdVsFile;
  },

  getMetaData: function () {
    return this._metaData;
  },

  getFileIdList: function () {
    var fileListOrder = [];
    this._metaData.forEach(function (file) {
      fileListOrder.push(file.file_id);
    });
    return fileListOrder;
  },

  getFileIndex: function (fileId) {
    for (var i = 0; i < this._metaData.length; i++) {
      if (this._metaData[i].file_id == fileId) {
        return i;
      }
    }
  },

  updateFileListOrder: function (oldPos, newPos) {
    var fileToBeUpdated = this._metaData.splice(oldPos, 1);
    this._metaData.splice(newPos, 0, fileToBeUpdated[0]);
  },

  getCurrentFileId: function () {
    return this._metaData[this._fileIndex].file_id;
  },

  getCurrentFileIndex: function () {
    return this._fileIndex;
  },

  updateFileIndex: function (index) {
    this._fileIndex =
      typeof index !== "undefined" ? index : this._fileIndex + 1; //NO I18N
    return this._fileIndex;
  },

  setAsValidSession: function () {
    this._isValidSession = true;
  },

  isValidSession: function () {
    return this._isValidSession;
  },

  getFilesCount: function () {
    return this._metaData.length;
  },

  getCurrentFileDetail: function () {
    return this._metaData[this._fileIndex];
  },

  getFileName: function () {
    return this._metaData[this._fileIndex].name;
  },

  getFileId: function () {
    return this._metaData[this._fileIndex].file_id;
  },

  getFileSize: function () {
    return this._metaData[this._fileIndex].size;
  },

  getTotalFileSize: function () {
    var size = 0;
    this._metaData.forEach(function (file) {
      size += file.size;
    });
    return (size / 1024 / 1024).toFixed(2) + "MB";
  },

  removeFile: function (fileId) {
    var fileIndex = this._fileIndex;
    this._metaData.forEach(function (file, index) {
      if (fileId == file.file_id) {
        fileIndex = index;
      }
    });

    this._metaData.splice(fileIndex, 1);
    if (typeof this._files !== "undefined") {
      delete this._fileIdVsFile[fileId];
    }
  },

  getEstimatedTime: function () {
    var totalSize = this._metaData.reduce(function (acc, file) {
      return acc + file.size;
    }, 0);

    //Assuming average download speed of 8mbps
    var estimatedTime = (totalSize / (8 * 1024 * 1024)) * 1000;

    var time =
      estimatedTime > 60 * 1000
        ? $Date.getRelativeTimeString(Date.now() + estimatedTime, {
            shorten: false,
          })
        : "Less than a minute";
    return `${time} at 8 MB/s`;
  },

  initiateFileSystem: function (fileSize, fileId) {
    this._fileSystemAPI[fileId] = new FileSystemAPI(this._connectionId);
    this.getFileSystemAPI(fileId).requestStorageSpace(fileSize, fileId);
  },

  getFileSystemAPI: function (fileId) {
    return this._fileSystemAPI[fileId];
  },

  writeToFileSystem: function (fileId, data, position) {
    this.getFileSystemAPI(fileId).writeChunk(
      fileId,
      new Blob([data]),
      position
    );
  },

  downloadFromFileSystem: function (fileId, fileName) {
    return this.getFileSystemAPI(fileId).downloadFile(fileId, fileName);
  },

  initiateSession: function () {
    this.clearSessionTimer();
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

  clearSessionTimer: function () {
    clearTimeout(this._sessionTimer);
    this._sessionTimer = undefined;
  },

  setRemoteDescription: function (type, remoteSdp, remoteIceCandidate) {
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

  updateIceCandidates: function (remoteIceCandidate) {
    // ice candidates are generated even after the connection being closed
    if (this._rtcConnection) {
      this._rtcConnection.setRemoteIcecandidate(remoteIceCandidate);
    }
  },

  connectFileShareDownStream: function (remoteSdp, remoteIceCandidate) {
    this.clearSessionTimer();
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

  close: function () {
    this.clearSessionTimer();
    clearTimeout(this._clearFileSystemTimer);
    this._clearFileSystemTimer = setTimeout(
      function () {
        FileShare.clearFileSystem(this._connectionId, this._metaData);
      }.bind(this),
      60000
    );
    if (this._rtcConnection) {
      this._rtcConnection.close();
      this._rtcConnection = undefined;
    }
  },

  retryTransfer: function (fileId, chunkId) {
    for (var i = 0; i < this._metaData.length; i++) {
      if (this._metaData[i].file_id == fileId) {
        this._rtcConnection.retryFileShare(i, chunkId);
        return;
      }
    }
  },

  setCloseUITimer: function () {
    clearTimeout(this._closeUITimer);
    this._closeUITimer = setTimeout(
      function () {
        FileShare.removeSession(this._connectionId);
      }.bind(this),
      FileShareConstants.closeUITimeLimit
    );
  },
};

// handler for fp2p
FileShareEventHandler = {
  peerConnectionEvents: {
    sendOffer: function (connectionId, sdp, iceCandidate, iceRestart) {
      FileShareAPI.sendSdp(
        connectionId,
        sdp,
        iceCandidate,
        iceRestart,
        "offer"
      );
    },

    sendAnswer: function (connectionId, sdp, iceCandidate, iceRestart) {
      FileShareAPI.sendSdp(
        connectionId,
        sdp,
        iceCandidate,
        iceRestart,
        "answer"
      );
    },

    handleConnected: function (connectionId, isReconnecting) {
      if (isReconnecting) {
        FileShareImpl.updateReconnected(connectionId);
      }
    },

    updateIceCandidates: function (connectionId, iceCandidate, iceRestart) {
      FileShareAPI.updateCandidate(connectionId, iceCandidate, iceRestart);
    },

    handleFailed: function (connectionId) {
      FileShareAPI.terminate(
        connectionId,
        FileShareConstants.endCase.NETWORK_ERROR
      );
    },

    handleNetworkError: function (connectionId) {
      FileShareImpl.updateState(connectionId, "Network busy...");
    },

    handleRetry: function (connectionId, isOfferer, currentChunkId) {
      var fileShareSession = FileShare.getSession(connectionId);
      if (!isOfferer && typeof fileShareSession !== "undefined") {
        var fileId = fileShareSession.getCurrentFileId();
        FileShareAPI.retry(connectionId, fileId, currentChunkId);
      }
    },

    handleTransferCompleted: function (connectionId) {
      FileShareAPI.sendAcknowledgement(connectionId, "transfer_completed");
    },

    handleFileSystemWrite: function (connectionId, dataChunk, chunkId) {
      var fileShareSession = FileShare.getSession(connectionId);
      fileShareSession.writeToFileSystem(
        fileShareSession.getFileId(),
        dataChunk,
        chunkId * FileShare.BYTES_PER_CHUNK
      );
    },
  },

  socketEvents: {
    offer: function (connId, data) {
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
      } else {
        // Remove the session object in-case of multiple tabs
        FileShare.removeSession(connId);
      }
    },

    answer: function (connId, data) {
      var description = data.sdp;
      var sdp = description.sdp;
      var type = description.type;
      var fileShareSession = FileShare.getSession(connId);
      if (typeof fileShareSession !== "undefined") {
        var iceCandidates = data.ice_candidates;
        fileShareSession.setRemoteDescription(type, sdp, iceCandidates);
      }
    },

    accept: function (connId) {
      var fileShareSession = FileShare.getSession(connId);
      if (typeof fileShareSession !== "undefined") {
        FileShareImpl.updateContent(connId);
        fileShareSession.initiateSession();
      }
    },

    decline: function (connId) {
      var fileShareSession = FileShare.getSession(connId);
      if (typeof fileShareSession !== "undefined") {
        var receiverName = fileShareSession.getPeerUserName();
        FileShareImpl.updateFailedState(
          connId,
          `${receiverName} has rejected the fileshare`
        );
        fileShareSession.close();
        fileShareSession.setCloseUITimer();
      }
    },

    updateicecandidates: function (connId, data) {
      var fileShareSession = FileShare.getSession(connId);
      if (
        typeof fileShareSession !== "undefined" &&
        fileShareSession.isValidSession()
      ) {
        var iceCandidates = data.ice_candidates;
        fileShareSession.updateIceCandidates(iceCandidates);
      }
    },

    terminate: function (connId) {
      var connectionId = connId;
      FileShare.close(connectionId);
      FileShare.removeSession(connectionId);
    },

    new_session: function (connId, data) {
      var turnCredentials = data.turnCredentials;
      var connectionId = connId;
      var peer = data.peer;
      var peername = "";
      var metaData = data.files;
      FileShareAPI.sendAcknowledgement(connectionId, "share_initiated"); //NO I18N

      var fileShareSession = new FileShareSession(
        connectionId,
        peer,
        $user.uid,
        peername,
        undefined,
        metaData,
        turnCredentials
      );
      FileShare.addSession(connectionId, fileShareSession, peer);
      // create filesystem here
      FileShare.assignFileShareMethod(connectionId, metaData);
      FileShare.notifyPeer(peer, peername, "FileShare incomming");
      FileShareImpl.initiateShare(
        connectionId,
        `${peername} is sending ${metaData.length} files...`
      );
    },

    transfer_completed: function (connId) {
      var fileShareSession = FileShare.getSession(connId);
      if (typeof fileShareSession !== "undefined") {
        // FileShare.notifyPeer(peer, peerName, "FileShare incomming");
        FileShareAPI.terminate(connId);
        FileShare.close(connId);
        FileShare.removeSession(connId);
      }
    },

    share_initiated: function (msgObj) {
      var connectionId = msgObj.share_id;
      var fileShareSession = FileShare.getSession(connectionId);
      if (typeof fileShareSession !== "undefined") {
        var text = `Waiting for ${fileShareSession.getReceiverName()} to accept files`;
        FileShareImpl.updateState(connectionId, text);
      }
    },

    retry: function (connId, data) {
      var fileId = data.file_id;
      var lastChunkId = data.last_chunk_id;
      var fileShareSession = FileShare.getSession(connId);
      if (typeof fileShareSession !== "undefined") {
        fileShareSession.retryTransfer(fileId, lastChunkId);
      }
    },
  },

  UIEvents: {
    acceptFileShare: function (connectionId) {
      var fileShareSession = FileShare.getSession(connectionId);
      FileShareImpl.updateContent(connectionId);
      FileShareImpl.updateBtn(connectionId);
      FileShareAPI.accept(connectionId);
      fileShareSession.clearSessionTimer();
      fileShareSession.setAsValidSession();
    },

    closeFileShare: function (connectionId) {
      $(`[shareId=${connectionId}]`).remove();
      FileShareAPI.terminate(connectionId);
    },

    rejectFileShare: function (connectionId) {
      var fileShareSession = FileShare.getSession(connectionId);
      $(`[shareId=${connectionId}]`).remove();
      fileShareSession.clearSessionTimer();
      FileShareAPI.decline(connectionId);
      FileShare.close(connectionId);
      FileShare.removeSession(connectionId);
    },
  },
};

FileShare = {
  BYTES_PER_CHUNK: 16384, // Constant chunk size (16 * 1024)

  FS_ROOT_DIR: "shareall/",

  filesInFileSystem: [], // To store fileId that are in filesystem

  _activeSessions: {}, // Holds all the fileShare session objects

  P2P_MAX_FILE_SIZE: 1.5 * 1024 * 1024 * 1024, // Temporarily support share upto 1.5GB as browser memory cannot have large files

  getSession: function (connectionId) {
    return this._activeSessions[connectionId];
  },

  removeSession: function (connectionId) {
    var fileShareSession = FileShare.getSession(connectionId);
    if (typeof fileShareSession !== "undefined") {
      fileShareSession.clearSessionTimer();
      this.stopNotification();
      $(`[shareId=${connectionId}]`).remove();
      FileShare.resetForm(fileShareSession.isCurrentUser());
      delete this._activeSessions[connectionId];
    }
  },

  addSession: function (connectionId, fileShareObj) {
    this._activeSessions[connectionId] = fileShareObj;
  },

  initiate: function (recipiant, selectedFiles) {
    var metaData = this.constructMetaData(selectedFiles);
    FileShareAPI.startFileShare(selectedFiles, recipiant, metaData);
  },

  close: function (connectionId) {
    var fileShareSession = FileShare.getSession(connectionId);
    if (typeof fileShareSession !== "undefined") {
      FileShare.resetForm(fileShareSession.isCurrentUser());
      fileShareSession.close();
      this.stopNotification();
    }
  },

  startSession: function (resp, recipant, selectedFiles) {
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
    FileShareImpl.initiateShare(
      connectionId,
      `waiting for ${peername} to accept ${metaData.length} files...`
    );
  },

  constructMetaData: function (files) {
    var metaData = [];

    for (var i = 0; i < files.length; i++) {
      metaData.push({
        name: files[i].name,
        size: files[i].size,
        type: files[i].type,
      });
    }
    return metaData;
  },

  getUserSessionCount: function (receiverId) {
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

  hasExceededFileShareLimit: function (receiverId) {
    return (
      this.getUserSessionCount(receiverId) >= FileShareConstants.fileSharesLimit
    );
  },

  resetForm: function (isCurrentUser) {
    if (isCurrentUser) $("#file-upload").val("");
  },

  notifyPeer: function (peerId, peerName, notifyContent) {},

  stopNotification: function () {},

  assignFileShareMethod: function (connectionId, files) {
    var fileShareSession = FileShare.getSession(connectionId);
    for (var i = 0; i < files.length; i++) {
      var fileSize = files[i].size;
      var fileId = files[i].file_id;
      if (FileShare.isFileSystemNeeded(fileSize)) {
        if (!FileShare.isFileSystemSupported()) {
          // FileSystem API supported only in chrome as of now
          FileShareAPI.terminate(
            connectionId,
            FileShareConstants.endCase.BROWSER_INCOMPATIBILITY
          );
          return;
        }
        fileShareSession.initiateFileSystem(fileSize, fileId);
        FileShare.filesInFileSystem.push(fileId);
      }
    }
  },

  clearFileSystemDirectory: function () {
    if (FileShare.isFileSystemSupported()) {
      window.requestFileSystem =
        window.requestFileSystem || window.webkitRequestFileSystem;
      window.requestFileSystem(window.TEMPORARY, 100, function (fileSystem) {
        fileSystem.root.getDirectory(
          FileShare.FS_ROOT_DIR,
          { create: false },
          function (dirEntry) {
            // Reader to read files from root directory
            var dirReader = dirEntry.createReader();
            dirReader.readEntries(function (entries) {
              entries.forEach(function (entry) {
                entry.file(function (details) {
                  var fileId = details.name;
                  var lastModifiedDate = new Date(details.lastModified);
                  var currentDate = new Date(Date.now());
                  var noOfDaysInFileSystem = new Date(
                    currentDate - lastModifiedDate
                  ).getDate();
                  // Fallback to clear the files that persist more than a day
                  if (noOfDaysInFileSystem > 1) {
                    FileShare.removeFileFromFileSystem(fileId);
                  }
                });
              });
            });
          }
        );
      });
    }
  },

  clearFileSystem: function (connectionId, files) {
    if (FileShare.isFileSystemSupported()) {
      for (var i = 0; i < files.length; i++) {
        this.removeFileFromFileSystem(files[i].file_id);
      }
    }
  },

  removeFileFromFileSystem: function (fileId) {
    var index = FileShare.filesInFileSystem.indexOf(fileId);
    window.requestFileSystem =
      window.requestFileSystem || window.webkitRequestFileSystem;
    window.requestFileSystem(window.TEMPORARY, 100, function (fileSystem) {
      fileSystem.root.getFile(
        FileShare.FS_ROOT_DIR + fileId,
        { create: false },
        function (fileEntry) {
          fileEntry.remove(function () {
            return FileShare.filesInFileSystem.splice(index, 1);
          });
        }
      );
    });
  },

  handleUnload: function () {
    FileShare.clearFileSystemDirectory();
  },

  isFileSystemNeeded: function (size) {
    return size > FileShare.P2P_MAX_FILE_SIZE;
  },

  isFileSystemSupported: function () {
    return window.requestFileSystem || window.webkitRequestFileSystem;
  },

  downloadFromURL: function (url, fileName) {
    // automatically downloads the file
    var link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, view: window })
    ); //NO I18N
    link.remove();
    URL.revokeObjectURL(link.href);
  },
};

FileShareAPI = {
  accept: function (connectionId) {
    socket.emit("serverListening", {
      connectionId,
      purpose: "accept",
      param: { connectionId },
    });
  },

  decline: function (connectionId) {
    socket.emit("serverListening", {
      connectionId,
      purpose: "decline",
      param: { connectionId },
    });
  },

  terminate: function (connectionId) {
    FileShare.close(connectionId);
    FileShare.removeSession(connectionId);
    socket.emit("serverListening", {
      connectionId,
      purpose: "terminate",
      param: { connectionId },
    });
  },

  sendAcknowledgement: function (connectionId, ack_type, fileId) {
    if (typeof fileId !== "undefined") {
      data.file_id = fileId;
    }
    socket.emit("serverListening", {
      connectionId,
      purpose: ack_type,
      param: typeof data !== "undefined" ? data : null,
    });
  },

  retry: function (connectionId, fileId, currentChunkId) {
    socket.emit("serverListening", {
      connectionId,
      purpose: "retry",
      param: {
        connectionId,
        data: { file_id: fileId, last_chunk_id: currentChunkId },
      },
    });
  },

  updateCandidate: function (connectionId, ice_candidates, iceRestart) {
    socket.emit("serverListening", {
      connectionId,
      purpose: "updateicecandidates",
      param: { ice_candidates, iceRestart },
    });
  },

  sendSdp: function (connectionId, sdp, ice_candidates, iceRestart, type) {
    socket.emit("serverListening", {
      connectionId,
      purpose: type,
      param: { sdp, ice_candidates, iceRestart },
    });
  },

  startFileShare: function (selectedFiles, peer, metaData) {
    $.ajax({
      url: "/api/profile/fileshare",
      type: "GET",
      dataType: "json",
      success: function (res) {
        var connectionId = "room-" + peer;
        var turnCredentials = res.credentials;
        socket.emit("serverListening", {
          connectionId,
          purpose: "new_session",
          param: { turnCredentials, peer: $user.uid, files: metaData },
        });
        FileShare.startSession(
          { connId: connectionId, data: turnCredentials, files: metaData },
          peer,
          selectedFiles
        );
      },
    });
  },
};

FileShareImpl = {
  initiateShare: function (connId, text) {
    var fileShareSession = FileShare.getSession(connId);
    var html = FileShareTemplate.shareProgress(
      connId,
      fileShareSession.getFileName(),
      text,
      fileShareSession.getTotalFileSize(),
      fileShareSession.isCurrentUser()
    );
    $("body").append(html);
    $(`[shareId=${connId}]`).draggable({
      containment: "window",
    });
    this.bindButtonEvents(connId);
  },
  bindButtonEvents: function (shareId) {
    var ele = $(`[shareId=${shareId}]`);
    ele
      .find("#cancelBtn")
      .on("click", () =>
        FileShareEventHandler.UIEvents.closeFileShare(shareId)
      );
    ele
      .find("#acceptBtn")
      .on("click", () =>
        FileShareEventHandler.UIEvents.acceptFileShare(shareId)
      );
    ele
      .find("#declineBtn")
      .on("click", () =>
        FileShareEventHandler.UIEvents.rejectFileShare(shareId)
      );
    // Clears existing files in FileSystem when page loads
    FileShare.clearFileSystemDirectory();
  },
  updateContent: function (shareId) {
    var fileShareSession = FileShare.getSession(shareId);
    var ele = $(`[shareId=${shareId}]`);
    var state = fileShareSession.isCurrentUser()
      ? "Sending Files..."
      : "Receiving Files...";
    this.updateState(shareId, state);
    ele.find(".file-name").after(`<div class="main-bar">
                                    <span class="sub-bar" style="width: 0%;"></span>
                                  </div>`);
  },
  updateProgressBar: function (shareId, sentChunks, totalChunks) {
    var ele = $(`[shareId=${shareId}]`);
    var percentage = (sentChunks / totalChunks) * 100;
    ele
      .find(".progressbar > .share-percentage")
      .text(percentage.toFixed(1) + "%");
    ele.find(".main-bar > span").css("width", percentage.toFixed(2) + "%");
  },
  updateState: function (shareId, state) {
    var ele = $(`[shareId=${shareId}]`);
    ele.find("#fileshare-state").text(state);
  },
  updateBtn: function (shareId) {
    var ele = $(`[shareId=${shareId}]`);
    ele
      .find(".fileshare-btn")
      .empty()
      .append(`<div id="cancelBtn" class="button cancel-btn">Cancel</div>`);
    ele
      .find("#cancelBtn")
      .on("click", () =>
        FileShareEventHandler.UIEvents.closeFileShare(shareId)
      );
  },
  updateFileInfo: function (shareId) {
    var session = FileShare.getSession(shareId);
    if (typeof session !== "undefined") {
      var element = $(`[shareId=${shareId}]`);
      var text = session.isCurrentUser() ? "Receiving..." : "Sending..."; //No i18n
      element.find("#fileshare-state").text(text);
      var fileNameElement = element.find(".file-name");
      fileNameElement.text(session.getFileName());
    }
  },
  updateReconnected: function (shareId) {
    var element = $(`[shareId=${shareId}]`);
    element.find(".share-percentage").text("Retrying...");
  },
};

FileSystemAPI = function (connectionId) {
  this._fileSystem = undefined;
  this._fileWriter = undefined;
  this._connectionId = connectionId;
  this._pendingChunks = [];
  this._index = 0;
  this._init();
};

FileSystemAPI.prototype = {
  _init: function () {
    window.requestFileSystem =
      window.requestFileSystem || window.webkitRequestFileSystem;
    this.registerEvents();
  },

  handleError: function (error) {
    //        console.log('File system error: ' + error.code);
  },

  removeWrittenChunk: function () {
    if (this._pendingChunks.length == 0) {
      return;
    }
    this._index = this._index + 1;
    if (this._index * 2 >= this._pendingChunks.length) {
      this._pendingChunks = this._pendingChunks.slice(this._index);
      this._index = 0;
    }
  },

  registerEvents: function () {
    this.onInitiateFileSystem = function (fileSystem) {
      this._fileSystem = fileSystem;
      fileSystem.root.getDirectory(
        FileShare.FS_ROOT_DIR,
        { create: true },
        null,
        this.handleError
      );
    }.bind(this);
  },

  createFile: function (fileId) {
    this._fileSystem.root.getFile(
      FileShare.FS_ROOT_DIR + fileId,
      { create: true },
      function (fileEntry) {
        fileEntry.createWriter(
          function (fileWriter) {
            this._fileWriter = fileWriter;
          }.bind(this),
          this.handleError
        );
      }.bind(this),
      this.handleError
    );
  },

  writeChunk: function (fileId, dataChunk, position) {
    if (this._isPendingListEmpty()) {
      this._writePendingChunks(fileId, dataChunk, position);
    }
    this._addToQueue(fileId, dataChunk, position);
  },

  _isPendingListEmpty: function () {
    return this._pendingChunks.length == 0;
  },

  _writePendingChunks: function (fileId, dataChunk, position) {
    if (position > this._fileWriter.length) {
      // workaround - when _writePendingChunks is called when filewritter is already writting
      this._fileWriter.truncate(position); //truncate Changes the length of the file to that specified
      this._writePendingChunks(fileId, dataChunk, position); //after truncate a new fileWriter need to be created
    } else {
      this._fileWriter.onwriteend = function (event) {
        if (event.currentTarget.error) {
          this.handleError(evt.currentTarget.error);
        }
        this.removeWrittenChunk();
        if (!this._isPendingListEmpty()) {
          var nextChunk = this._pendingChunks[this._index]; //getting the next chunk
          this._writePendingChunks(
            nextChunk.fileId,
            nextChunk.data,
            nextChunk.position
          );
        }
      }.bind(this);

      this._fileWriter.onerror = function (evt) {
        //console.log("write error " + evt);
      };

      this._fileWriter.seek(position); // Moving the filewritter to the newChunk position.
      this._fileWriter.write(dataChunk); // Data is of type blob
    }
  },

  _addToQueue: function (fileId, dataChunk, position) {
    this._pendingChunks.push({
      fileId: fileId,
      data: dataChunk,
      position: position,
    });
  },

  requestStorageSpace: function (size, fileId) {
    var requestSize = 1.1 * size; //taking 10% overhead
    window.requestFileSystem(
      window.TEMPORARY,
      requestSize,
      function (fileSystem) {
        this.onInitiateFileSystem(fileSystem);
        navigator.webkitTemporaryStorage.queryUsageAndQuota(
          function (usage, quota) {
            if (requestSize > quota) {
              FileShareAPI.terminate(
                this._connectionId,
                FileShareConstants.endCase.QUOTA_EXCEEDED
              );
              return;
            }
            this.createFile(fileId);
          }.bind(this),
          this.handleError
        );
      }.bind(this),
      this.handleError
    );
  },

  downloadFile: function (fileId, fileName) {
    this._fileSystem.root.getFile(
      FileShare.FS_ROOT_DIR + fileId,
      {},
      function (fileEntry) {
        var url = fileEntry.toURL();
        FileShare.downloadFromURL(url, fileName);
      },
      this.handleError
    );
  },
};
