const PORT = 8080

const http  = require('http')
    , exec  = require('child_process').exec
    , fs    = require('fs')
    , st    = require('st')
    , swig  = require('swig')
    , after = require('after')

var logStream = fs.createWriteStream('access.log', { flags: 'a' })
  , mount = st({
        path  : __dirname + '/public/'
      , url   : '/'
      , index : false
      , cache : (process.env.NODE_ENV != 'dev')
    })

  , uname
  , cpuinfo

  , meminfo = function (callback) {
      exec('cat /proc/meminfo', function (err, stdout) {
        if (err) return callback(err)
        callback(stdout.toString())
      })
    }

  , uptime = function (callback) {
      exec('uptime', function (err, stdout) {
        if (err) return callback(err)
        callback(stdout.toString())
      })
    }


  , index = function (req, res) {
      var tmpl = swig.compileFile('index.html')
        , vars = {
              uname   : uname
            , cpuinfo : cpuinfo
            , meminfo : meminfo
            , uptime  : uptime
          }
        , cb = after(2, function () {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(tmpl.render(vars))
          })

      meminfo(function (err, m) {
        vars.meminfo = err || m
        cb()
      })

      uptime(function (err, m) {
        vars.uptime = err || m
        cb()
      })
    }

  , log = function (req) {
      var data = {
          date : new Date().toISOString()
        , host : req.socket.remoteAddress
        , url  : req.url
        , ua   : req.headers['user-agent']
      }
      logStream.write(JSON.stringify(data) + '\n', 'utf8')
    }

swig.init({
    allowErrors : false
  , autoescape  : true
  , cache       : (process.env.NODE_ENV != 'dev')
  , encoding    : 'utf8'
  , root        : __dirname + '/templates/'
})

var server = http.createServer(function (req, res) {
  log(req)
  if (req.url == '/')
    return index(req, res)
  mount(req, res)
})

server.listen(PORT)

exec('uname -a', function (err, stdout) {
  if (err) throw err
  uname = stdout.toString()
})

exec('cat /proc/cpuinfo', function (err, stdout) {
  if (err) throw err
  cpuinfo = stdout.toString()
})