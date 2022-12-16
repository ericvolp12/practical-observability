# Instrumenting a Gin App

First let's scaffold the example service.

## Example Gin Service

```go
package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// User is a struct representing a user object
type User struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

var users []User

func main() {
	router := gin.Default()

	router.GET("/users", listUsers)
	router.POST("/users", createUser)

	router.Run(":8080")
}

func listUsers(c *gin.Context) {
	// List all users
	c.JSON(http.StatusOK, users)
}

func createUser(c *gin.Context) {
	// Create a new user
	var user User
	if err := c.ShouldBindJSON(&user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	users = append(users, user)
	c.JSON(http.StatusOK, user)
}
```

This service is nearly identical to our trivial example but has separate handler functions for creating and listing users. We're also using the `gin` framework so our handlers take a `*gin.Context` instead of a `http.ResponseWriter` and `*http.Request`.

## Writing Gin Instrumentation Middleware

In the world of Gin, we can create a custom Middleware and hook it into our request handling path using `router.Use()`. This tutorial won't go into depth on how to write custom Gin middleware but we will introduce an instrumentation middleware and explain it below:

First, let's add our Prometheus libraries to the import list:

```go
import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)
```

Next we'll define our `reqLatency` metric just like in the previous section:

```go
//...
// Define the HistogramVec to keep track of Latency of Request Handling
// Also declare the labels names "method", "path", and "status"
var reqLatency = promauto.NewHistogramVec(prometheus.HistogramOpts{
	Name: "userapi_request_latency_ms",
	Help: "The latency of handling requests in milliseconds",
}, []string{"method", "path", "status"})
```

Now we'll define a Middleware function that executes before our request handlers, starts a timer, invokes the handler using `c.Next()`, stops the timer and observes the `msLatency` (in `float64` milliseconds), `status`, `method`, and `path` of the request that was just handled.

```go
// InstrumentationMiddleware defines our Middleware function
func InstrumentationMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Everything above `c.Next()` will run before the route handler is called

		// Save the start time for request processing
		t := time.Now()

		// Pass the request to its handler
		c.Next()

		// Now that we've handled the request
        // observe the latency, method, path, and status

		// Stop the timer we've been using and grab the millisecond duration float64
		msLatency := float64(time.Since(t).Microseconds()) / 1000

		// Extract the Method from the request
		method := c.Request.Method

		// Grab the parameterized path from the Gin context
		// This preserves the template so we would get:
        //  "/users/:name" instead of "/users/alice", "/users/bob" etc.
		path := c.FullPath()

		// Grab the status from the response writer
		status := c.Writer.Status()

		// Record the Request Latency observation
		reqLatency.With(prometheus.Labels{
			"method": method,
			"path":   path,
			"status": fmt.Sprintf("%d", status),
		}).Observe(msLatency)
	}
}
```

Finally, we plug in the `InstrumentationMiddleware()` above our route handlers and wire up the `promhttp.Handler()` request handler using `gin.WrapH()` which is used to wrap vanilla `net/http` style Go handlers in `gin`-compatible semantics.

```go
func main() {
	router := gin.Default()

    // Plug our middleware in before we route the request handlers
	router.Use(InstrumentationMiddleware())

    // Wrap the promhttp handler in Gin calling semantics
    router.GET("/metrics", gin.WrapH(promhttp.Handler()))

	router.GET("/users", listUsers)
	router.POST("/users", createUser)

	router.Run(":8080")
}
```

With this completed, any handler present in our Gin server declared after our `InstrumentationMiddleware()` is plugged in will be instrumented and observed in `reqLatency`. In this case, this will include the default `/metrics` handler from `promhttp` since we route it after plugging in the middleware.

## Testing the Gin Instrumentation middleware

We can start up our server listening on port `8080` with:

```shell
go run main.go
```

We'll run the following requests to generate some `/metrics` histograms and we can see how it compares to the histograms we saw in the prior chapter:

