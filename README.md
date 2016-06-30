# generator-dropwizard-angular-gradle

This is a [Yeoman](http://yeoman.io/) generator that scaffolds out a freestanding web application using:

   + Angular.js, Typescript and Less for the client
   + Java 8 and Dropwizard for the server
   + Gulp and gradle for client dependency management
   + Gradle for server dependency management

## Getting Started

Install Yeoman via npm:

    $ npm install -g yo

Once you've got Yeoman set up, install this generator:

    $ npm install -g generator-dropwizard-angular-gradle

Create the directory in which your new project will live, then call Yeoman to scaffold out your project:

    $ mkdir awesome
    $ cd awesome
    $ yo dropwizard-angular-gradle

Answer a couple of easy questions, and you'll be greeted with a ready-to-rock project. Open the directory up in your Java IDE of choice (I like [IDEA](https://www.jetbrains.com/idea/) myself), import the project as a Gradle project, and you're good to go.

### Client development

There's no need to restart the server every time you make a front-end change. When you start your client development, run:

    $ gulp watch

from inside your `awesome-app` directory, then make changes in your favourite editor to the HTML, Less, and Typescript source files in `awesome-app/src`. As you save your changes, they'll automatically be compiled down into CSS and Javascript, and any open browser tabs will be kept up to date with the latest compiled files.

### Shipping

Wow, that was fast! Once you're ready to deploy, run:

    $ ./gradlew distZip

from the root of the project, and you'll receive a handy deployable .zip with all of your Java dependencies, compiled front-end resources, and runtime configuration:

    $ ls awesome-distribution/build/distributions/
    $ awesome-distribution-0.0.0.zip

Use git flow and you'll get automatically-sane version tags on your deployable artefacts, too. Ship that .zip onto your server, unzip it, and start your service as you would any Dropwizard server:

    $ unzip awesome-distribution-0.0.0.zip
    $ cd awesome-distribution-0.0.0
    $ ./bin/awesome-distribution server var/conf/server.yml

Hit up your server in a browser ([http://localhost:8000/](http://localhost:8000/) by default), and you should see your shiny new application, live and ready to go.
