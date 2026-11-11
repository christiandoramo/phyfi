#!/bin/bash
cd ../ctx || exit

# Testa a execução real para driblar os "atalhos falsos" da Microsoft Store
if python3 -c "" &>/dev/null; then
    PYTHON_CMD="python3"
elif py -c "" &>/dev/null; then
    PYTHON_CMD="py"
elif python -c "" &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "Erro: Python não foi encontrado ou os executáveis não estão respondendo."
    exit 1
fi

$PYTHON_CMD init.py