```shell
$ curl http://localhost:8080/users
> null
$ curl -X POST -d'{"name":"Eric","id":1}' http://localhost:8080/users
> {"id":1,"name":"Eric"}
$ curl http://localhost:8080/users
> [{"id":1,"name":"Eric"}]
$ curl -X POST -d'{"name":' http://localhost:8080/users
> {"error":"unexpected EOF"}
```

With some data in place, we can `GET` the `/metrics` endpoint to see our histograms.

```shell
$ curl http://localhost:8080/metrics
> # HELP userapi_request_latency_ms The latency of handling requests in milliseconds
> # TYPE userapi_request_latency_ms histogram
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.005"} 0
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.01"} 0
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.025"} 0
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.05"} 1
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.1"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.25"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="0.5"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="1"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="2.5"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="5"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="10"} 2
> userapi_request_latency_ms_bucket{method="GET",path="/users",status="200",le="+Inf"} 2
> userapi_request_latency_ms_sum{method="GET",path="/users",status="200"} 0.123
> userapi_request_latency_ms_count{method="GET",path="/users",status="200"} 2
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.005"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.01"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.025"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.05"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.1"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.25"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="0.5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="1"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="2.5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="10"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="200",le="+Inf"} 1
> userapi_request_latency_ms_sum{method="POST",path="/users",status="200"} 0.132
> userapi_request_latency_ms_count{method="POST",path="/users",status="200"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.005"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.01"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.025"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.05"} 0
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.1"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.25"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="0.5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="1"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="2.5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="5"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="10"} 1
> userapi_request_latency_ms_bucket{method="POST",path="/users",status="400",le="+Inf"} 1
> userapi_request_latency_ms_sum{method="POST",path="/users",status="400"} 0.054
> userapi_request_latency_ms_count{method="POST",path="/users",status="400"} 1
```

We see three histograms as expected, one for the `GET /users` route and two for `POST /users` (one for status `200` and another for `400`). The `/metrics` endpoint doesn't show a histogram yet because the first time it was invoked was while processing this request and we don't `Observe()` data until after we've written a response.

If we dissect our histogram results like in the simplified example, the `GET /users` endpoint averages `61.5` microseconds, the `POST /users 200` endpoint took `132` microseconds, and the `POST /users 400` endpoint took `54` microseconds.

## Conclusion

This example shows we can write our own instrumentation middleware in a few lines of extra code when starting up our Gin server. We're able to tune our measurements to ensure the metric we care about falls somewhere in the middle of our histogram buckets so we can keep precise measurements, and we can easily add additional metrics to our custom middleware if we want to track additional values for each request.

There is an off-the-shelf solution for Gin that requires even less configuration in the form of the [`go-gin-prometheus`](https://github.com/ericvolp12/go-gin-prometheus) library. I maintain a fork of this library that has a few quality-of-life changes to avoid [cardinality explosions](../labels.md#label-cardinality) around paths, and instrumenting your Gin service becomes as easy as:

```go
import (
	//...
	"github.com/ericvolp12/go-gin-prometheus"
	//...
)

func main(){
    r := gin.New()
	p := ginprometheus.NewPrometheus("gin")
	p.Use(r)
    // ... wire up your endpoints and do everything else
}
```

This middleware tracks request counts, duration, and size, as well as response sizes. We'll explore the limitations of off-the-shelf instrumentation middlewares in the next section on Echo, but to summarize: sometimes the default units of measurement and bucket spacings of off-the-shelf instrumentation middleware are insufficient to precisely measure the response times of our routes and the sizes of requests and responses.

The `go-gin-prometheus` middleware similarly measures response times in seconds, not milliseconds, and it uses the default Prometheus `DefBuckets` spacing meaning the shortest request we can reasonably measure will be `5ms` and the longest will be `10s`.

That being said, if you have a compelling reason to write your own instrumentation middleware (like having response sizes and latencies that fall outside of the default buckets) or need to track additional metrics in your API that aren't just related to requests, you should now feel empowered to write your own instrumentation middleware for Gin applications.
