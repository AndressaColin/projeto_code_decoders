<?php 
include 'conexao.php';
$nome = $_POST['nome'];
$email = $_POST['email'];
$senha = password_hash($_POST['senha'], PASSWORD_DEFAULT);  

$sql = "INSERT INTO usuarios (nome, email, senha) VALUES ('$nome', '$email','$senha')";
if ($conexao->query($sql) === TRUE) {
    echo "Cadastro realizado com sucesso!";
} else {
    echo "Erro: " . $conexao->error;
}