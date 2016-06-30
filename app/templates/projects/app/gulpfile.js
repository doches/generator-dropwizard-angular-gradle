"use strict";

var Promise = require("bluebird");

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

Promise.promisifyAll(mkdirp);
Promise.promisifyAll(ncp);

var isWatch = false;

var staticFileTypes = [
    "eot",
    "gif",
    "ico",
    "png",
    "svg",
    "ttf",
    "woff",
    "jpg"
];

var watchErrorHandler = function (err) {
    if (!isWatch) {
        console.warn(err);
    }
};

var warnMissingFiles = function (files, taskName) {
    files.forEach(function (file) {
        if (!fs.existsSync(file)) {
            plugins.util.log(
                plugins.util.colors.cyan(taskName) +
                " " +
                plugins.util.colors.yellow("WARNING:") +
                " " +
                plugins.util.colors.magenta(path.resolve(file)) +
                " not found.");
        }
    });
};

var staticFileTypesGlob = staticFileTypes.map(function (ext) {
    return "**/*." + ext;
});

// cleans the build and coverage directories
gulp.task("clean", function () {
    return del(["build", "coverage"]);
});

// lints javascript files in the src directory
gulp.task("eslint", function () {
    return gulp.src("src/**/*.js")
        .pipe(plugins.eslint())
        .pipe(plugins.eslint.format());
        // .pipe(plugins.if(!isWatch, plugins.eslint.failAfterError()));
});

// lints gulpfile.js
gulp.task("eslint-gulpfile", function () {
    return gulp.src("gulpfile.js")
        .pipe(plugins.eslint())
        .pipe(plugins.eslint.format());
        // .pipe(plugins.if(!isWatch, plugins.eslint.failAfterError()));
});

// compiles less into css and lints the css
gulp.task("less", function () {
    var AUTOPREFIXER_BROWSERS = [
        "> 1%",
        "last 2 versions",
        "Firefox ESR",
        "Opera 12.1"
    ];

    return gulp.src("src/**/*.less")
        .pipe(plugins.sourcemaps.init())
        .pipe(plugins.less())
        // capture errors from the less compiler and suppress when watching
        .on("error", function (err) {
            // gulp-less is poorly written and will halt the watch pipeline unless
            // the "end" event is forcefully emitted.
            plugins.util.log("less " + plugins.util.colors.red("Error:") + " " + err.message);
            /* eslint-disable no-invalid-this */
            this.emit("end");
            /* eslint-enable no-invalid-this */
        })
        .pipe(plugins.csslint())
        .pipe(plugins.csslintLessReporter(path.join("src/**/*.less")))
        // capture errors from the less reporter and suppress when watching
        .on("error", watchErrorHandler)
        .pipe(plugins.autoprefixer(AUTOPREFIXER_BROWSERS))
        .pipe(plugins.sourcemaps.write())
        .pipe(gulp.dest("build/src"))
        .pipe(plugins.livereload());
});

// create typescript project outside of task so watches can have incremental builds
var tsProject = plugins.typescript.createProject({
    removeComments: false,
    noImplicitAny: true,
    declarationFiles: true,
    noExternalResolve: true,
    target: "ES5"
});

// compiles typescript into javascript
gulp.task("typescript", function () {
    // create a filter just for *.ts files
    var tsFilter = plugins.filter(["**/*.ts", "!**/*.d.ts"], {
        restore: true
    });

    var tsResult = gulp.src([
        /* eslint-disable indent */
            "typings/**/*.d.ts",
            "src/**/*.ts"
        ])
        /* eslint-enable indent */
        // filter to just *.ts files
        .pipe(tsFilter)
        .pipe(plugins.tslint())
        .pipe(plugins.tslint.report("verbose", {emitError: false}))
        .pipe(plugins.sourcemaps.init())
        // restore *.d.ts files
        .pipe(tsFilter.restore)
        // compile
        .pipe(plugins.typescript(tsProject))
        // capture errors from the typescript compiler and suppress when watching
        .on("error", watchErrorHandler);

    // merge .js and .d.ts output streams
    return es.merge(tsResult.js, tsResult.dts)
        .pipe(plugins.sourcemaps.write())
        .pipe(gulp.dest("build/src"));
});

// read the filesGlob property in tsconfig.json and add all matching
// files to the files property in tsconfig.json.
gulp.task("tsconfig", function () {
    tsconfigGlob({cwd: process.cwd()});
});

// copies all static files from the src directory
gulp.task("assets", function () {
    return gulp.src(staticFileTypesGlob, {cwd: "src"})
        .pipe(gulp.dest("build/src"));
});

// injects required css and javascript into html files
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

    warnMissingFiles(main, "inject");

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

// copies all files from build/src and dependencies from bower_components into build/tmp
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

// copies all static files from build/tmp to build/min
gulp.task("copy-to-min", ["copy-to-tmp"], function () {
    // only copy static files from build/tmp to build/min.
    // all js, html, and css files will be processed by the
    // minify task and output to build/min
    return gulp.src(staticFileTypesGlob, {cwd: "build/tmp"})
        .pipe(gulp.dest("build/min"));
});

// minifies html, javascript, and css from build/tmp into build/min
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
            html: [
                plugins.htmlMinifier({
                    collapseWhitespace: true
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

// runs all tasks
gulp.task("default", function (cb) {
    runSequence(
        ["build"],
        cb);
});

gulp.task("build", function (cb) {
    runSequence(
        ["eslint-gulpfile"],
        ["clean"],
        ["tsconfig"],
        ["assets", "eslint", "less", "typescript"],
        ["inject"],
        cb);
});

gulp.task("publish", function (cb) {
    runSequence(
        ["default"],
        ["minify"],
        cb);
});

// before running watch, make sure all assets are built
gulp.task("watch", function (cb) {
    isWatch = true;

    runSequence(
        ["eslint-gulpfile"],
        ["assets", "eslint", "less", "typescript"],
        ["inject"],
        ["startwatch"],
        cb);
});

gulp.task("startwatch", function () {
    isWatch = true;

    gulp.watch("src/**/*.js", ["eslint"]);

    gulp.watch("gulpfile.js", ["eslint-gulpfile"]);

    gulp.watch("src/**/*.less", ["less"]);

    gulp.watch([
        "src/**/*.ts",
        "typings/**/*.d.ts"
    ], ["tsconfig"]);

    gulp.watch([
        "typings/**/*.d.ts",
        "src/**/*.ts"
    ], ["typescript"]);

    gulp.watch(staticFileTypesGlob.map(function (glob) {
        return "src/" + glob;
    }), ["assets"]);

    gulp.watch(["src/*.html", "bower.json"], ["inject"]);
});

gulp.task("livereload", function () {
    plugins.livereload.listen();
});
