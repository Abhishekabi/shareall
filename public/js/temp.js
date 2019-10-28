//$Id$
var FileShareSession = {};
var FileShareEventHandler = {};
var FileShare = {};
var FileShareTemplates = {};
var FileShareImpl = {};

var FileShareSession = function(connectionId, senderId, receiverId, receiverName, files, metaData, turnCredentials, chid)
{
	this._connectionId = connectionId;
	this._chid = chid;
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
}

FileShareSession.prototype =
{
	_initialize : function()
	{
		this._sessionTimer = setTimeout(function()
		{
			if(this.isCurrentUser())
			{
				var text = Resource.getRealValue("fileshare.noresponse",[this._receiverName]);
				FileShareImpl.updateState(this._connectionId, text);
				FileShareImpl.showFailedRipple(this._connectionId);
				var elementId = FileShare.getSession(this._connectionId).getCurrentFileShareElementId();
				FileShareImpl.updateBtn(elementId);
				return;
			}
			FileShare.close(this._connectionId);
			FileShare.removeSession(this._connectionId);
		}.bind(this),30000);
	},
	
	getPeerUserId : function()
	{
	    return this.isCurrentUser() ? this._receiverId : this._senderId;
	},

	isCurrentUser : function()
	{
		return this._senderId === $zcg._ZUID;
	},
	
	getSelectedFiles : function()
	{
	    return this._files;
	},
	
	getMetaData : function()
	{
	    return this._metaData;
	},
	
	getCurrentFileId : function()
	{
		return this._metaData[this._fileIndex].file_id;
	},
	
	getCurrentFileIndex : function()
	{
		return this._fileIndex;
	},
	
	getChatId : function()
	{
		return this._chid;
	},
	
	updateFileIndex : function()
	{
		this._fileIndex += 1;
		return this._fileIndex;
	},
	
	getCurrentFileShareElementId : function() //To assign ID for UI
	{
	    return this._connectionId.replace( /=/g, "");// Using the connectionId
	},
	
	getFileName : function()
	{
	    return this._metaData[this._fileIndex].name;
	},
	
	getTotalFileSize : function()
	{
		var size = 0;
	    this._metaData.forEach(function(file){
	    	size += file.size;
	    });
	    return $Util.getFileSize(size);
	},
	
	getEstimatedTime : function()
	{
	    return "20 min";//NO I18N
	},
	
	getTimeLeft : function()
	{
	    return "10 min";//NO I18N
	},
	
	initiateSession : function()
	{
		clearTimeout(this._sessionTimer);
		this._sessionTimer = undefined;
	    this._rtcConnection = new FileShareRTCConnection(this._connectionId, this._senderId, FileShareEventHandler.peerConnectionEvents , this._turnCredentials, true, undefined, undefined, this._files);
	},
	
	setRemoteDescription : function(type, remoteSdp, remoteIceCandidate)
	{
		if(!this.isCurrentUser())
		{
			// to set sdp and answer in retry cases
			this._rtcConnection.setRemoteDescriptionAndAnswer(type, remoteSdp, remoteIceCandidate);
		}
		else
		{
			this._rtcConnection.setRemoteDescription(type, remoteSdp, remoteIceCandidate);			
		}
	},
	
	updateIceCandidates : function(remoteIceCandidate)
	{
		// ice candidates are generated even after the connection being closed
		if(this._rtcConnection)
		{
			this._rtcConnection.setRemoteIcecandidate(remoteIceCandidate);			
		}
	},
	
	connectFileShareDownStream : function(remoteSdp, remoteIceCandidate)
	{
		clearTimeout(this._sessionTimer);
		this._sessionTimer = undefined;
	    this._rtcConnection = new FileShareRTCConnection(this._connectionId, this._receiverId, FileShareEventHandler.peerConnectionEvents, this._turnCredentials, false, remoteSdp, remoteIceCandidate);
	},
	
	close : function()
	{
		clearTimeout(this._sessionTimer);
		this._sessionTimer = undefined;
		if(this._rtcConnection)
		{
			this._rtcConnection.close();
			this._rtcConnection = undefined;
		}
	},
	
	retryTransfer : function(fileId, chunkId) 
    {
	    for(var i=0;i<this._metaData.length;i++)
	    {
	        if(this._metaData[i].file_id == fileId)
	        {
	        	this._rtcConnection.retryFileShare(i, chunkId);
	        	return;
	        }
	    }
    }
}

