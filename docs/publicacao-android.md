# Publicação Android

O workflow `release.yml` publica quando uma tag `v<versão>` é enviada ou quando é executado manualmente na branch `main` pela aba Actions. Na execução manual, ele cria a tag e a release somente após compilar e verificar o APK assinado. É preciso configurar **antes da primeira publicação** quatro segredos no repositório GitHub:

- `PRISMA_KEYSTORE_BASE64`: conteúdo do keystore de release codificado em base64, em uma linha;
- `PRISMA_KEYSTORE_PASSWORD`: senha do keystore;
- `PRISMA_KEY_ALIAS`: alias da chave;
- `PRISMA_KEY_PASSWORD`: senha da chave.

O keystore permanente deste projeto é `prisma-release.p12` (PKCS#12), com alias `prisma`. A cópia de recuperação e a senha devem ser guardadas fora do repositório; sem elas, não será possível assinar atualizações com a mesma identidade. Para uma nova chave em outro fork, gere com `keytool -genkeypair -storetype PKCS12 -keystore prisma-release.p12 -alias prisma -keyalg RSA -keysize 4096 -validity 10000`. Codifique-a com `base64 -w 0 prisma-release.p12` no Linux ou `base64 -i prisma-release.p12 | tr -d '\n'` no macOS. Arquivos `.p12`, `.jks` e `.keystore` são ignorados pelo Git.

Em cada publicação:

1. Defina a versão em `package.json` (por exemplo, `1.0.4` ou `1.0.4-beta.1`). Execute `npm run sync:version` para calcular o `versionCode` Android: `major × 1.000.000 + minor × 10.000 + patch × 100 + sufixo` (99 para a versão final; 1 a 98 para betas). A versão deve superar a de todo APK anterior, inclusive betas. A 1.0.3 publicada usava o código 8; o esquema novo vale para versões futuras.
2. Rode `npm run sync:version`, `npm run build:offline`, `npm run check:version`, `npm run check:offline`, `npm run check:publish-version` e `npm test`. O nome do cache do navegador inclui um hash dos arquivos listados no Service Worker; a CI compara os arquivos distribuídos com a última tag para exigir aumento da versão.
3. Faça commit das alterações e execute manualmente o workflow na `main`; ele cria a tag no commit testado. Alternativamente, crie/envie a tag `v<versão>` no commit testado; o workflow verifica a correspondência antes de publicar.

Os builds `assembleDebug` em commits e pull requests servem apenas para teste e não são publicados como artefatos instaláveis. As versões 1.0.2 e anteriores foram distribuídas com assinaturas de depuração distintas; o primeiro APK com a chave de release exige desinstalar o APK antigo se a assinatura instalada for diferente, o que apaga os dados locais do aplicativo. Avise os jogadores nas notas dessa primeira publicação.
