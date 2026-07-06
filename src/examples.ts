// A small gallery of real-world-shaped Dockerfiles used as one-click examples in
// the UI (backlog story 3.2) and as analyzer fixtures in tests. Each example is
// intentionally imperfect so the analyzer has something concrete to say.

export interface Example {
  readonly id: string;
  readonly label: string;
  readonly dockerfile: string;
}

export const EXAMPLES: Example[] = [
  {
    id: 'node',
    label: 'Node.js web app',
    dockerfile: `FROM node:18-slim
WORKDIR /app
COPY . .
RUN npm ci --production
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
`,
  },
  {
    id: 'python',
    label: 'Python service',
    dockerfile: `FROM python:3.12
WORKDIR /srv
RUN apt-get update && apt-get install -y build-essential
COPY . .
RUN pip install -r requirements.txt
CMD ["python", "app.py"]
`,
  },
  {
    id: 'go-multistage',
    label: 'Go multi-stage build',
    dockerfile: `FROM golang:1.22 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /bin/app ./cmd/app

FROM gcr.io/distroless/base
COPY --from=build /bin/app /app
ENTRYPOINT ["/app"]
`,
  },
];

export function findExample(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
