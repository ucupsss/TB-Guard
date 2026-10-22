package db

import (
	"sync/atomic"

	"github.com/jackc/pgx/v5/pgxpool"
)

type atomicPool = atomic.Pointer[pgxpool.Pool]