// handler for fp2p
FileShareEventHandler = {

	peerConnectionEvents :
	{
		sendOffer : function(connectionId, sdp, iceCandidate, iceRestart)
		{
		    FileShareAPI.sendSdp(connectionId, sdp, iceCandidate, iceRestart, "offer"); //NO I18N
		},
		
		sendAnswer : function(connectionId, sdp, iceCandidate, iceRestart)
		{
		    FileShareAPI.sendSdp(connectionId, sdp, iceCandidate, iceRestart, "answer"); //NO I18N
		},
		
		handleConnected : function(connectionId, isReconnecting)
		{
			if(isReconnecting)
			{
				FileShareImpl.updateReconnected(connectionId);
			}			
		},

		updateIceCandidates : function(connectionId, iceCandidate, iceRestart)
		{
			FileShareAPI.updateCandidate(connectionId, iceCandidate, iceRestart);
		},
		
		handleFailed : function(connectionId)
		{
			FileShareImpl.updateFailedState(connectionId);		
		},
		
		handleRetry : function(connectionId, isOfferer, currentChunkId)
		{
			if(!isOfferer)
			{
				var fileShareSession = FileShare.getSession(this._connectionId);
				var fileIndex = fileShareSession.getCurrentFileIndex();
				var fileId = fileShareSession.getCurrentFileId(fileIndex);
				FileShareAPI.retry(connectionId, fileId, currentChunkId);
			}
		},
		
		handleSent : function(connectionId)
		{
		    FileShareAPI.sendAcknowledgement(connectionId);
		}
	},
	
	wmsEvents :
	{
		offer : function(msgObj)
		{
			var description = JSON.parse(msgObj.description);
			var sdp = description.sdp;
			var type = description.type;
			var connectionId = msgObj.share_id;
			var isIceRestart = msgObj.ice_restart;
			var fileShareSession = FileShare.getSession(connectionId);
			if(typeof fileShareSession !== "undefined")
			{
				var iceCandidates = JSON.parse(msgObj.ice_candidates);
				
				if(!isIceRestart){
					fileShareSession.connectFileShareDownStream(sdp,iceCandidates);				
				}else{
					fileShareSession._rtcConnection.setRemoteDescription(type, sdp, iceCandidates);
				}
			}
		},
		
		answer : function(msgObj)
		{
			var sdp = JSON.parse(msgObj.description).sdp;
			var type = JSON.parse(msgObj.description).type;
			var connectionId = msgObj.share_id;
			var isIceRestart = msgObj.ice_restart;
			var fileShareSession = FileShare.getSession(connectionId);
			if(typeof fileShareSession !== "undefined")
			{
				var iceCandidates = JSON.parse(msgObj.ice_candidates);
				fileShareSession.setRemoteDescription(type, sdp, iceCandidates);
			}
		},
		
		accept : function(msgObj)
		{
			var connectionId = msgObj.share_id;
			var fileShareSession = FileShare.getSession(connectionId);
			if(typeof fileShareSession !== "undefined")
			{
				FileShareImpl.updateContent(connectionId);
				fileShareSession.initiateSession();				
			}
		},
		
		decline : function(msgObj)
		{
			var connectionId = msgObj.share_id;
			var fileShareSession = FileShare.getSession(connectionId);
			if(typeof fileShareSession !== "undefined")
			{
				var receiverName = Users.getName(fileShareSession.getPeerUserId());
				var text = Resource.getRealValue("fileshare.rejected",[receiverName]);
				FileShareImpl.updateState(connectionId, text);
				FileShareImpl.showFailedRipple(connectionId);
				var elementId = fileShareSession.getCurrentFileShareElementId();
				FileShareImpl.updateBtn(elementId);
				fileShareSession.close();				
			}
		},
		
		updateicecandidates : function(msgObj)
		{
			var connectionId = msgObj.share_id;
			var fileShareSession = FileShare.getSession(connectionId);
			if(typeof fileShareSession !== "undefined")
			{
				var iceCandidates = JSON.parse(msgObj.ice_candidates);
				fileShareSession.updateIceCandidates(iceCandidates);				
			}
		},
		
		terminate : function(msgObj)
		{
			var connectionId = msgObj.share_id;
			FileShare.close(connectionId);
			FileShare.removeSession(connectionId);
		},
		
		new_session : function(msgObj)
		{
			var turnCredentials = msgObj.data;
			var connectionId = msgObj.share_id;
			var peer = msgObj.peer;
			var peername = msgObj.peer_dname;
			var metaData = msgObj.files;
			
		    var fileShareSession = new FileShareSession(connectionId, peer, $zcg._ZUID, peername, undefined, metaData, turnCredentials);
		    FileShare.addSession(connectionId,fileShareSession,peer);
		    var text = Resource.getRealValue("fileshare.sending",[peername, metaData.length]);
		    var elementId = fileShareSession.getCurrentFileShareElementId();
			FileShareImpl.initialize(elementId, connectionId, text);
		},
		
		transfer_completed : function(msgObj)
		{
			var connectionId = msgObj.share_id;
			FileShareAPI.terminate(connectionId);
		},
		
		retry : function(msgObj)
		{
			var connectionId = msgObj.share_id;
			var fileId = msgObj.file_id;
			var lastChunkId = msgObj.last_chunk_id;
			var fileShareSession = FileShare.getSession(connectionId);
			if(typeof fileShareSession !== "undefined")
			{
				fileShareSession.retryTransfer(fileId, lastChunkId);				
			}
		}
	},
	
	UIEvents :
	{
		acceptFileShare : function(connectionId)
		{
			FileShareImpl.updateContent(connectionId);
			FileShareAPI.accept(connectionId);
		},
		
		closeFileShare : function(connectionId)
		{
			var elementId = FileShare.getSession(connectionId).getCurrentFileShareElementId();
			FileShareImpl.removeUI($("#file"+elementId));
			FileShareAPI.terminate(connectionId);
		},
		
		rejectFileShare : function(connectionId)
		{
			var elementId = FileShare.getSession(connectionId).getCurrentFileShareElementId();
			FileShareImpl.removeUI($("#file"+elementId));
			FileShareAPI.decline(connectionId);
		}
	}
}

