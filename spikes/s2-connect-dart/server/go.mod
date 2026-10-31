module github.com/andrewloable/kantahe/spikes/s2-connect-dart/server

go 1.25.0

require (
	connectrpc.com/connect v1.21.0
	github.com/andrewloable/kantahe/server v0.0.0
)

require google.golang.org/protobuf v1.36.12 // indirect

replace github.com/andrewloable/kantahe/server => ../../../server
