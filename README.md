# A simple functional example web server for Node.js

This server was extracted from a basic web server I wrote (quickly) to run on my Kindle Paperwhite after I managed to get Node.js running on it. It was pure novelty but it turns out to be a nice example of the kind of thing that Node.js is good at. So I've heavily documented the code and hopefully you only need a little bit of JavaScript knowledge to get going with this (perhaps you don't even need much JavaScript knowledge?).

## Getting started

 1. Install [Node.js](http://nodejs.org/). You can also do this via your OS's [package manager](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager). Node.js is very easy to compile and install from the main repo, so feel free to do that too. Node comes with *npm*, the Node.js Package Manager, which you'll need to use to fetch the optional dependencies in this project.
 2. Clone this repo to somewhere handy.
 3. Run the command `npm install` in the root of the repo. This will read the *package.json* file and figure out what optional dependencies need to be fetched and installed into a *node_modules* directory where they can be automatically loaded when you `require()` them from the application.
 4. Run the web server with the command `node ./`. This loads and runs the `"main"` script found in the *package.json* file, in this case *index.js*.
 5. Point a web browser at http://localhost:8080/
 6. Read, understand and go wild!

*index.js* is your starting point for understanding what's going on. *package.json* is your project's "descriptor" and tells npm which dependencies to install and where your main script file is. *public/* is where static files are served from, anything you put in there will be available via your web server. *templates/* just holds an index.html file which is a [swig](http://paularmstrong.github.com/swig/) template file.

## Licence

This project is Copyright (c) 2012 Rod Vagg [@rvagg](https://twitter.com/rvagg) and licenced under the MIT licence. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE file for more details.