FileShare = 
{
	BYTES_PER_CHUNK : 16384, // Constant chunk size (16 * 1024)

	_activeSessions : {}, // Holds all the fileShare session objects

	getSession : function(connectionId)
	{
		return this._activeSessions[connectionId];
	},
	
	removeSession : function(connectionId)
	{
		var fileShareSession = FileShare.getSession(connectionId);
		if(typeof fileShareSession !== "undefined")
		{
			var elementId = fileShareSession.getCurrentFileShareElementId();
			FileShareImpl.removeUI($("#file"+elementId));
			delete this._activeSessions[connectionId];
			FileShare.resetForm(fileShareSession.getChatId());
		}
	},
	
	addSession : function(connectionId, fileShareObj, rid)
	{
		this._activeSessions[connectionId] = fileShareObj;
	},
	
	initiate : function(selectedFiles, chid)
	{
		var recipant = Participants.get(chid).getRecipientFor121Chat();
		// only allow 2 fileshare between peers
		if(this.hasExceededFileShareLimit(recipant))
		{
			UI.updateBanner(Resource.getRealValue("fileshare.bannertext"),3000, true); //NO I18N
			FileShare.resetForm(chid);
			return;
		}
		var metaData = this.constructMetaData(selectedFiles);
		FileShareAPI.startFileShare(selectedFiles, chid, recipant, metaData);
	},
	
	close : function(connectionId)
	{
		var fileShareSession = FileShare.getSession(connectionId);
		if(typeof fileShareSession !== "undefined")
		{
			fileShareSession.close();
		}
	},
	
	startSession : function(resp, metaData, recipant, selectedFiles, chid)
	{
		var connectionId = resp.share_id;
		var metaData = resp.files;
		var peername = resp.peer_dname;
		var turnCredentials = resp.data;
		
		var fileShareSession = new FileShareSession(connectionId, $zcg._ZUID, recipant, peername, selectedFiles, metaData, turnCredentials, chid); //NO I18N
		FileShare.addSession(connectionId, fileShareSession, recipant);
		
		var elementId = fileShareSession.getCurrentFileShareElementId();
		var text = Resource.getRealValue("fileshare.waiting",[peername,metaData.length]);
		FileShareImpl.initialize(elementId, connectionId, text);
		
		if($DB.get("contacts")[recipant].status == $zcg.OFFLINE)
		{
			var text = Resource.getRealValue("fileshare.useroffline");
			FileShareImpl.updateState(connectionId, text);
			FileShareImpl.showFailedRipple(connectionId);
		}
	},
	
	constructMetaData : function(files)
	{
	    var metaData = [];
	    
	    for(var i=0;i<files.length;i++)
	    {
	    	metaData.push({name: files[i].name, size: files[i].size});
	    }
	    return metaData;
	},
	
	isFileShareEnabled : function()
	{
		return $zcg._IS_P2P_FILESHARING_ENABLED;
	},
	
	getUserSessionCount : function(receiverId)
	{
		var sessions = this._activeSessions;
		var count = 0;
		for (var id in sessions) 
		{
			var session = sessions[id];
			if(session.getPeerUserId() == receiverId)
			{
				count++;
			}
		}
		return count;
	},
	
	hasExceededFileShareLimit : function(receiverId)
	{
		return this.getUserSessionCount(receiverId) >= 2;
	},
	
	resetForm : function(chid)
	{
		if(chid)
		{
			var receiverId = Participants.get(chid).getRecipientFor121Chat();
			if(this.getUserSessionCount(receiverId) === 0)
			{
				FileUploadUI.resetForP2P(chid);				
			}
		}
	}
}

