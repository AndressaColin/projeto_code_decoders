

// Sistema de Login Simples
document.getElementById('btnLogin').addEventListener('click', () => {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value.trim();

  if (user === 'admin' && pass === '1234') {
    localStorage.setItem('loggedUser', user);
    console.log("Login bem-sucedido. Redirecionando...");
    window.location.href = "/private/Html/sistemaEstoque.html"; // abre o sistema
  } else {
    alert("Usuário ou senha incorretos!");
  }
});