let registerForm = $("#modalRegisterForm");
let registerCloseBtn = registerForm.find('[aria-label="Close"]');
let userCircle = $("#usercircle");
let loginForm = $("#modalLoginForm");
let loginCloseBtn = loginForm.find('[aria-label="Close"]');

registerCloseBtn.on("click", event => {
  let name = $("#orangeForm-name");
  let email = $("#orangeForm-email");
  let pass = $("#orangeForm-pass");
  name.val("");
  email.val("");
  pass.val("");
});

loginCloseBtn.on("click", event => {
  let email = $("#defaultForm-email");
  let pass = $("#defaultForm-pass");
  email.val("");
  pass.val("");
});

userCircle.on("click", event => {
  let profileDropdownUI = $("#dropdown-menu");
  if (profileDropdownUI.css("visibility") === "hidden") {
    profileDropdownUI.removeClass("dN");
  } else {
    profileDropdownUI.addClass("dN");
  }
});
