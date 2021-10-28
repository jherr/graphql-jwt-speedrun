import { ApolloServer, gql, AuthenticationError } from "apollo-server";
import jwt from "jsonwebtoken";
import guid from "guid";

import users from "./users";

const JWT_SECRET = process.env.JWT_SECRET || "secret";

const refreshTokens: Record<string, string> = {};

const typeDefs = gql`
  type Query {
    todos: [String!]
  }

  type Mutation {
    authenticate(name: String!, password: String!): String
    refresh: String
  }
`;

const resolvers = {
  Query: {
    todos: (_parent: unknown, _args: unknown, context: { name: string }) => {
      if (!users[context?.name]) {
        throw new AuthenticationError("Invalid credentials");
      }
      return users[context?.name].todos;
    },
  },
  Mutation: {
    authenticate: (
      _: unknown,
      { name, password }: { name: string; password: string }
    ) => {
      if (users[name] && users[name].password === password) {
        return jwt.sign({ data: name }, JWT_SECRET, { expiresIn: "5s" });
      } else {
        throw new AuthenticationError("Invalid credentials");
      }
    },
    refresh: (
      _parent: unknown,
      _args: unknown,
      { refreshToken }: { refreshToken: string }
    ) => {
      const token = jwt.verify(refreshToken, JWT_SECRET) as {
        data: string;
      };
      if (token.data in refreshTokens) {
        return jwt.sign({ data: refreshTokens[token.data] }, JWT_SECRET, {
          expiresIn: "5s",
        });
      }
    },
  },
};

const server = new ApolloServer({
  cors: {
    origin: "http://localhost:8080",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  },
  formatResponse: (response, requestContext) => {
    if (response.errors && !requestContext.request.variables?.password) {
      if (requestContext.response?.http) {
        requestContext.response.http.status = 401;
      }
    } else if (response.data?.authenticate || response.data?.refresh) {
      const tokenExpireDate = new Date();
      tokenExpireDate.setDate(
        tokenExpireDate.getDate() + 60 * 60 * 24 * 7 // 7 days
      );
      const refreshTokenGuid = guid.raw();

      const token = jwt.verify(
        response.data?.authenticate || response.data?.refresh,
        JWT_SECRET
      ) as unknown as {
        data: string;
      };

      refreshTokens[refreshTokenGuid] = token.data;
      const refreshToken = jwt.sign({ data: refreshTokenGuid }, JWT_SECRET, {
        expiresIn: "7 days",
      });

      requestContext.response?.http?.headers.append(
        "Set-Cookie",
        `refreshToken=${refreshToken}; expires=${tokenExpireDate}`
      );
    }
    return response;
  },
  context: ({ req }) => {
    const ctx: { name: string | null; refreshToken: string | null } = {
      name: null,
      refreshToken: null,
    };

    const cookies = (req.headers?.cookie ?? "")
      .split(";")
      .reduce<Record<string, string>>((obj, c) => {
        const [name, value] = c.split("=");
        obj[name.trim()] = value.trim();
        return obj;
      }, {});

    ctx.refreshToken = cookies?.refreshToken;

    try {
      if (req.headers["x-access-token"]) {
        const token = jwt.verify(
          req.headers["x-access-token"] as string,
          JWT_SECRET
        ) as unknown as {
          data: string;
        };
        ctx.name = token.data;
      }
    } catch (e) {}
    return ctx;
  },
  typeDefs,
  resolvers,
});

server.listen({ port: 3000 }).then(({ url }) => {
  console.log(`🚀  server ready at ${url}`);
});
