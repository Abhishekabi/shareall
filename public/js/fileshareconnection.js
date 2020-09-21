//$Id$

/*
 * Current Browser versions (August 1, 2019) while writing this,
 * chrome	-	76.0.3809.87
 * firefox	-	62.0
 * safari	-	11.1.2
 * edge		-	44.18362.267.0
 * opera	-	62.0.3331.99
 */

/*
 * Used APIs							Base Compatibility
 * RTCPeerConnection					chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - All,	opera - 43
 * iceConnectionState					chrome - 48,	firefox - 52,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * onicecandidate						chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * oniceconnectionstatechange			chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * createDataChannel					chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * ondatachannel						chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * onopen								chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * onbufferedamountlow					chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * onmessage							chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * bufferedAmount						chrome - 56,	firefox - 18,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * createOffer							chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * createAnswer							chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * setRemoteDescription					chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * setLocalDescription					chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 * addIceCandidate						chrome - 56,	firefox - 22,	safari - unknown(works in 11.1.2),	edge - 15,	opera - 43
 *
 * close								chrome - unknown,	firefox - unknown,	safari - unknown(works in 11.1.2),	edge - 15,	opera - unknown
 */

//Do Not Use the _methods and _variables
/*
 * connectionId - unique id for the connection
 * hostId - the zuid of the connection's host
 * files - user selected files
 * turnCredentials - provided by server for turn server configuration
 * handler - contains all the handler functions
 * isOfferer - whether the connection is created by the sender
 * remoteSDP - description from the remote peer
 * remoteIcecandidate - candidate from the remote peer
 */

WebRTCPeerConnectionConstants = {
  iceConnectionStates: {
    CONNECTED: "connected",
    FAILED: "failed",
    DISCONNECTED: "disconnected",
  },
};
var FileShareRTCConnection = function (
  connectionId,
  hostId,
  handler,
  turnCredentials,
  isOfferer,
  remoteSDP,
  remoteIcecandidate,
  files
) {
  this._connectionId = connectionId;
  this._hostId = hostId;
  this._handler = handler;

  this._turnCredentials = turnCredentials;

  this._rtpSenders = [];
  this._remoteSDP = remoteSDP;
  this._localSDP = undefined;
  this._remoteIcecandidate = remoteIcecandidate
    ? remoteIcecandidate
    : undefined;

  this._isOfferer = isOfferer;
  this._dataChannel = undefined;
  this._files = files;
  this._isIceRestart = false;
  this._currentFileChunk = 0;
  this._tempCounter = 0; // updates for every 256 chunks (as chunk id is received in 8bit)
  this._dataBuffer = [];
  this._reconnectionAttempts = 0;

  this._isReconnecting = false;
  this._reconnectInterval = undefined;

  //For calculating data rate (no interval is used, so may be showing last transfer rate)
  this._lastUpdatedChunkId = 0;
  this._lastUpdatedTime = Date.now();
  this._averageRate = 0;
  this._remainingTime = -1;

  this._initialize();
};

