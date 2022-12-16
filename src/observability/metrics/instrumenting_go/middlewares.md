# API Framework Instrumentation Middleware

In this section we'll cover instrumenting RESTful HTTP APIs built on three common Golang frameworks: [Gin](https://github.com/gin-gonic/gin), [Echo](https://github.com/labstack/echo), and [Beego](https://github.com/beego/beego).

Middleware is a term used to describe functions that run before, during, or after the processing of requests for an API.

Middleware is routed in popular web frameworks like a chain: the first middleware to be "wired up" (like with `router.Use()` in Gin) will execute first in the chain, then it can pass to the next middleware by invoking something like `c.Next()` in Gin or `next()` in Echo. Endpoint handlers are also Middleware, they're just usually at the bottom of the chain and don't call any `Next` middleware, when they complete the chain runs in reverse order back to the first wired middleware, invoking any code written after the call to `Next`.

The general structure of a Middleware is like a handler function, I'll use a Gin `HandlerFunc` in this example but with other ecosystems it looks much the same:
```go
func MyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Everything above `c.Next()` will run before the route handler is called
        // To start with, the gin.Context will only hold request info
        
		// Save the start time for request processing
		t := time.Now()

		// Pass the request to the next middleware in the chain
		c.Next()

        // Now the gin.Context will hold response info along with request info

		// Stop the timer we've been using and grab the processing time
		latency := time.Since(t)

        // Log the latency
        fmt.Printf("Request Latency: %+v\n", latency)
		
	}
}
```

For consistency, we'll adapt a similar Users API from the previous section to serve as our example service. For a description of the API we're building, see [Defining an Example Service](./simple_service.md#defining-an-example-service).
