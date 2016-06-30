"use strict";

var Promise = require("bluebird");
var browserSync = require('browser-sync').create();
var reload = browserSync.reload;
var del = require("del");
var es = require("event-stream");
var fs = require("fs");
var gulp = require("gulp");
var mkdirp = require("mkdirp");
var ncp = require("ncp");
var path = require("path");
var plugins = require("gulp-load-plugins")();
var runSequence = require("run-sequence");
var tsconfigGlob = require("tsconfig-glob");
var wiredep = require("wiredep");
var plumber = require('gulp-plumber');

Promise.promisifyAll(mkdirp);
Promise.promisifyAll(ncp);

var staticFileTypesGlob = [
    "eot",
    "gif",
    "ico",
    "png",
    "svg",
    "ttf",
    "woff",
    "jpg"
].map(function (ext) {
    return "**/*." + ext;
});

gulp.task("clean", function () {
    return del(["build", "dist"]);
});

gulp.task("less", function () {
    var AUTOPREFIXER_BROWSERS = [
        "> 1%",
        "last 2 versions",
        "Firefox ESR",
        "Opera 12.1"
    ];

    return gulp.src("src/**/*.less")
        .pipe(plugins.less())
        .on("error", function (err) {
            plugins.util.log("less " + plugins.util.colors.red("Error:") + " " + err.message);
            this.emit("end");
        })
        .pipe(gulp.dest("build/src"))
        .pipe(plugins.livereload());
});

var tsProject = plugins.typescript.createProject({
    removeComments: false,
    noImplicitAny: true,
    declarationFiles: true,
    noExternalResolve: true,
    target: "ES5"
});

gulp.task("tsconfig", function () {
    tsconfigGlob({cwd: process.cwd()});
});

gulp.task("typescript", function () {
    // create a filter just for *.ts files
    var tsFilter = plugins.filter(["**/*.ts", "!**/*.d.ts"], {
        restore: true
    });

    var tsResult = gulp.src([
            "typings/**/*.d.ts",
            "src/**/*.ts"
        ])
        .pipe(plumber())
        // filter to just *.ts files
        .pipe(tsFilter)
        // restore *.d.ts files
        .pipe(tsFilter.restore)
        // compile
        .pipe(plugins.typescript(tsProject))
        // capture errors from the typescript compiler and suppress when watching
        .on("error", function(err) { console.warn(err); });

    // merge .js and .d.ts output streams
    return es.merge(tsResult.js, tsResult.dts)
        .pipe(gulp.dest("build/src"));
});

gulp.task("typescript-all", function () {
    runSequence(
        ["tsconfig"],
        ["typescript"]
    );
});

gulp.task("assets", function () {
    return gulp.src(staticFileTypesGlob, {cwd: "src"})
        .pipe(gulp.dest("build/src"));
});

gulp.task("inject", function () {
    // inject is used here instead of wiredep.stream in order
    // to have more control over the relative paths that are
    // injected into the html

    var wiredepFiles = wiredep();
    var json = JSON.parse(fs.readFileSync("bower.json"));

    var main = json.main || [];
    if (typeof main == "string") {
        main = [main];
    }

    var js = wiredepFiles.js || [];
    var css = wiredepFiles.css || [];

    var files = js.concat(css);

    return gulp.src("src/*.html")
        // inject bower_components files with paths that start with bower_components
        .pipe(plugins.inject(gulp.src(files, {read: false, base: ".."}), {addRootSlash: false}))
        // change the relative path of the file so relative inject paths will work in the next step
        .pipe(gulp.dest("build/src"))
        // inject main files which should all be in build/src
        .pipe(plugins.inject(gulp.src(main, {read: false}), {relative: true, name: "self"}))
        .pipe(gulp.dest("build/src"));
});

gulp.task("copy-to-tmp", function () {
    // files are copied from build/src in order to avoid modifying
    // any files in build/src when performing minification.
    // an intermediate tmp directory is used.

    // delete min and tmp directories
    return del(["build/tmp", "build/min"]).then(function () {
        return mkdirp.mkdirpAsync("build/tmp/bower_components").then(function () {
            var packages = Object.keys(wiredep().packages);

            return Promise.all([
                // copy src files to tmp
                ncp.ncpAsync("build/src", "build/tmp"),
                // for all dependent bower components (not devDependencies)
                Promise.all(packages.map(function (pack) {
                    var destination = path.join("build/tmp/bower_components", pack);
                    var componentDirectory = path.join("bower_components", pack);
                    return ncp.ncpAsync(componentDirectory, destination);
                }))
            ]);
        });
    });
});

gulp.task("copy-to-min", ["copy-to-tmp"], function () {
    // only copy static files from build/tmp to build/min.
    // all js, html, and css files will be processed by the
    // minify task and output to build/min
    return gulp.src(staticFileTypesGlob, {cwd: "build/tmp"})
        .pipe(gulp.dest("build/min"));
});

gulp.task("minify", ["copy-to-tmp", "copy-to-min"], function () {
    return gulp.src("build/tmp/*.html")
        .pipe(plugins.usemin({
            css: [
                plugins.minifyCss({
                    // this makes sure that all paths in css files are rewritten
                    // to be relative to the directory the html file is in rather
                    // than the current working directory
                    relativeTo: "build/tmp",
                    target: "build/tmp"
                }),
                "concat",
                plugins.rev(),
                plugins.bless({
                    cacheBuster: false
                })
            ],
            js: [
                plugins.uglify({
                    preserveComments: "license"
                }),
                plugins.rev()
            ]
        }))
        .pipe(gulp.dest("build/min"));
});

gulp.task("publish", function (cb) {
    runSequence(
        ["build"],
        ["minify"],
        cb
    );
});

gulp.task("dev", function (cb) {
    runSequence(
        ["build"],
        ["watch"],
        cb
    );
})

gulp.task("build", function (cb) {
    runSequence(
        ["clean"],
        ["less", "typescript-all", "assets"],
        ["inject"],
        cb
    );
})

gulp.task("watch", function () {
    gulp.watch("src/**/*.less", ["less"]);

    gulp.watch([
        "src/**/*.ts",
        "typings/**/*.d.ts"
    ], ["typescript-all"]);

    gulp.watch([
        "src/*.html",
        "bower.json"
    ], ["inject"]);

    gulp.watch(staticFileTypesGlob.map(function (glob) {
        return "src/" + glob;
    }), ["assets"]);

    browserSync.init({
      server: {
        baseDir: ["./build/src/", "./"]
      }
    });

    gulp.watch(['./build/**']).on('change', function(e) {
        reload();
    });
})

gulp.task("livereload", function () {
    plugins.livereload.listen();
});
