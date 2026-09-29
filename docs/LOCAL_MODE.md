# Running UniCore fully locally

Everything runs on one machine: no GCP project, no Firebase project, no cloud relay.
The provider machine is the same Windows box, with Docker Desktop.

| Cloud piece | Local stand-in |
|---|---|
| Firebase Auth | Firebase Auth emulator (`:9099`) |
| Firestore | Firestore emulator (`:8085`) |
| FRP relay on GCP | `frps` in Docker (`:7000`, SSH ports `2222-2300`) |
| Secret Manager, GCS, Artifact Registry | Not used; the apps log a warning and carry on. Volume backups and snapshots are off. |

The apps switch to the emulators only when `FIRESTORE_EMULATOR_HOST` /
`FIREBASE_AUTH_EMULATOR_HOST` are set, so production behaviour is unchanged.

## 1. Relay and emulators

```bash
docker run -d --name unicore-frps -p 7000:7000 -p 2222-2300:2222-2300 \
  -v "$PWD/infrastructure/local/frps.toml:/etc/frp/frps.toml" snowdreamtech/frps:0.61.0

cd infrastructure/local
npx firebase-tools emulators:start --only auth,firestore --project unicore-junior-design
```

## 2. Apps (.NET 10)

```bash
export FIRESTORE_EMULATOR_HOST=localhost:8085
export FIREBASE_AUTH_EMULATOR_HOST=localhost:9099
export GOOGLE_CLOUD_PROJECT=unicore-junior-design

# Provider: containers reach the relay through Docker's host alias
cd providerunicore && ASPNETCORE_URLS=http://localhost:5133 \
  FrpRelay__ServerAddr=host.docker.internal Provisioning__TimeoutSeconds=600 dotnet run

# Consumer: the web shell connects to the relay on this machine
cd consumerunicore && ASPNETCORE_URLS=http://localhost:5157 \
  FrpRelay__ServerAddr=localhost dotnet run
```

## 3. Use it

1. Register a provider at http://localhost:5133/provider-login and a consumer at
   http://localhost:5157/client-login.
2. Verify both emails: the Auth emulator lists the links at
   `http://localhost:9099/emulator/v1/projects/unicore-junior-design/oobCodes`.
3. Provider: finish onboarding (pick **US West**) and stay signed in.
4. Consumer: **Create VM** in US-West, pick the provider, wait for **Running**, then **SSH**.
