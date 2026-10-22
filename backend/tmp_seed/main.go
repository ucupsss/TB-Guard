package main

import (
	"context"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	ctx := context.Background()
	c, err := pgx.Connect(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		panic(err)
	}
	defer c.Close(ctx)
	now := time.Now().UnixMilli()
	if os.Args[1] == "add" {
		c.Exec(ctx, "INSERT INTO users (email,name,role,created_at,last_login_at,login_count) VALUES ('e2e-a@gmail.com','E2E','Admin',$1,$1,1) ON CONFLICT DO NOTHING", now)
	} else {
		c.Exec(ctx, "DELETE FROM users WHERE email='e2e-a@gmail.com'")
		c.Exec(ctx, "DELETE FROM agent_chats WHERE owner='e2e-a@gmail.com'")
		c.Exec(ctx, "DELETE FROM orchestra_runs WHERE owner='e2e-a@gmail.com'")
	}
}
