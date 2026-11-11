# UG Signaler
OBS: Essa pasta deve ser subida em um repositório a parte para ser colocado em produção, por exemplo no Render ou Railway.

## Servidor responsável pela Sinalização inicial entre jogadores em P2P

- Esse servidor é responsável por essa parte
    - Signaling (Sinalizador): Apenas troca endereços IP e portas entre os dois jogadores. É exatamente o que o nosso script Python faz (a "telefonista").

- Essa parte o projeto Haxe usa serviços do Google
    - STUN: Descobre qual é o IP público do roteador de cada jogador (já estamos usando o stun.l.google.com:19302 no código Haxe).

- Será feito no futuro (Epic e Steam possuem APIs já prontas para isso)
    - TURN (Relay): Um servidor de repasse pesado. Quando dois jogadores estão atrás de um NAT Estrito (CGNAT, comum em redes móveis ou de bairro), o P2P direto é bloqueado pelo roteador. O tráfego de dados do jogo passa a transitar pelo servidor TURN.

## Links:
- https://dashboard.render.com/web/srv-d90p0r37uimc739j0jt0
- https://ug-signaler.onrender.com
- wss://ug-signaler.onrender.com