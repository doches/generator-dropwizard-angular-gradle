var generators = require('yeoman-generator');

var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var yosay = require('yosay');

function decompose(name) {
    return name.replace(/[^a-zA-Z]/g, " ").replace(/\s+/g, " ").trim().split(" ");
}

function camelcase(name) {
    var words = decompose(name);
    for (var i = 0; i < words.length; i++) {
        words[i] = words[i][0].toUpperCase() + words[i].slice(1, words[i].length);
    }
    return words.join("");
}

module.exports = yeoman.generators.Base.extend({
    prompting: function () {
        var done = this.async();

        // Have Yeoman greet the user.
        this.log(yosay(
            'Welcome to ' + chalk.red('dropwizard-angular-gradle')
        ));

        var dir = this.destinationRoot()
        if (dir.split("/").length > 1) {
            dir = dir.split("/")
            dir = dir[dir.length-1]
        }

        var prompts = [{
            type: 'input',
            name: 'name',
            message: 'Project name',
            default: dir
        }, {
            type: 'input',
            name: 'description',
            message: 'Project description',
            default: ""
        }, {
            type: 'input',
            name: 'package',
            message: 'Java package qualifier (reverse TLD, e.g. com.foobar.application)',
            default: "com.foobar.application"
        }];

        this.prompt(prompts, function (props) {
            props.className = camelcase(props.name);
            props.slug = decompose(props.name).join("-");

            this.props = props;
            // To access props later use this.props.someOption;

            done();
        }.bind(this));
    },

    writing: {
        app: function () {
            // Gradle setup
            var files = [
                "build.gradle",
                "gradle.properties",
                "gradlew",
                "gradlew.bat",
                "settings.gradle",
                "gradle/idea.gradle",
                "gradle/node.gradle",
                "gradle/repositories.gradle",
                "gradle/wrapper/gradle-wrapper.properties"
            ];
            for (var i = 0; i < files.length; i++) {
                this.fs.copyTpl(
                    this.templatePath(files[i]),
                    this.destinationPath(files[i]),
                    this.props
                );
            }
            this.fs.copy(
                this.templatePath("gradle/wrapper/gradle-wrapper.jar"),
                this.destinationPath("gradle/wrapper/gradle-wrapper.jar")
            );

            // Front-end and dist projects
            var projects = [
                ["distribution", [
                    "src/dev/var/conf/server.yml",
                    "BINARY-src/standard/var/conf/keyStore.jks",
                    "BINARY-src/standard/var/conf/trustStore.jks",
                    "src/standard/var/conf/server.yml",
                    "src/standard/var/conf/README",
                    "src/standard/var/log/README",
                    "src/standard/var/run/README",
                    "build.gradle"
                ]],
                ["app", [
                    "src/app.less",
                    "src/app.ts",
                    "src/index.html",
                    "typings/globals/angular/index.d.ts",
                    "typings/globals/angular/index.d.ts",
                    "typings/globals/jquery/index.d.ts",
                    "typings/globals/jquery/index.d.ts",
                    "typings/index.d.ts",
                    "bower.json",
                    "gulpfile.js",
                    "package.json",
                    "tsconfig.json",
                    "typings.json",
                    "build.gradle"
                ]],
                ["server", [
                    "build.gradle"
                ]]
            ]
            for (var p = 0; p < projects.length; p++) {
                var project = projects[p];
                for (var f = 0; f < project[1].length; f++) {
                    if (project[1][f].indexOf("BINARY-") > -1) {
                        project[1][f] = project[1][f].replace("BINARY-", "");
                        this.fs.copy(
                            this.templatePath("projects/" + project[0] + "/" + project[1][f]),
                            this.destinationPath(this.props.slug + "-" + project[0] + "/" + project[1][f])
                        );
                    } else {
                        this.fs.copyTpl(
                            this.templatePath("projects/" + project[0] + "/" + project[1][f]),
                            this.destinationPath(this.props.slug + "-" + project[0] + "/" + project[1][f]),
                            this.props
                        );
                    }
                }
            }

            // Server project
            var packageDir = this.props.package.replace(/\./g, "/");
            var files = [
                "backend/DatabaseBackend.java",
                "backend/DatabaseConfiguration.java"
            ];
            for (var i = 0; i < files.length; i++) {
                this.fs.copyTpl(
                    this.templatePath("projects/server/java/" + files[i]),
                    this.destinationPath(this.props.slug + "-server/src/main/java/" + packageDir + "/" + files[i]),
                    this.props
                );
            }
            // Server project files that need prefixing
            var files = [
                "Application.java",
                "Configuration.java"
            ];
            for (var i = 0; i < files.length; i++) {
                this.fs.copyTpl(
                    this.templatePath("projects/server/java/" + files[i]),
                    this.destinationPath(this.props.slug + "-server/src/main/java/" + packageDir + "/" + this.props.className + files[i]),
                    this.props
                );
            }
        },

        projectfiles: function () {
            this.fs.copy(
                this.templatePath('gitignore'),
                this.destinationPath('.gitignore')
            );
        }
    },

    install: function () {
        var _this = this;
        this.spawnCommand('git', ['init']).on("close", function() {;
            _this.spawnCommand('git', ['add', '*']).on("close", function() {;
                _this.spawnCommand('git', ['commit', '-am', '\"Initial Commit\"']).on("close", function() {;
                    _this.spawnCommand('git', ['tag', '0.0.0']).on("close", function() {;
                        _this.spawnCommand('./gradlew', ['idea']).on("close", function() {
                            _this.spawnCommand('npm', ['install'], {cwd: _this.props.slug + "-app"}).on("close", function() {
                                _this.spawnCommand('bower', ['install'], {cwd: _this.props.slug + "-app"});
                            });
                        });
                    });
                });
            });
        });
    }
});
