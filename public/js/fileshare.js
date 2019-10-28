// To handle file upload
var file;

$("#filepicker").on("change", function(event) {
  file = event.target.files[0];
  if (!file) {
    console.log("No file chosen");
    return;
  } else if (file.size === 0) {
    console.log("File is empty, please select a non-empty file");
    return;
  } else {
    var RTCConnection = new FileShareRTCConnection(
      "1001",
      "1234",
      null,
      {
        url: "turn:192.158.29.39:3478?transport=udp",
        credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
        username: "28224511:1379330808"
      },
      true,
      null,
      null,
      file
    );
  }
});