FileShareAPI = 
{	
	accept : function(connectionId)
	{
		$ZCAjx.ajax({
            url : "/v2/fileshares/" + connectionId + "/accept", //NO I18N
            type : "PUT", //NO I18N
            contentType : "application/json" //NO I18N
        });
	},
	
	decline : function(connectionId)
	{
		$ZCAjx.ajax({
            url : "/v2/fileshares/" + connectionId + "/decline", //NO I18N
            type : "PUT", //NO I18N
            contentType : "application/json" //NO I18N
        });
	},
	
	terminate : function(connectionId)
	{
		$ZCAjx.ajax({
            url : "/v2/fileshares/" + connectionId , //NO I18N
            type : "DELETE", //NO I18N
            contentType : "application/json" //NO I18N
		});
	},
	
	sendAcknowledgement : function(connectionId)
	{
		$ZCAjx.ajax({
	        url : "/v2/fileshares/" + connectionId + "/acknowledge",	//NO I18N					
		    type : "PUT", //NO I18N
		    contentType : "application/json" //NO I18N
	    });
	},
	
	retry : function(connectionId, fileId, currentChunkId)
	{
		$ZCAjx.ajax({
			url : "/v2/fileshares/" + connectionId + "/retry", //NO I18N
			type : "PUT", //NO I18N
			data : { file_id: fileId, last_chunk_id: currentChunkId },
			contentType : "application/json" //NO I18N
		});
	},
	
	updateCandidate : function(connectionId, iceCandidate, iceRestart)
	{
		$ZCAjx.ajax({
            url : "/v2/fileshares/" + connectionId + "/icecandidates", //NO I18N
            type : "PUT", //NO I18N
            data : { ice_candidates: iceCandidate, ice_restart: iceRestart},
            contentType : "application/json" //NO I18N
        });
	},
	
	sendSdp : function(connectionId, sdp, iceCandidate, iceRestart, type)
	{
		$ZCAjx.ajax({
            url : "/v2/fileshares/" + connectionId + "/" + type, //NO I18N
            type : "PUT", //NO I18N
            data : { description: sdp ,ice_candidates: iceCandidate, ice_restart: iceRestart},
            contentType : "application/json" //NO I18N
        });
	},
	
	startFileShare : function(selectedFiles, chid, recipant, metaData)
	{
		$ZCAjx.ajax({
			url : "/v2/users/" + recipant + "/files", 																		//NO I18N
			type : "POST", 																									//NO I18N
			data : { files: metaData }, 																					//NO I18N
			contentType : "application/json", 																				//NO I18N
			success : function(resp)
			{
				FileShare.startSession(resp, metaData, recipant, selectedFiles, chid);
			}
		});
	}
}

