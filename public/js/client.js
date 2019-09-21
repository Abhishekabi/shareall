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
});

loginButton.on("click", event => {
  let email = $("#defaultForm-email");
  let pass = $("#defaultForm-pass");
});
