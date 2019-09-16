let registerForm = $("#modalRegisterForm");
let registerCloseBtn = registerForm.find('[aria-label="Close"]');
let submitSignup = registerForm.find("#signupsubmit");

let loginForm = $("#modalLoginForm");
let loginCloseBtn = loginForm.find('[aria-label="Close"]');
let submitLogin = loginForm.find("#loginsubmit");

submitSignup.on("click", event => {
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
      console.log(data);
    },
    error: function(jqXhr, textStatus, errorMessage) {
      handleError(jqXhr.responseJSON);
    }
  });
  // resetForm
  name = email = pass = "";
});

submitLogin.on("click", event => {
  let email = $("#defaultForm-email");
  let pass = $("#defaultForm-pass");
  $.ajax(`/api/auth/login`, {
    type: "POST",
    data: {
      email: email.val(),
      password: pass.val()
    },
    success: function(data, status, xhr) {
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
  console.log(data);
};
