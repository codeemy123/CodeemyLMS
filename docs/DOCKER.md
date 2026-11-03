# Docker / Cloud Run

The root `Dockerfile` builds a standalone Next.js server using Node 24 and a separate non-root runtime stage. The runtime includes traced server dependencies, static assets and the public folder. It starts `node server.js` rather than the loopback-only local npm start script.

The builder sets `DOCKER_BUILD=1` to enable standalone output. Ordinary local `npm run build` and `npm start` continue using the standard Next.js server.

Build from the project root with Docker Desktop or a Linux Docker builder:

```sh
docker build --platform linux/amd64 -t codeemy-lms .
docker run --rm -p 8080:8080 codeemy-lms
```

Open `http://localhost:8080/student`, `/mentor` or `/admin`.

The server listens on `0.0.0.0` and reads `PORT` (default 8080), matching the Cloud Run container contract. Cloud Run supplies its own PORT; do not override the container command with `npm start`.

Use repository root `/` as the build context and `/Dockerfile` as the Dockerfile location in a GitHub/Cloud Build integration. Application source lives in `src`, but `src` is not the Docker build context.

Environment files, credentials, installed dependencies, build artifacts and local tool data are excluded from the Docker context. Builder COPY instructions also explicitly select application files. Configure runtime secrets through Cloud Run Secret Manager integration or Docker runtime environment variables; never add credentials to the Dockerfile or build arguments.

The Docker build does not provision PostgreSQL, run migrations, or migrate localStorage data. The unused Prisma scaffold does not require DATABASE_URL for the frontend build. When real database APIs/client generation are implemented, update the image build and migration process accordingly.

Existing R2 APIs intentionally accept only opted-in loopback preview requests. Public Cloud Run R2 access remains disabled until real authentication and file authorization are implemented. Deploying this image does not make the frontend preview production-ready for real users.