FileShareRTCConnection.prototype = {
  _initialize: function () {
    if (!this._connection) {
      this._connection = new RTCPeerConnection(this._getConfiguration());
    }

    this._bindEventHandlers();

    if (this._isOfferer) {
      this._createDataChannel();
      this._createOffer();
    } else {
      this._createAnswer();
      this.addRemoteIceCandidate();
    }
  },

  _bindEventHandlers: function () {
    //To send the offer/answer in the first ice candidate
    var hasSentSdp = false;
    var peerConnection = this._connection;

    //event - RTCPeerConnectionIceEvent
    var onIceCandidateCallBack = function (event) {
      //RTCIceCandidate
      var iceCandidate = event.candidate;

      if (iceCandidate) {
        if (!hasSentSdp) {
          if (this._isOfferer) {
            this._handler.sendOffer(
              this._connectionId,
              this._localSDP,
              iceCandidate,
              this._isIceRestart
            );
          } else {
            this._handler.sendAnswer(
              this._connectionId,
              this._localSDP,
              iceCandidate,
              this._isIceRestart
            );
          }
          hasSentSdp = true;
        } else {
          this._handler.updateIceCandidates(
            this._connectionId,
            iceCandidate,
            this._isIceRestart
          );
        }
      }
    }.bind(this);

    var onIceConnectionStateChangeCallBack = function (event) {
      var state = peerConnection.iceConnectionState;

      if (
        WebRTCPeerConnectionConstants.iceConnectionStates.CONNECTED == state
      ) {
        this._handler.handleConnected(this._connectionId, this._isReconnecting);
        this._isReconnecting = false;
        clearInterval(this._reconnectInterval);
        this._reconnectInterval = undefined;
      } else if (
        WebRTCPeerConnectionConstants.iceConnectionStates.FAILED == state
      ) {
        // to update FileShare UI
        this._handler.handleNetworkError(this._connectionId);
        this._bindEventHandlers();
        var that = this;
        this._reconnect();

        // try reconnection for every 30 seconds
        clearInterval(this._reconnectInterval);
        this._reconnectInterval = setInterval(function () {
          that._reconnect();
        }, FileShareConstants.reconnectionInterval);
      }
    }.bind(this);

    /*
     * Temporary fix to resolve chrome (M75) issue.
     * Connected event not received in oniceconnectionstatechange in reconnect
     * Failed event not received in oniceconnectionstatechange for connection failure after the first reconnection success
     */
    var onConnectionStateChangeCallBack = function (event) {
      var state = peerConnection.connectionState;

      if (
        WebRTCPeerConnectionConstants.iceConnectionStates.CONNECTED == state
      ) {
        this._handler.handleConnected(this._connectionId, this._isReconnecting);
        this._isReconnecting = false;
        clearInterval(this._reconnectInterval);
        this._reconnectInterval = undefined;
      } else if (
        WebRTCPeerConnectionConstants.iceConnectionStates.FAILED == state
      ) {
        // to update FileShare UI
        this._handler.handleNetworkError(this._connectionId);
        this._bindEventHandlers();
        var that = this;
        this._reconnect();

        // try reconnection for every 30 seconds
        clearInterval(this._reconnectInterval);
        this._reconnectInterval = setInterval(function () {
          that._reconnect();
        }, FileShareConstants.reconnectionInterval);
      }
    }.bind(this);

    peerConnection.onicecandidate = onIceCandidateCallBack;
    peerConnection.oniceconnectionstatechange = onIceConnectionStateChangeCallBack;
    peerConnection.onconnectionstatechange = onConnectionStateChangeCallBack;
    if (!this.isOfferer) {
      peerConnection.ondatachannel = function (event) {
        FileShareImpl.updateFileInfo(this._connectionId);
        this._createDataChannel(event.channel);
      }.bind(this);
    }
  },

  _reconnect: function () {
    this._isReconnecting = true;
    this._reconnectionAttempts++;
    if (this._reconnectionAttempts >= FileShareConstants.reconnectionAttempts) {
      this.close();
      this._handler.handleFailed(this._connectionId);
      return;
    } else if (this._isOfferer) {
      this._isIceRestart = true;
    }
    this._handler.handleRetry(
      this._connectionId,
      this._isOfferer,
      this._currentFileChunk
    );
  },

  _createOffer: function () {
    var sdpConstraints = {};

    if (this._isIceRestart) {
      sdpConstraints.iceRestart = true;
    }

    var peerConnection = this._connection;
    var that = this;

    peerConnection.createOffer(sdpConstraints).then(function (offer) {
      that._localSDP = offer;
      peerConnection.setLocalDescription(offer);
    });
  },

  _createAnswer: function () {
    var sdpConstraints = {};
    var peerConnection = this._connection;
    var that = this;

    peerConnection
      .setRemoteDescription(
        this._getRTCSessionDescriptionObj("offer", this._remoteSDP)
      )
      .then(function () {
        //NO I18N
        peerConnection.createAnswer(sdpConstraints).then(function (answer) {
          that._localSDP = answer;
          peerConnection.setLocalDescription(answer);
        });
      });
  },

  setRemoteDescription: function (type, remoteSdp, remoteIceCandidate) {
    if (typeof remoteIceCandidate != "undefined") {
      this._remoteIcecandidate = remoteIceCandidate;
    }

    var that = this;
    this._connection
      .setRemoteDescription(this._getRTCSessionDescriptionObj(type, remoteSdp))
      .then(function () {
        that.addRemoteIceCandidate();
      });
  },

  setRemoteDescriptionAndAnswer: function (
    type,
    remoteSdp,
    remoteIcecandidate
  ) {
    // to set sdp and answer in retry cases
    this._isIceRestart = true;
    if (typeof remoteIcecandidate != "undefined") {
      this._remoteIcecandidate = remoteIcecandidate;
    }
    var peerConnection = this._connection;

    var that = this;
    this._connection
      .setRemoteDescription(this._getRTCSessionDescriptionObj(type, remoteSdp))
      .then(function () {
        that.addRemoteIceCandidate();
        peerConnection.createAnswer().then(function (answer) {
          that._localSDP = answer;
          peerConnection.setLocalDescription(answer);
        });
      });
  },

  setRemoteIcecandidate: function (remoteIcecandidate) {
    this._remoteIcecandidate = remoteIcecandidate;
    this.addRemoteIceCandidate();
  },

  addRemoteIceCandidate: function () {
    var peerConnection = this._connection;
    peerConnection.addIceCandidate(
      new RTCIceCandidate(this._remoteIcecandidate)
    );
  },

  _getRTCSessionDescriptionObj: function (type, remoteSdp) {
    return new RTCSessionDescription({ type: type, sdp: remoteSdp });
  },

  close: function () {
    clearInterval(this._reconnectInterval);
    this._reconnectInterval = undefined;

    if (this._connection) {
      this._connection.close();
      this._connection = undefined;
    }

    if (this._dataChannel) {
      this._dataChannel.close();
      this._dataChannel = undefined;
    }

    //Reset all connection properties
    this._isReconnecting = false;
    this._remoteSDP = undefined;
    this._localSDP = undefined;
  },

  _getConfiguration: function () {
    var turnServerUrl = this._turnCredentials.url;
    var userName = this._turnCredentials.username;
    var credential = this._turnCredentials.credential;

    var iceServers = [];
    iceServers.push({
      urls: turnServerUrl,
      username: userName,
      credential: credential,
    });

    var configuration = { iceServers: iceServers };
    return configuration;
  },

  _getTransferRateDetails: function () {
    if (this._currentFileChunk > this._lastUpdatedChunkId) {
      var currentRate =
        FileShare.BYTES_PER_CHUNK *
        (this._currentFileChunk - this._lastUpdatedChunkId);
      //Adding weightage to existing rate
      this._averageRate = (
        ((this._averageRate > 0 ? this._averageRate : currentRate) * 7 +
          currentRate * 3) /
        10
      ).toFixed(2);
    }

    var fileShareSession = FileShare.getSession(this._connectionId);
    var currentFileIndex = fileShareSession.getCurrentFileIndex();

    var filesDetails = fileShareSession.getMetaData(); //No i18n
    var remainingBytes =
      filesDetails[currentFileIndex].size -
      FileShare.BYTES_PER_CHUNK * this._currentFileChunk;

    for (var i = currentFileIndex + 1; i < filesDetails.length; i++) {
      remainingBytes += filesDetails[i].size;
    }

    this._remainingTime =
      this._averageRate > 0
        ? Math.floor((remainingBytes / this._averageRate) * 1000)
        : -1;
    this._lastUpdatedTime = Date.now();

    //Rate in bytes per second and estimated remaining time in milliseconds
    return { rate: this._averageRate, remaining_time: this._remainingTime };
  },

  _createDataChannel: function (channel) {
    if (this._dataChannel) {
      this._dataChannel.close();
      this._dataChannel = undefined;
    }
    if (this._isOfferer) {
      this._dataChannel = this._connection.createDataChannel("sendChannel"); //NO I18N
      this._dataChannel.binaryType = "arraybuffer"; //NO I18N
      this._dataChannel.bufferedAmountLowThreshold = 15 * 1024 * 1024;
      // dataChannel events
      this._dataChannel.onopen = function () {
        this._isIceRestart = false;
        FileShareImpl.updateFileInfo(this._connectionId);
        this._sendFiles();
      }.bind(this);

      this._dataChannel.onbufferedamountlow = function () {
        if (!this._isIceRestart) {
          this._sendFiles();
        }
      }.bind(this);
    } else {
      this._dataChannel = channel;
      this._dataChannel.binaryType = "arraybuffer"; //NO I18N
      this._dataChannel.onmessage = function (event) {
        this._isIceRestart = false;
        this._receiveFiles(event.data);
      }.bind(this);
    }
  },

  _sendFiles: function () {
    var bytesPerChunk = FileShare.BYTES_PER_CHUNK;
    var fileReader = new FileReader();
    var fileShareSession = FileShare.getSession(this._connectionId);

    var readNextChunk = function (file) {
      var start = bytesPerChunk * this._currentFileChunk;
      var end = Math.min(file.size, start + bytesPerChunk);
      fileReader.readAsArrayBuffer(file.slice(start, end));
    }.bind(this);

    var fileReaderOnLoad = function (event) {
      var data = event.target.result;
      var totalFiles = fileShareSession.getFilesCount();
      if (typeof fileShareSession == "undefined" || totalFiles <= 0) {
        return;
      }
      var files = fileShareSession.getMetaData();
      var fileIdVsFile = fileShareSession.getSelectedFiles();
      var fileIndex = fileShareSession.getCurrentFileIndex();

      var totalChunks = Math.ceil(files[fileIndex].size / bytesPerChunk);
      var sendChannel = this._dataChannel;
      var toSend = new Uint8Array(data.byteLength + 1);
      toSend.set([this._currentFileChunk], 0);
      toSend.set(new Uint8Array(data), 1);

      // buffer amount must not exceed more than 15 Mb, because datachannel closes when buffer overflows.
      if (
        typeof sendChannel !== "undefined" &&
        sendChannel.readyState == "open" &&
        sendChannel.bufferedAmount < 15 * 1024 * 1024
      ) {
        sendChannel.send(toSend.buffer);

        if (Date.now() - this._lastUpdatedTime > 1000) {
          FileShareImpl.updateProgressBar(
            this._connectionId,
            this._currentFileChunk,
            totalChunks,
            this._getTransferRateDetails()
          );
          this._lastUpdatedChunkId = this._currentFileChunk;
        }
      } else {
        return;
      }

      this._currentFileChunk++;

      var bytesSent = bytesPerChunk * this._currentFileChunk;
      // check if a file is sent completely
      if (bytesSent < files[fileIndex].size) {
        readNextChunk(fileIdVsFile[fileShareSession.getCurrentFileId()]);
      } else {
        // check if there is any files in queue
        if (fileIndex == totalFiles - 1) {
          return;
        }
        fileShareSession.updateFileIndex();
        FileShareImpl.updateFileInfo(this._connectionId);
        this._currentFileChunk = 0;
        readNextChunk(fileIdVsFile[fileShareSession.getCurrentFileId()]);
      }
    }.bind(this);

    fileReader.onload = fileReaderOnLoad;
    var fileIdVsFile = fileShareSession.getSelectedFiles();
    readNextChunk(fileIdVsFile[fileShareSession.getCurrentFileId()]);
  },

  _receiveFiles: function (receivedData) {
    var fileShareSession = FileShare.getSession(this._connectionId);
    if (typeof fileShareSession == "undefined") {
      return;
    }
    var fileIndex = fileShareSession.getCurrentFileIndex();
    var metadata = fileShareSession.getMetaData();
    var totalChunks = Math.ceil(
      metadata[fileIndex].size / FileShare.BYTES_PER_CHUNK
    );
    var received = new Uint8Array(receivedData);
    var eightBitChunkId = received[0];
    var chunkIdReceived = eightBitChunkId + this._tempCounter * 256;

    if (chunkIdReceived == this._currentFileChunk) {
      var dataChunk = received.slice(1).buffer;
      if (FileShare.isFileSystemNeeded(metadata[fileIndex].size)) {
        this._handler.handleFileSystemWrite(
          this._connectionId,
          dataChunk,
          this._currentFileChunk
        );
      } else {
        this._dataBuffer.push(dataChunk);
      }

      if (Date.now() - this._lastUpdatedTime > 1000) {
        FileShareImpl.updateProgressBar(
          this._connectionId,
          this._currentFileChunk,
          totalChunks,
          this._getTransferRateDetails()
        );
        this._lastUpdatedChunkId = this._currentFileChunk;
      }

      this._currentFileChunk++;
      if (eightBitChunkId == 255) {
        this._tempCounter++;
      }
    } else {
      return;
    }
    // check if file is completely received
    if (this._currentFileChunk == totalChunks) {
      var file = metadata[fileIndex];
      const received = new Blob(this._dataBuffer);
      if (FileShare.isFileSystemNeeded(metadata[fileIndex].size)) {
        fileShareSession.downloadFromFileSystem(file.file_id, file.name);
      } else {
        if (navigator.msSaveBlob) {
          // For ie and Edge
          return navigator.msSaveBlob(received, file.name);
        } else {
          FileShare.downloadFromURL(URL.createObjectURL(received), file.name);
        }
      }
      if (fileIndex == metadata.length - 1) {
        this._handler.handleTransferCompleted(this._connectionId);
        return;
      }
      // reset values for next file
      this._dataBuffer = [];
      this._currentFileChunk = 0;
      this._tempCounter = 0;
      fileShareSession.updateFileIndex();
      FileShareImpl.updateFileInfo(this._connectionId);
    }
  },

  retryFileShare: function (fileIndex, chunkId) {
    this._currentFileChunk = chunkId;
    var fileShareSession = FileShare.getSession(this._connectionId);
    fileShareSession.updateFileIndex(fileIndex);
    this._isIceRestart = true;
    this._initialize();
  },
};
