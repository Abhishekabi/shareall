var FileShareTemplate = {};
var FileShareAPI = {};
var FileShareImpl = {};

var addFriend = function() {
  var email = $("#searchBox > input").val();
  if (email.length > 0) {
    if (email != $user.email) FileShareAPI.searchUser(email);
  }
  $("#searchBox > input").val("");
};

$(window).on("load", function() {
  FileShareAPI.getFriends();
  // search event on keypress
  $("#searchBox > input").on("keypress", function(e) {
    if (e.which == 13) {
      addFriend();
    }
  });
  // search event on button click
  $("#searchBox > button").on("click", () => {
    addFriend();
  });
});

FileShareTemplate = {
  friendList: function(uid, name, initial) {
    return `<div class="contact" uid="${uid}">
              <div class="user-img">${initial}</div>
              <div class="user-name" uname>${name}</div>
              <div unfriendButton class="options"></div>
          </div>`;
  },

  shareArea: function(uid, name, initial) {
    var classname = "";
    var text = "select a file to share";
    var button_ele = `<input id="file-upload" type="file" style="display:none" />
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

FileShareAPI = {
  getFriends: function() {
    $.ajax({
      url: "/api/friends",
      type: "GET",
      dataType: "json",
      success: function(res) {
        $user.friends = res;
        FileShareImpl.updateUI(res);
      }
    });
  },
  addFriend: function({ _id, name, email }) {
    $.ajax({
      url: "/api/friends",
      type: "PUT",
      dataType: "json",
      data: { uid: _id, name: name, email: email },
      success: function(res) {
        if (!res.error) {
          $user.friends = res;
          FileShareImpl.updateUI(res);
        }
      }
    });
  },
  searchUser: function(email) {
    $.ajax({
      url: `/api/profile/search?email=${email}`,
      type: "GET",
      dataType: "json",
      success: function(resp) {
        if (!resp.usernotfound && resp != null) FileShareAPI.addFriend(resp);
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
};

FileShareImpl = {
  bindEvents: function() {
    // unfriend handler
    $("[unfriendButton]").on("click", event => {
      event.stopPropagation();
      if (confirm(`Do you want to remove this contact ?`)) {
        var ele = $(event.target).parent();
        var uid = ele.attr("uid");
        FileShareAPI.unfriend(uid);
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
      var html = FileShareTemplate.shareArea(uid, name, name.charAt(0));
      $(".right-pannel").empty();
      $(".right-pannel").append(html);
      // bind filepicker event
      $("#file-upload").on("change", function(event) {
        file = event.target.files[0];
        if (!file) {
          console.log("No file chosen");
          return;
        } else if (file.size === 0) {
          console.log("File is empty, please select a non-empty file");
          return;
        } else {
          console.log("ssss");
        }
      });
    });
  },
  updateUI: function(friends) {
    // show friendlist
    for (var i = 0; i < friends.length; i++) {
      var uname = friends[i].name;
      var uid = friends[i].uid;
      var html =
        html + FileShareTemplate.friendList(uid, uname, uname.charAt(0), true);
    }
    $(".contacts").empty();
    $(".contacts").append(html);
    this.bindEvents();
  }
};
