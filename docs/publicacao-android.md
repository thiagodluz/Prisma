# Publicação Android

O workflow `release.yml` publica apenas quando uma tag `v<versão>` é enviada. É preciso configurar **antes da primeira tag** quatro segredos no repositório GitHub:

- `PRISMA_KEYSTORE_BASE64`: conteúdo do keystore de release codificado em base64, em uma linha;
- `PRISMA_KEYSTORE_PASSWORD`: senha do keystore;
- `PRISMA_KEY_ALIAS`: alias da chave;
- `PRISMA_KEY_PASSWORD`: senha da chave.

Crie o keystore localmente com `keytool -genkeypair -v -keystore prisma-release.jks -alias prisma -keyalg RSA -keysize 3072 -validity 10000`. Codifique-o com `base64 -w 0 prisma-release.jks` no Linux ou `base64 -i prisma-release.jks | tr -d '\n'` no macOS. Guarde **o arquivo original e as senhas fora do repositório**, com backup seguro; sem eles, não será possível assinar atualizações com a mesma identidade. Arquivos `.jks` e `.keystore` são ignorados pelo Git.

Em cada publicação:

1. Defina a versão em `package.json` (por exemplo, `1.0.3` ou `1.0.3-beta.1`) e aumente `versionCode` em `android/app/build.gradle`. O número deve superar o de todo APK anterior, inclusive betas.
2. Rode `npm run sync:version`, `npm run build:offline`, `npm run check:version`, `npm run check:offline` e `npm test`.
3. Faça commit das alterações e crie/envie a tag `v<versão>` no commit testado. O workflow verifica a correspondência da tag antes de publicar.

Os builds `assembleDebug` em commits e pull requests servem apenas para teste e não são publicados como artefatos instaláveis. As versões 1.0.2 e anteriores foram distribuídas com assinaturas de depuração distintas; o primeiro APK com a chave de release exige desinstalar o APK antigo se a assinatura instalada for diferente, o que apaga os dados locais do aplicativo. Avise os jogadores nas notas dessa primeira publicação.
