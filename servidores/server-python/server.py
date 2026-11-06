"""
server.py — servidor mínimo em Python, usando SÓ a biblioteca padrão (http.server).

Papel deste arquivo na arquitetura (item 1): é o SERVIDOR, cumprindo exatamente o mesmo
papel que servidores/server-node/server.js — ouvir uma porta TCP (item 2) e responder
requisições HTTP (item 2) devolvendo os arquivos estáticos de frontend/ (item 3/4).

A comparação com server.js é o ponto central da demonstração do item 4: linguagens e
ecossistemas diferentes, mesmo papel na arquitetura.
"""

import http.server
import os

PORTA = 8000
PASTA_FRONTEND = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")


class ManipuladorFrontend(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PASTA_FRONTEND, **kwargs)


class ServidorReutilizavel(http.server.HTTPServer):
    # Sem isso, se o processo anterior não for encerrado "limpo" (comum no Windows,
    # onde o Ctrl+C às vezes demora a ser entregue), a porta pode ficar presa por
    # alguns segundos e o próximo "python server.py" falha com "Address already in use".
    allow_reuse_address = True


if __name__ == "__main__":
    servidor = ServidorReutilizavel(("", PORTA), ManipuladorFrontend)
    print(f"Servidor Python rodando em http://localhost:{PORTA}")
    print("Servindo arquivos estáticos de:", os.path.abspath(PASTA_FRONTEND))
    print("Pressione Ctrl+C para encerrar (no Windows, se não fechar de primeira, tente de novo ou Ctrl+Break).")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando servidor...")
    finally:
        servidor.server_close()
