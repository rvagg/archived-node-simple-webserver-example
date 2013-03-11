const PORT = 8080

/* The use of `const` below is purely aesthetic, I use it to make my imports
 * stand apart. Normally they would just be `var`s.
 */

      // global `http` module: http://nodejs.org/docs/latest/api/http.html
      // we use this to create our web server, we could swap this for `https`
      // and it would work the same
const http  = require('http')
      // a single function from the global `child_process` module:
      // http://nodejs.org/docs/latest/api/child_process.html
    , exec  = require('child_process').exec
      // global `fs` module that we use for our access.log
      // http://nodejs.org/docs/latest/api/fs.html
    , fs    = require('fs')
      // a static-file serving module to take care of our static resources,
      // it handles caching, headers, 404s etc.
      // http://npm.im/st
    , st    = require('st')
      // a nice HTML templating module: http://paularmstrong.github.com/swig/
    , swig  = require('swig')
      // a very simple module for handling parallel async calls:
      // http://npm.im/after
    , after = require('after')

var uname   // a global to store `uname -a` output
  , cpuinfo // a global to store `cat /proc/cpuinfo` output

    /* An access.log implemented as a WritableStream. This is globally available
     * and you can call logStream.write() from any request and it'll be pushed
     * into the file with no concern about multi-threaded file access.
     */
  , logStream = fs.createWriteStream(__dirname + '/access.log', { flags: 'a' })

    /* Initialise an instance of `st`, define a mount point to share static
     * resources. Anything we put in ./public/ will be available on our server
     * at the root. e.g. ./public/style.css -> http://localhost:8080/style.css
     */
  , mount = st({
                // the path to the resources on the filesystem to share
                // __dirname is always the directory of *this JS file*
        path  : __dirname + '/public/'
                // the root on our server where the resources are shared
      , url   : '/'
                // turn off index.html or directory indexes
      , index : false
                // set to false if `export NODE_ENV=dev` so static resources
                // aren't sent with cache headers if we're working in a dev
                // environment
      , cache : (process.env.NODE_ENV != 'dev')
    })

    /* A function that will execute `cat /proc/meminfo` and return the contents
     * on a callback argument when it's complete.
     * Note that there is no return value here. Async requires that you return
     * your values on a callback function, usually with the signature: function (err, data)
     * where the first argument is any error that may have occured, or null if no
     * error and the second argument is what you might `return` in a non-async
     * environment.
     * We only need to use this pattern when dealing with i/o, otherwise we
     * could use a classic `return`. In this case we are spawning an executable
     * so it will be managed in a worker-thread and our internal function will
     * only be invoked once it has completed.
     */
  , meminfo = function (callback) {
      exec('cat /proc/meminfo', function (err, stdout) {
        // note that this `return` is simply to shortcut the function;
        // this is idiomatic Node, an alternative would be to use an:
        // if (err) { callback(err) } else { ... }
        if (err) return callback(err)

        // Success, return err=null and a stringified version of our stdout.
        // Like most things in the `fs` module, child_process.exec returns
        // values as Buffer objects, which can be converted to String objects.
        callback(null, stdout.toString())
      })
    }

    /* Exactly the same style as `meminfo(callback)` but for the `uptime`
     * executable.
     * Both meminfo() and uptime() are called *for each request*, `uname -a` and
     * `cat /proc/cpuinfo` are done only once so we do them below and store the
     * result in the global objects (above)
     */
  , uptime = function (callback) {
      exec('uptime', function (err, stdout) {
        if (err) return callback(err)
        callback(null, stdout.toString())
      })
    }


    /* A handler for requests for `/`. We want to set up our template and populate
     * our template data (model) with some global and async resources.
     */
  , index = function (req, res) {
          // In this case, the file is loaded synchronously, swig.compileFile()
          // actually uses `fs.readFileSync()` which *returns* the contents of
          // the file rather than passing it on a callback. Sync-methods are
          // normally shunned in Node unless you're doing it during your application's
          // initialisation (or anywhere else where it occurs only once).
          // In the case of swig, it caches the result of the file read (unless
          // you tell it not to), so the sync-read is acceptable because it won't
          // be happening on every pass through this function.
      var tmpl = swig.compileFile('index.html')
          // the model to pass to the template, populated with out static data now
          // but filled with our dynamic data below (meminfo and uptime)
        , vars = {
              uname   : uname
            , cpuinfo : cpuinfo
          }
          // Here we set up a simple async-helper. The `after` module creates
          // a new function for us that will execute the function we give it
          // after the created function has been called a certain number of times.
          // So, `cb` is a function, it can be called: cb(), and nothing happens,
          // call it again: cb() and the function that we gave to `after` will
          // be triggered.
          // We do this so we can call both `meminfo()` and `uptime()` and not
          // care in which order they execute or which one returns first, all
          // we want to know is that they have both returned, hence the `2`.
        , cb = after(2, function () {
            // write to the client, just a simple `200` header and the rendered
            // template
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(tmpl.render(vars)) // template rendered with our model `vars`
          })

      // The order of these two calls doesn't matter, they happen on the thread-
      // pool, not in our JavaScript thread and they will return their values
      // on the functions we're passing once they are done. The functions are
      // idiomatic Node async callbacks where the first argument is any error
      // that has occured (hopefully `null`) and the second argument is the
      // return value from the async call.
      // This pattern is used across all Node core modules and by most public
      // modules you find in npm. We also use it internally because the
      // consistency gives us predictability and lets modules interoperate
      // cleanly.
      meminfo(function (err, m) {
        // all we're doing here is setting the `meminfo` property for our
        // template to *either* the error value or (hopefully) the contents
        // of /proc/meminfo
        vars.meminfo = err || m
        // Trigger the `cb` function we created with `after`, this may be the
        // first or second call of `cb`, we don't care. Note we aren't passing
        // an err argument here because we're happy to render an error on our
        // html, but `after` can manage errors for us nicely if we care about them.
        cb()
      })

      // same pattern as `meminfo()`
      uptime(function (err, u) {
        vars.uptime = err || u
        // trigger the callback created by `after()`, this could be the first
        // or second call, we can't control it as it depends on both the thread-
        // pool and how long the executables take to return
        cb()
      })
    }

    /* A simple access.log function. For each request we'll extract some
     * interesting variables and stick them into a file where each line is a
     * JSON string for a request.
     */
  , log = function (req) {
      var data = {
          date : new Date().toISOString()
        , host : req.socket.remoteAddress
        , url  : req.url
        , ua   : req.headers['user-agent']
      }
      // JSON.stringify() is globally available in JS, by default it won't
      // include newlines, no matter how big the data is.
      logStream.write(JSON.stringify(data) + '\n', 'utf8')
    }

