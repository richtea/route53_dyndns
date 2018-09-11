'use strict';

const gulp = require('gulp');
const del = require('del');
const install = require('gulp-install');
const zip = require('gulp-zip');
const changed = require('gulp-changed');
const cp = require('child_process');
const tape = require('gulp-tape');
const plumber = require('gulp-plumber');
const tapColorize = require('tap-colorize');
const tapSimple = require('tap-simple');

// Support command-line arg that specifies which stack to deploy, for the deploy task
const argv = require('yargs')
    .option(
        {
            's': {
                alias: 'stack',
                type: 'string',
                nargs: 1,
                default: 'default'
            },
            'w': {
                alias: 'whatif',
                type: 'boolean',
                default: 'false'
            },
            'nocolor': {
                type: 'boolean',
                nargs: 0,
                default: false
            }
        })
    .argv;

var paths = {
    src_files: [
        './src/**/*',
        '!./src/**/*.spec.js'
    ],
    test_files: [
        './src/**/*.spec.js'
    ],
    install_packages: ['./package.json'],
    package_files: ['./dist/**/*'],
    dest: './dist',
    package: './package',
    package_name: 'dyndns_lambda.zip'
};

function unitTest() {
    let reporter;  

    if (argv.nocolor) {
        reporter = tapSimple();
    } else {
        reporter = tapColorize();
    }

    reporter.pipe(process.stdout);

    return gulp.src(paths.test_files)
        .pipe(plumber({errorHandler: () => {}}))
        .pipe(tape( { outputStream: reporter }));
}
unitTest.description = 'Runs unit tests';

function clean() {
    // You can use multiple globbing patterns as you would with `gulp.src`,
    // for example if you are using del 2.0 or above, return its promise
    return del([paths.dest + '/**/*', paths.package +'/**/*']);
}
clean.description = 'Cleans the packaging and output directories of all files';

function src_files() {
    return gulp.src(paths.src_files, 
        {
            base: './src'
        })
        .pipe(changed(paths.dest))
        .pipe(gulp.dest(paths.dest));
}
src_files.description = 'Moves source files to the packaging directory';

function node_modules() {
    return gulp.src(paths.install_packages)
        .pipe(gulp.dest(paths.dest))
        .pipe(install({
            production: true
        }));
}
node_modules.description = 'Installs the NPM production dependencies into the packaging directory';

function build_package() {
    return gulp.src(paths.package_files)
        .pipe(zip(paths.package_name))
        .pipe(gulp.dest(paths.package));
}
build_package.description = 'Builds a package for deployment';

function deploy(done) {
    let cmd = './tf.sh -y -c apply -s ' + argv.stack;
    if (!argv.whatif) {
        let p = cp.exec(cmd);
        p.stdout.pipe(process.stdout);
        p.stderr.pipe(process.stderr);
        return p;
    } else {
        // eslint-disable-next-line no-console
        console.log(`whatif: ${cmd}`);
        done();
    }
}
deploy.description = 'Deploys to an AWS stack by using Terraform';

var build = gulp.series(
    gulp.parallel(src_files, node_modules),
    build_package);
build.description = 'Performs a build to generate the output package for deployment';

var fullbuild = gulp.series(
    clean,
    build);
fullbuild.description = 'Performs a full clean and build';

gulp.task('unit-test', unitTest);
gulp.task('fullbuild', fullbuild);
gulp.task('build', build);

gulp.task('deploy', deploy);

/*
 * Define default task that can be called by just running `gulp` from cli
 */
gulp.task('default', build);