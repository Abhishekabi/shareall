// UI handlers
var mediaQueries = function(x) {
  var ele = $("nav").find("[login_div]");
  if (x.matches) {
    ele.text("Already a user? Login");
  } else {
    ele.text("Login");
  }
};
var minWindowWidth = window.matchMedia("(max-width: 500px)");
minWindowWidth.addListener(mediaQueries);

let registerForm = $("#modalRegisterForm");
let registerCloseBtn = registerForm.find('[aria-label="Close"]');
let signupButton = registerForm.find("#signupsubmit");

let loginForm = $("#modalLoginForm");
let loginCloseBtn = loginForm.find('[aria-label="Close"]');
let loginButton = loginForm.find("#loginsubmit");

signupButton.on("click", event => {
  let name = $("#orangeForm-name");
  let email = $("#orangeForm-email");
  let pass = $("#orangeForm-pass");
  $.ajax(`/api/auth/register`, {
    type: "POST",
    dataType: "json",
    data: {
      name: name.val(),
      email: email.val(),
      password: pass.val()
    },
    success: function(data, status, xhr) {
      registerCloseBtn.click();
      console.log(data);
    },
    error: function(jqXhr, textStatus, errorMessage) {
      handleError(jqXhr.responseJSON);
    }
  });
  // resetForm
  name = email = pass = "";
});

loginButton.on("click", event => {
  let email = $("#defaultForm-email");
  let pass = $("#defaultForm-pass");
  $.ajax(`/api/auth/login`, {
    type: "POST",
    data: {
      email: email.val(),
      password: pass.val()
    },
    success: function(data, status, xhr) {
      loginCloseBtn.click();
      console.log(data);
    },
    error: function(jqXhr, textStatus, errorMessage) {
      handleError(jqXhr.responseJSON);
    }
  });
  // resetForm
  email = pass = "";
});

var handleError = function(data) {
  // notify error to user
  console.log(data);
};
