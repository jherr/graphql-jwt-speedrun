import { useCallback } from "react";
import { createGlobalState } from "react-hooks-global-state";
import axios from "axios";

const { useGlobalState, getGlobalState, setGlobalState } = createGlobalState({
  jwtToken: "",
});
const getJWTToken = () => getGlobalState("jwtToken");
const setJWTToken = (value: string) => setGlobalState("jwtToken", value);
const useJWTToken = () => useGlobalState("jwtToken");

const client = axios.create({
  baseURL: "http://localhost:3000",
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  },
});

client.interceptors.request.use(
  (config) => {
    config.headers["x-access-token"] = getJWTToken();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

client.interceptors.response.use(
  (res) => {
    return res;
  },
  async (err) => {
    const originalConfig = err.config;
    if (err.response.status === 401 && !originalConfig._retry) {
      originalConfig._retry = true;
      try {
        const rs = await client.post(
          "/",
          {
            query: "mutation { refresh }",
          },
          {
            withCredentials: true,
          }
        );
        const { data } = rs.data as {
          data: {
            refresh: string;
          };
        };
        setJWTToken(data.refresh);
        return client(originalConfig);
      } catch (_error) {
        return Promise.reject(_error);
      }
    }
    return Promise.reject(err);
  }
);

export function useClient() {
  const [JWT, setJWT] = useJWTToken();

  const login = useCallback((name: string, password: string) => {
    client
      .post(
        "/",
        {
          query:
            "mutation ($name: String!, $password: String!) {\n  authenticate(name: $name, password: $password)\n}\n",
          variables: { name, password },
        },
        {
          withCredentials: true,
        }
      )
      .then(({ data }) => {
        const jwtToken = (
          data as {
            data: {
              authenticate: string;
            };
          }
        ).data.authenticate;
        setJWT(jwtToken);
      });
  }, []);

  const logout = useCallback(() => {
    setJWT("");
  }, []);

  const getTodos = useCallback(
    () =>
      client
        .post(
          "/",
          {
            query: "query { todos }",
          },
          {
            withCredentials: true,
          }
        )
        .then(
          ({ data }) =>
            (
              data as {
                data: {
                  todos: string[];
                };
              }
            ).data.todos
        ),
    []
  );

  return {
    JWT,
    getTodos,
    login,
    logout,
  };
}

export default client;
