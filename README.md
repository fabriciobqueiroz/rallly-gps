# Rally GPS · Teste (etapa 1)

App Android de teste para validar a parte mais crítica de um app de rally de regularidade:
**gravar o GPS com a tela apagada**. Mostra velocidade, distância, tempo, precisão e,
principalmente, o **maior buraco sem pontos** (se o Android "dormiu" o GPS).

## Como gerar o APK (sem computador de desenvolvimento)

1. Crie uma conta gratuita em github.com e um repositório novo (pode ser privado), por exemplo `rally-gps`.
2. No repositório, clique em **Add file > Upload files** e envie **todo o conteúdo desta pasta**
   (inclusive a pasta oculta `.github`). Se o upload não mostrar pastas ocultas, use o GitHub Desktop
   ou arraste a pasta inteira.
3. Vá na aba **Actions**, escolha **Gerar APK Android** e clique em **Run workflow**.
4. Espere cerca de 10 a 20 minutos. Ao terminar, abra a execução e baixe **rally-gps-teste-apk** (um .zip com o .apk).
5. Passe o .apk para o celular Android, abra e instale
   (o Android vai pedir para permitir "instalar apps desconhecidos" para o app que você usou para abrir o arquivo).

## Como testar

1. Abra o app, toque em **Iniciar gravação**, permita a localização e, na tela de configurações,
   escolha **Permitir o tempo todo**.
2. Em Configurações do Android > Apps > Rally GPS Teste > Bateria, escolha **Sem restrições**
   (alguns fabricantes, como Xiaomi e Samsung, matam o app em segundo plano; veja dontkillmyapp.com).
3. Bloqueie a tela e ande ou dirija por 10 a 15 minutos.
4. Volte ao app e confira:
   - **Maior buraco sem pontos**: quanto menor melhor (ideal 2 a 3 s; acima de 10 s é problema).
   - **Distância** comparada com o hodômetro do carro ou com o Kraken Rally.
   - **Precisão** em campo aberto (esperado até uns 5 a 10 m).
5. Toque em **Exportar CSV** para enviar o log (WhatsApp, e-mail) e me mostrar o resultado.

Teste em mais de um aparelho e anote marca e modelo.
