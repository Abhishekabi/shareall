var FileShareTemplate = {};
var clientAPI = {};
var userProfileImpl = {};

// global object to store loggedin user details
var $user = {};
var $fshare = {};

var addFriend = function() {
  var email = $("#searchBox > input").val();
  if (email.length > 0) {
    if (email != $user.email) clientAPI.crudEvents.searchUser(email);
  }
  $("#searchBox > input").val("");
};

$(window).on("load", function() {
  clientAPI.crudEvents.getUserInfo();
  clientAPI.crudEvents.getFriends();
  // search event on keypress
  $("#searchBox > input").on("keypress", function(e) {
    if (e.which == 13) addFriend();
  });
  // search event on button click
  $("#searchBox > button").on("click", () => {
    addFriend();
  });
});

FileShareTemplate = {
  friendList: function(uid, name, initial, isonline) {
    var classname = isonline ? "" : "status-offline";
    return `<div class="contact" uid="${uid}">
              <div class="status ${classname}"></div>
              <div class="user-img">${initial}</div>
              <div class="user-name" uname>${name}</div>
              <div unfriendButton class="options"></div>
          </div>`;
  },

  shareArea: function(uid, name, initial) {
    var classname = "";
    var text = "select a file to share";
    var button_ele = `<input id="file-upload" type="file" style="display:none" multiple/>
                      <label for="file-upload" class="button send-btn">Select File</label>`;
    $.ajax({
      url: `/api/profile/search?id=${uid}`,
      type: "GET",
      dataType: "json",
      async: false,
      success: function(resp) {
        var isOnline = resp.isonline;
        if (!isOnline) {
          classname = "status-offline";
          text = `waiting for ${name} to come online...`;
          button_ele = "";
        }
      }
    });
    return `<div uid=${uid} class="chat-head">
              <div class="status ${classname}"></div>
              <div class="user-img">${initial}</div>
              <div class="user-name">${name}</div>
              <div class="options close-chat-btn"></div>
          </div>
          <div class="chat-body">
              <div class="main-pannel"></div>
              <div class="chat-footer">
                  ${button_ele}
                  <div class="footer-text">${text}</div>
              </div>
          </div>`;
  },

  shareProgress: function() {
    return `<div class="top-wrapper">
              <div class="fileshare-progress">
                  <div class="media-icon">
                      <img src="./img/media-icon.svg"/>
                  </div>
                  <div class="progressbar">
                      <div class="file-name">${filename}</div>
                      <div class="main-bar">
                          <span class="sub-bar" style="width: 0%;"></span>
                      </div>
                      <div class="share-percentage">${percentage}</div>
                  </div>
              </div>
          </div>
          <div class="bottom-wrapper">
              <div class="fileshare-statusbar">
                  <span id="fileshare-state">${status}</span>
                  <div class="fileshare-btn">
                      <div class="button accept-btn">Accept</div>
                      <div class="button cancel-btn">Cancel</div>
                  </div>
              </div>
          </div>`;
  }
};

clientAPI = {
  crudEvents: {
    getUserInfo: function() {
      $.ajax({
        url: "/api/profile/me",
        type: "GET",
        dataType: "json",
        success: function(data) {
          $user = data;
          socket.emit("createRoom", { id: data.uid });
        }
      });
    },
    getFriends: function() {
      $.ajax({
        url: "/api/friends",
        type: "GET",
        dataType: "json",
        success: function(res) {
          $user.friends = res;
          userProfileImpl.updateUI(res);
        }
      });
    },
    addFriend: function(uid) {
      $.ajax({
        url: "/api/friends",
        type: "PUT",
        dataType: "json",
        data: { uid },
        success: function(res) {
          if (!res.error) clientAPI.crudEvents.getFriends();
        }
      });
    },
    searchUser: function(email) {
      $.ajax({
        url: `/api/profile/search?email=${email}`,
        type: "GET",
        dataType: "json",
        success: function(resp) {
          if (!resp.usernotfound && resp != null)
            clientAPI.crudEvents.addFriend(resp._id);
        }
      });
    },
    unfriend: function(uid) {
      $.ajax({
        url: "/api/friends",
        type: "DELETE",
        dataType: "json",
        data: { uid: uid }
      });
    }
  }
};

userProfileImpl = {
  bindEvents: function() {
    // unfriend handler
    $("[unfriendButton]").on("click", event => {
      event.stopPropagation();
      if (confirm(`Do you want to remove this contact ?`)) {
        var ele = $(event.target).parent();
        var uid = ele.attr("uid");
        clientAPI.crudEvents.unfriend(uid);
        $user.friends.forEach((friend, i) => {
          if (friend.uid == $(".chat-head").attr("uid"))
            $(".right-pannel").empty();
        });
        ele.remove();
      }
    });
    // user share opener
    $(".contact").on("click", event => {
      event.stopPropagation();
      var ele = $(event.currentTarget);
      var uid = ele.attr("uid");
      var name = ele.find("[uname]").text();
      $fshare.currentChatUserId = uid;
      var html = FileShareTemplate.shareArea(uid, name, name.charAt(0));
      $(".right-pannel").empty();
      $(".right-pannel").append(html);
      socket.emit("join", { id: $fshare.currentChatUserId });
      // bind filepicker event
      $("#file-upload").on("change", function(event) {
        file = event.target.files;
        if (!file || file.length == 0) {
          console.log("No file chosen");
          return;
        } else if (file.size === 0) {
          console.log("File is empty, please select a non-empty file");
          return;
        } else {
          FileShare.initiate($fshare.currentChatUserId, file);
        }
      });
      // handle close btn click
      $(".close-chat-btn").on("click", event => {
        if (confirm(`Do you want to close this chat ?`)) {
          $fshare.currentChatUserId = "";
          $(`.right-pannel`).empty();
          // get out of the room
        }
      });
    });
  },
  updateUI: function(friends) {
    // show friendlist
    for (var i = 0; i < friends.length; i++) {
      var uname = friends[i].name;
      var uid = friends[i]._id;
      var isonline = friends[i].isonline;
      var html =
        html +
        FileShareTemplate.friendList(uid, uname, uname.charAt(0), isonline);
    }
    $(".contacts").empty();
    $(".contacts").append(html);
    this.bindEvents();
  },
  updateOnlineStatus: function({ uid, isonline }) {
    $user.friends.forEach(friend => {
      if (friend._id == uid) {
        var elem = $(`.right-pannel [uid=${uid}]`).find(".status");
        $fshare.currentChatUserId == uid && isonline
          ? elem.removeClass("status-offline")
          : elem.addClass("status-offline");
        var ele = $(`.contacts [uid=${uid}]`).find(".status");
        isonline
          ? ele.removeClass("status-offline")
          : ele.addClass("status-offline");
      }
    });
  }
};