FileShareTemplates = (function() {
	
	var _templates = 
	{
		_fileShareWrapperUI : 
			'<div id={{file_id}} class="p2p-wrp p10 flexM" connectionid = {{conn_id}}>'+
		    	'<div class="p2p-con {{custom_class}}" name = "content">'+
		    		'{{headerUIHtml}}'+//NO I18N
		    		'{{footerUIHtml}}'+//NO I18N
		    	'</div>'+
		    '</div>',
			    
		_fileShareHeaderUI :
			'<div class="p2p-hdr flexC">' +
				'<div class="fshrink p2p-info-img">'+
				'</div>' +
				'<div id="contentDiv" class="flexG ellips pL12">'+
					'<div id="fileName" class="font16 fontb ellips">'+
						'{{file_name}}'+//NO I18N
					'</div>'+
					'<div class="mT8 font13" name="fileContent">'+
						'{{fileContentHtml}}'+//NO I18N
					'</div>'+
				'</div>'+'{{tick_open}}'+//NO I18N
			'</div>',
			
		_fileDetailsUI : 
			'<span>'+
				'<span class="p2p-info-txt mR5">{{size_label}}</span>{{file_size}}'+//NO I18N
			'</span>'+
			'<span class="mL30">'+
				'<span class="p2p-info-txt mR5">{{time_label}}</span>{{estimated_time}}'+//NO I18N
			'</span>',
			
		_progressBarUI :
			'<div id="progressBar" class="p2p-process-bar">'+
				'<span class="p2p-process-status" style="width: {{percentage}};"></span>'+
			'</div>'+
			'<div id="progressTxt" class="flexC justifySB mT4">'+
				'<span class="p2p-info-txt" name="percentage" >{{current_percentage}}</span>'+
				'{{remaining_time}}'+//NO I18N
    		'</div>',
    		
		_completedUI :
			'<div class="mT6 font13 p2p-info-txt">'+
				'{{label}}'+//NO I18N
			'</div>',
			
		_openFileUI :
			'<div id="openFile" class="fshrink mL15">'+
				'<span class="zcl-icon-round zcf-tick"></span>'+
			'</div>',
    		
    	_fileShareFooterUI :
    		'<div class="p2p-ftr flexC">'+
    			'<div id="userImg" class="p2p-usr-img fshrink flexM ripple">'+
    				'<img src= {{user_img}}>'+//NO I18N
    			'</div>'+
	    		'<div id="currentState" class="flexG font12 ellips_2">'+
	    			'{{transfer_state}}'+//NO I18N
	    		'</div>'+
	    		'<div id="buttonDiv" class="mL15 flexC">'+
					'{{footer_button}}'+//NO I18N
				'</div>'+
			'</div>',
		
		_footerButton : 
			'{{cancel_tick}}'+//NO I18N
			'<div purpose={{purpose}} class="zcl-btn-sm {{footer_btn}}" filesharebuttons>'+
				'{{label}}'+//NO I18N
			'</div>'
	};
	
	function _getFileShareWrapper(state, connectionId, fileId)
	{
		var customClass = "";
		if(state == "COMPLETED")
		{
			customClass = "p2p-success";//NO I18N
		}
		else if(state == "FAILED")
		{
			customClass = "p2p-failed";//NO I18N
		}
		var wrapperHtml = $WC.template.replace(_templates._fileShareWrapperUI, {
			headerUIHtml : _getHeaderHtml(state,connectionId),
			footerUIHtml : _getFooterHtml(state,connectionId)
		}, "InSecureHTML");																																	//NO I18N
		
		wrapperHtml = $WC.template.replace(wrapperHtml, {
			custom_class : customClass,
			file_id : "file" + fileId,					//NO I18N
			conn_id : connectionId
		});
		
		return wrapperHtml;
	}
	
	function _getHeaderHtml(state,connectionId)
	{
		var fileShareHeader = $WC.template.replace(_templates._fileShareHeaderUI, {
			fileContentHtml : state == "COMPLETED" ? "" : _getFileContentHtml(state,connectionId), //NO I18N
			tick_open : state == "COMPLETED" ? _templates._openFileUI : ""//NO I18N
		}, "InSecureHTML");//NO I18N
		
		fileShareHeader = $WC.template.replace(fileShareHeader, {
			file_name : FileShare.getSession(connectionId).getFileName()
		});
		
		return fileShareHeader;
	}
	
	function _getFileContentHtml(state,connectionId)
	{
		if(state == "WAITING")
		{
			var fileDetailsHtml = $WC.template.replace(_templates._fileDetailsUI, {
				size_label : Resource.getRealValue("fileshare.size"),
				time_label : Resource.getRealValue("fileshare.estimatedtime"),
				file_size : FileShare.getSession(connectionId).getTotalFileSize(),
				estimated_time : FileShare.getSession(connectionId).getEstimatedTime()
			});
		}
		else
		{
			var fileDetailsHtml = $WC.template.replace(_templates._progressBarUI, {
				remaining_time : state == "DOWNLOADING" ? '<span class="mL30"><span class="p2p-info-txt mR5" name="state" >'+ Resource.getRealValue("fileshare.remainingtime") +'</span>' + FileShare.getSession(connectionId).getTimeLeft() + '</span>' : ""
			}, "InSecureHTML");//NO I18N
			
			fileDetailsHtml = $WC.template.replace(fileDetailsHtml, {
				percentage : "0%",
				current_percentage : state == "DOWNLOADING" ? "0 %" : Resource.getRealValue("fileshare.failed")//NO I18N
			});
		}
		
		return fileDetailsHtml;
	}
	
	function _getFooterHtml(state,connectionId)
	{
		if(state == "COMPLETED")
		{
			return "";
		}
		var fileShareFooter = $WC.template.replace(_templates._fileShareFooterUI, {
			footer_button : _getFooterButton(state,connectionId),
			user_img : '"'+ Users.getImgUrlById(FileShare.getSession(connectionId).getPeerUserId()) + '"'
		}, "InSecureHTML");//NO I18N
		
		fileShareFooter = $WC.template.replace(fileShareFooter, {
			transfer_state : Resource.getRealValue("fileshare.connecting")
		});
		
		return fileShareFooter;
	}
	
	function _getFooterButton(state,connectionId)
	{
		if(state == "WAITING")
		{
			var label = Resource.getRealValue("common.accept");
			var btnClass = "zcl-btn--primary mL10";//NO I18N
			var purpose = "acceptFileShare";//NO I18N
			var cancelTick = '<div purpose="rejectFileShare" class="zcl-icon-round--secondary zcf-closeB font12" filesharebuttons></div>';
			if(FileShare.getSession(connectionId).isCurrentUser())
			{
				label = Resource.getRealValue("common.cancel");
				btnClass = "zcl-btn--secondary";//NO I18N
				purpose = "closeFileShare";//NO I18N
				cancelTick = "";
			}
			var footerBtn = $WC.template.replace(_templates._footerButton, {
				footer_btn : btnClass,
				purpose : purpose,
				label : label,
				cancel_tick : cancelTick
			},"InSecureHTML");//NO I18N
		}
		else if(state == "DOWNLOADING")
		{
			var footerBtn = $WC.template.replace(_templates._footerButton, {
				label : Resource.getRealValue("common.cancel"),
				footer_btn : "zcl-btn--secondary",//NO I18N
				purpose : "closeFileShare",//NO I18N
				cancel_tick : ""
			},"InSecureHTML");//NO I18N
		}
		else
		{
			var footerBtn = $WC.template.replace(_templates._footerButton, {
				label : Resource.getRealValue("fileshare.shareagain"),
				footer_btn : "zcl-btn--primary mL10",//NO I18N
				purpose : "shareAgain",//NO I18N
				cancel_tick : '<div id="closeFileShare" class="zcl-icon-round--secondary zcf-closeB font12" filesharebuttons></div>'
			},"InSecureHTML");//NO I18N
		}
		return footerBtn;
	}
	
	return{
		getFileShareWrapper : _getFileShareWrapper,
		getContentDiv : _getFileContentHtml,
		getFooterBtn : _getFooterButton
	};
	
}())

