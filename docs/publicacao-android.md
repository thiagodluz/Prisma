# Publicação Android

O workflow `release.yml` publica apenas quando uma tag `v<versão>` é enviada. É preciso configurar **antes da primeira tag** quatro segredos no repositório GitHub:

- `PRISMA_KEYSTORE_BASE64`: conteúdo do keystore de release codificado em base64, em uma linha;
- `PRISMA_KEYSTORE_PASSWORD`: senha do keystore;
- `PRISMA_KEY_ALIAS`: alias da chave;
- `PRISMA_KEY_PASSWORD`: senha da chave.

O keystore permanente deste projeto é `prisma-release.p12` (PKCS#12), com alias `prisma`. A cópia de recuperação e a senha devem ser guardadas fora do repositório; sem elas, não será possível assinar atualizações com a mesma identidade. Para uma nova chave em outro fork, gere com `keytool -genkeypair -storetype PKCS12 -keystore prisma-release.p12 -alias prisma -keyalg RSA -keysize 4096 -validity 10000`. Codifique-a com `base64 -w 0 prisma-release.p12` no Linux ou `base64 -i prisma-release.p12 | tr -d '\n'` no macOS. Arquivos `.p12`, `.jks` e `.keystore` são ignorados pelo Git.

Em cada publicação:

1. Defina a versão em `package.json` (por exemplo, `1.0.3` ou `1.0.3-beta.1`) e aumente `versionCode` em `android/app/build.gradle`. O número deve superar o de todo APK anterior, inclusive betas.
2. Rode `npm run sync:version`, `npm run build:offline`, `npm run check:version`, `npm run check:offline` e `npm test`.
3. Faça commit das alterações e crie/envie a tag `v<versão>` no commit testado. O workflow verifica a correspondência da tag antes de publicar.

Os builds `assembleDebug` em commits e pull requests servem apenas para teste e não são publicados como artefatos instaláveis. As versões 1.0.2 e anteriores foram distribuídas com assinaturas de depuração distintas; o primeiro APK com a chave de release exige desinstalar o APK antigo se a assinatura instalada for diferente, o que apaga os dados locais do aplicativo. Avise os jogadores nas notas dessa primeira publicação.
