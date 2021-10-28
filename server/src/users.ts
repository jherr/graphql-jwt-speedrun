const users: Record<
  string,
  {
    id: number;
    password: string;
    todos: string[];
  }
> = {
  sally: {
    id: 1,
    password: "123",
    todos: ["Learn GraphQL", "Learn JWT"],
  },
  jane: {
    id: 2,
    password: "123",
    todos: ["Learn C", "Learn C++"],
  },
};

export default users;