var FileShareImpl = {
	
	bindEvents : function()
	{
		var doc = $(document);
		doc.on("click", "[filesharebuttons]", function(event)
		{
			event.stopPropagation();
			var elem = $(this);
			var purpose = elem.attr("purpose");
			var connectionId = elem.parents('[connectionid]').attr("connectionid");
			FileShareEventHandler.UIEvents[purpose](connectionId);
		});
	},
	
	initialize : function(elementId, connectionId, text)
	{
		var html = FileShareTemplates.getFileShareWrapper("WAITING", connectionId, elementId);//NO I18N
		if(!$("#filesharespaceglobal").length)
		{
			var ele = '<div id="filesharespaceglobal" class="zcvidincm" style="width:430px;"></div>';
			$('body').append(ele);
		}
		var rootEle = $("#filesharespaceglobal");
		rootEle.append(html);
		rootEle.setAsDraggable();
		$("#file"+elementId).find('#currentState').text(text);
	},
	
	removeUI : function(element)
	{
		element.remove();
		if($("#filesharespaceglobal").children().length == 0)
		{
			$("#filesharespaceglobal").remove();
		}
	},
	
	updateContent : function(connectionId)
	{
		var fileShareSession = FileShare.getSession(connectionId);
		var elementId = fileShareSession.getCurrentFileShareElementId();
		var element = $("#file"+elementId);
		
		var headerDiv = FileShareTemplates.getContentDiv("DOWNLOADING", connectionId);
		var fileContentUi = element.find('#contentDiv [name = fileContent]');
		fileContentUi.empty();
		fileContentUi.append(headerDiv);
		element.find('#userImg > img').attr("src", Users.getImgUrlById(fileShareSession.getPeerUserId()));
		
		var footerBtn = FileShareTemplates.getFooterBtn("DOWNLOADING", connectionId);
		element.find('#buttonDiv').replaceWith(footerBtn);
	},
	
	updateProgressBar : function(connectionId, sentChunks, totalChunks)
	{
		var elementId = FileShare.getSession(connectionId).getCurrentFileShareElementId();
		var element = $("#file" + elementId);
		var percentage =  (sentChunks/totalChunks)*100;
		element.find('[name = content]').removeClass('p2p-failed');
		element.find('#progressTxt > [name = percentage]').text(percentage.toFixed(1) + "%");
		element.find('#progressTxt > [name = state]').removeClass('dN');
		element.find('#progressBar > span').css('width', percentage.toFixed(2) + "%");
	},
	
	updateState : function(connectionId, text)
	{
		var elementId = FileShare.getSession(connectionId).getCurrentFileShareElementId();
		var element = $("#file"+elementId);
		element.find('#currentState').text(text);
		var fileContentUi = element.find('#contentDiv [name = fileContent]');
		fileContentUi.empty();
		fileContentUi.append('<span class="p2p-info-txt">' + Resource.getRealValue("fileshare.error") + '</span>');
	},
	
	showFailedRipple : function(connectionId)
	{
		var elementId = FileShare.getSession(connectionId).getCurrentFileShareElementId();
		var element = $("#file"+elementId);
		element.find('[name = "content"]').addClass('p2p-failed');
	},
	
	updateFailedState : function(connectionId)
	{
		var elementId = FileShare.getSession(connectionId).getCurrentFileShareElementId();
		var element = $("#file"+elementId);
		FileShareImpl.showFailedRipple(connectionId);
		element.find('#progressTxt > [name = percentage]').text(Resource.getRealValue("fileshare.failed"));
		element.find('#progressTxt > [name = name]').addClass('dN');
		element.find('#currentState').text(Resource.getRealValue("fileshare.networkbusy"));
	},
	
	updateReconnected : function(connectionId)
	{
		var elementId = FileShare.getSession(connectionId).getCurrentFileShareElementId();
		var element = $("#file" + elementId);
		element.find('#progressTxt > [name = percentage]').text(Resource.getRealValue("fileshare.retry"));
	},
	
	updateFileInfo : function(connectionId)
	{
		var session = FileShare.getSession(connectionId);
		if(typeof session !== "undefined")
		{
			var currIndex = session.getCurrentFileIndex() + 1;
			var totalFiles = session.getMetaData().length;
			if(session.isCurrentUser())
			{
				var text = Resource.getRealValue("fileshare.sentfiles",[currIndex, totalFiles]);
			}
			else
			{
				var text = Resource.getRealValue("fileshare.receivedfiles",[currIndex, totalFiles]);
			}
			var elementId = FileShare.getSession(connectionId).getCurrentFileShareElementId();
			var element = $("#file" + elementId);
			element.find('#currentState').text(text);
			element.find("#fileName").text(FileShare.getSession(connectionId).getFileName());			
		}
	},
	
	updateBtn : function(elementId)
	{
		var elem = $("#file"+elementId).find('[purpose = "closeFileShare" ]');
		elem.attr('purpose','closeFileShare');
		elem.text(Resource.getRealValue("common.close"));
	}
}
