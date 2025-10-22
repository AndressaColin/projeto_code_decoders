<?php
include 'conexao.php';
$email = $_POST['email'];
$senha = $_POST['senha'];

$res = $conexao->query("SELECT * FROM usuarios WHERE email='$email'");
if ($res->num_rows > 0) {
    $user = $res->fetch_assoc();
    if (password_verify($senha, $user['senha'])) {
        session_start();
        $_SESSION['user'] = $user['nome'];
        header("Location: /private/sistemaEstoque.php");
    } else {
        echo "Senha incorreta.";
    }
} else {
    echo "Usuário não encontrado.";
}
?>
