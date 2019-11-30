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

var FileShareRTCConnection = function(
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
  this._eightBitCounter = 0; // Since uIntArrayBuffer can only store eightBit numbers
  this._dataBuffer = [];
  this._reconnectionAttempts = 0;

  this._isReconnecting = false;
  this._reconnectInterval = undefined;

  this._initialize();
};

FileShareRTCConnection.prototype = {
  _initialize: function() {
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

  _bindEventHandlers: function() {
    //To send the offer/answer in the first ice candidate
    var hasSentSdp = false;
    var peerConnection = this._connection;

    //event - RTCPeerConnectionIceEvent
    var onIceCandidateCallBack = function(event) {
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

    var onIceConnectionStateChangeCallBack = function(event) {
      var state = peerConnection.iceConnectionState;

      if (state == "connected") {
        console.log("RTC Connected");
        this._handler.handleConnected(this._connectionId, this._isReconnecting);
        this._isReconnecting = false;
        clearInterval(this._reconnectInterval);
        this._reconnectInterval = undefined;
      } else if (state == "failed") {
        // to update FileShare UI
        console.log("RTC Failed");

        this._handler.handleFailed(this._connectionId);
        this._bindEventHandlers();
        var that = this;
        this._reconnect();

        // try reconnection for every 30 seconds
        clearInterval(this._reconnectInterval);
        this._reconnectInterval = setInterval(function() {
          that._reconnect();
        }, 30000);
      }
    }.bind(this);

    peerConnection.onicecandidate = onIceCandidateCallBack;
    peerConnection.oniceconnectionstatechange = onIceConnectionStateChangeCallBack;
    if (!this.isOfferer) {
      peerConnection.ondatachannel = function(event) {
        this._createDataChannel(event.channel);
      }.bind(this);
    }
  },

  _reconnect: function() {
    this._isReconnecting = true;
    this._reconnectionAttempts++;
    if (this._reconnectionAttempts > 3) {
      this.close();
      return;
    } else if (this._isOfferer) {
      this._isIceRestart = true;
      this._initialize();
    }
    this._handler.handleRetry(
      this._connectionId,
      this._isOfferer,
      this._currentFileChunk
    );
  },

  _createOffer: function() {
    var sdpConstraints = {};

    if (this._isIceRestart) {
      sdpConstraints.iceRestart = true;
    }

    var peerConnection = this._connection;
    var that = this;

    peerConnection.createOffer(sdpConstraints).then(function(offer) {
      that._localSDP = offer;
      peerConnection.setLocalDescription(offer);
    });
  },

  _createAnswer: function() {
    var sdpConstraints = {};
    var peerConnection = this._connection;
    var that = this;

    peerConnection
      .setRemoteDescription(
        this._getRTCSessionDescriptionObj("offer", this._remoteSDP)
      )
      .then(function() {
        peerConnection.createAnswer(sdpConstraints).then(function(answer) {
          that._localSDP = answer;
          peerConnection.setLocalDescription(answer);
        });
      });
  },

  setRemoteDescription: function(type, remoteSdp, remoteIceCandidate) {
    if (typeof remoteIceCandidate != "undefined") {
      this._remoteIcecandidate = remoteIceCandidate;
    }

    var that = this;
    this._connection
      .setRemoteDescription(this._getRTCSessionDescriptionObj(type, remoteSdp))
      .then(function() {
        that.addRemoteIceCandidate();
      });
  },

  setRemoteDescriptionAndAnswer: function(type, remoteSdp, remoteIcecandidate) {
    // to set sdp and answer in retry cases
    this._isIceRestart = true;
    if (typeof remoteIcecandidate != "undefined") {
      this._remoteIcecandidate = remoteIcecandidate;
    }
    var peerConnection = this._connection;

    var that = this;
    this._connection
      .setRemoteDescription(this._getRTCSessionDescriptionObj(type, remoteSdp))
      .then(function() {
        that.addRemoteIceCandidate();
        peerConnection.createAnswer().then(function(answer) {
          that._localSDP = answer;
          peerConnection.setLocalDescription(answer);
        });
      });
  },

  setRemoteIcecandidate: function(remoteIcecandidate) {
    this._remoteIcecandidate = remoteIcecandidate;
    this.addRemoteIceCandidate();
  },

  addRemoteIceCandidate: function() {
    var peerConnection = this._connection;
    peerConnection.addIceCandidate(
      new RTCIceCandidate(this._remoteIcecandidate)
    );
  },

  _getRTCSessionDescriptionObj: function(type, remoteSdp) {
    return new RTCSessionDescription({ type: type, sdp: remoteSdp });
  },

  close: function() {
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

  _getConfiguration: function() {
    var turnServerUrl = this._turnCredentials.url;
    var userName = this._turnCredentials.username;
    var credential = this._turnCredentials.credential;

    var iceServers = [];
    iceServers.push({
      urls: turnServerUrl,
      username: userName,
      credential: credential
    });

    var configuration = { iceServers: iceServers };
    return configuration;
  },

  _createDataChannel: function(channel) {
    if (this._dataChannel) {
      this._dataChannel.close();
      this._dataChannel = undefined;
    }
    if (this._isOfferer) {
      this._dataChannel = this._connection.createDataChannel("sendChannel");
      this._dataChannel.binaryType = "arraybuffer";
      this._dataChannel.bufferedAmountLowThreshold = 15 * 1024 * 1024;
      // dataChannel events
      this._dataChannel.onopen = function() {
        this._sendFiles();
      }.bind(this);

      this._dataChannel.onbufferedamountlow = function() {
        this._sendFiles();
      }.bind(this);
    } else {
      this._dataChannel = channel;
      this._dataChannel.binaryType = "arraybuffer";
      this._dataChannel.onmessage = function(event) {
        this._receiveFiles(event.data);
      }.bind(this);
    }
  },

  _sendFiles: function() {
    var peerConnection = this._connection;
    var bytesPerChunk = FileShare.BYTES_PER_CHUNK;
    var files = this._files;
    var fileReader = new FileReader();
    var fileShareSession = FileShare.getSession(this._connectionId);
    var fileIndex = fileShareSession.getCurrentFileIndex();

    var readNextChunk = function(file) {
      var start = bytesPerChunk * this._currentFileChunk;
      var end = Math.min(file.size, start + bytesPerChunk);
      fileReader.readAsArrayBuffer(file.slice(start, end));
    }.bind(this);

    var fileReaderOnLoad = function(event) {
      var data = event.target.result;
      if (typeof fileShareSession == "undefined" || files.length <= 0) {
        return;
      }
      var currIndex = fileIndex + 1;
      // FileShareImpl.updateFileInfo(this._connectionId);

      var totalChunks = Math.ceil(files[fileIndex].size / bytesPerChunk);
      var sendChannel = this._dataChannel;
      var toSend = new Uint8Array(data.byteLength + 1);
      toSend.set([this._currentFileChunk], 0);
      toSend.set(new Uint8Array(data), 1);

      // buffer amount must not exceed more than 15 Mb, because datachannel closes when buffer overflows.
      if (
        sendChannel &&
        sendChannel.readyState == "open" &&
        sendChannel.bufferedAmount < 15 * 1024 * 1024
      ) {
        sendChannel.send(toSend.buffer);
        FileShareImpl.updateProgressBar(
          this._connectionId,
          this._currentFileChunk,
          totalChunks
        );
      } else {
        return;
      }
      this._currentFileChunk++;

      var bytesSent = bytesPerChunk * this._currentFileChunk;
      // check if a file is sent completely
      if (bytesSent < files[fileIndex].size) {
        readNextChunk(files[fileIndex]);
      } else {
        fileIndex = fileShareSession.updateFileIndex();
        // check if there is any files in queue
        if (fileIndex < files.length) {
          this._currentFileChunk = 0;
          readNextChunk(files[fileIndex]);
        }
        console.log("send success...");
      }
    }.bind(this);

    fileReader.onload = fileReaderOnLoad;
    readNextChunk(files[fileIndex]);
  },

  _receiveFiles: function(receivedData) {
    var fileShareSession = FileShare.getSession(this._connectionId);
    if (typeof fileShareSession == "undefined") {
      return;
    }
    var fileIndex = fileShareSession.getCurrentFileIndex();
    var currIndex = fileIndex + 1;
    var metadata = fileShareSession.getMetaData();
    // FileShareImpl.updateFileInfo(this._connectionId);
    var totalChunks = Math.ceil(
      metadata[fileIndex].size / FileShare.BYTES_PER_CHUNK
    );
    var received = new Uint8Array(receivedData);
    var chunkIdReceived = received[0];

    if (chunkIdReceived == this._eightBitCounter) {
      var dataChunk = received.slice(1).buffer;
      this._dataBuffer.push(dataChunk);
      FileShareImpl.updateProgressBar(
        this._connectionId,
        this._currentFileChunk,
        totalChunks
      );
      this._currentFileChunk++;
      this._eightBitCounter++;
      if (chunkIdReceived == 255) {
        this._eightBitCounter = 0;
      }
    } else {
      return;
    }
    // check if file is completely received
    if (this._currentFileChunk == totalChunks) {
      if (fileIndex == metadata.length - 1) {
        // All files are received successfully so send acknowledgement to receiver
        console.log("received successfully...");
        this._handler.handleSent(this._connectionId);
      }
      var file = metadata[fileIndex];
      const received = new Blob(this._dataBuffer);

      // automatically downloads the file
      if (navigator.msSaveBlob) {
        // For ie and Edge
        return navigator.msSaveBlob(received, file.name);
      } else {
        var link = document.createElement("a");
        link.href = URL.createObjectURL(received);
        link.download = file.name;
        document.body.appendChild(link);
        link.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window
          })
        );
        link.remove();
        URL.revokeObjectURL(link.href);
      }

      // reset values for next file
      this._dataBuffer = [];
      this._currentFileChunk = 0;
      this._eightBitCounter = 0;
      fileIndex = fileShareSession.updateFileIndex();
    }
  },

  retryFileShare: function(fileIndex, chunkId) {
    this._currentFileChunk = chunkId;
    var fileShareSession = FileShare.getSession(this._connectionId);
    fileShareSession.updateFileIndex();
    this._isIceRestart = true;
    this._initialize();
  }
};