// -----------------------------------------------------------------------------
// We've finished declaring constants and variables (which include some helper
// functions). From this point onwards we're actually executing code (i.e. like
// a main() function).
// -----------------------------------------------------------------------------

// Initialise swig, there's plenty more options but we only care about a few here
swig.init({
    autoescape  : true
    // turn off caching behaviour for development environments (set by running
    // `export NODE_ENV=dev` on the commandline before you start this app)
  , cache       : (process.env.NODE_ENV != 'dev')
  , encoding    : 'utf8'
    // where to find the template files
  , root        : __dirname + '/templates/'
})

// The same pattern as we find in both `meminfo()` and `uptime()` but in this
// case we're assigning to global variables to use in each request. These
// calls are only made once, when our app starts.
exec('uname -a', function (err, stdout) {
  // we're going to throw the error here which should end our process; we want
  // to know about these kinds of errors early and they should happen almost
  // instantly after we start.
  if (err) throw err
  // There's a little problem here that we're going to ignore for the purposes
  // of this example, but you may not want to ignore it in a real app.
  // Execution inside this current function won't happen until after we've done
  // our `http.createServer()` below, because it's been sent off to a worker-
  // thread and won't come back until the exec() has completed and the JS-thread
  // is ready. So, it's possible that our server is up and running, accepting
  // connections, before we have a `uname` global variable set (and maybe the
  // `cpuinfo` variable set in the next block).
  // We're not going to care here because (1) it'll be ready in less than a second
  // so the likelyhood of anyone making a request in the space of time that the
  // value isn't set is very small, and (2) it'll just render as `null`, and so
  // what?
  uname = stdout.toString()
})

exec('cat /proc/cpuinfo', function (err, stdout) {
  if (err) throw err
  // Same problem noted above, execution happens in here at some point in the
  // future, certainly *after* we've called `listen()` on our new http server.
  cpuinfo = stdout.toString()
})

// `createServer()` simply takes a handler function that is passed request
// and response objects. This handler-function is called for every request
// that comes by the server (unless we use the `cluster` module, but that's
// different story...). It only happens in the JavaScript thread but the
// whole tcp & http handling is performed in worker-threads so listening &
// accepting connections happens elsewhere, as does parsing the http and
// setting up our `req` and `res` objects.
http.createServer(function (req, res) {
  // log every request, this returns very quickly because the actual logging
  // is handled by the `fs` module in a worker-thread
  log(req)

  // The only special case we have is for requests to `/`, if you had more
  // pages you wanted to serve then you could set them up here. Once you have
  // too many pages then you may want to consider bringing in a router module
  // to handle complex paths for you.
  if (req.url == '/')
    return index(req, res) // return here is only used for short-cutting

  // `mount` is our mount-point created by the `st` module, it can handle
  // all other HTTP requests. If the requests are for files that are found
  // in our ./public/ directory then it'll serve them with appropriate headers
  // but if they are not found then it'll 404.
  mount(req, res)
}).listen(PORT) // Start the HTTP server. The server isn't actually started
                // before this function returns, that happens in a worker-thread,
                // but we only care about incoming requests which get to us via
                // the handler function above.

// print to stdout
console.log('Listening for connections on port', PORT)
